import { describe, expect, it } from 'vitest';

import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
} from '../index.js';

/** Deterministic scheduler for pending and timeout transitions. */
function createClock() {
  let now = 0;
  let nextId = 0;
  const tasks = new Map<number, { readonly due: number; readonly callback: () => void }>();
  return {
    now: () => now,
    schedule(callback: () => void, delayMilliseconds: number) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, { due: now + delayMilliseconds, callback });
      return { dispose: () => tasks.delete(id) };
    },
    async advanceBy(milliseconds: number) {
      now += milliseconds;
      for (const [id, task] of [...tasks].filter(([, value]) => value.due <= now)) {
        tasks.delete(id);
        task.callback();
        await Promise.resolve();
      }
    },
  };
}

/** Creates a live editor whose service transitions are deterministic. */
async function createRecoveryHarness() {
  const clock = createClock();
  const document = createDocumentModel({
    text: 'alpha',
    uri: 'file:///workspace/recovery.ts',
    languageId: 'typescript',
  });
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      hover: true,
      documentFormatting: true,
    },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///workspace/recovery.ts',
    languageId: 'typescript',
    clock,
    interactiveTimeoutMs: 500,
  });
  const controller = createCodeEditorController({ document, lsp: coordinator });
  const editor = new CodeEditor({ controller });
  editor.focus();
  await coordinator.open();
  return { clock, controller, coordinator, document, editor, session };
}

describe('language-service degradation and recovery', () => {
  it('should expose pending, cancellation, timeout, and failure while local editing remains available', async () => {
    // Service failures must be visible and bounded without blocking local source edits.
    const harness = await createRecoveryHarness();
    const hover = harness.coordinator.requestHover({ line: 0, character: 1 });
    expect(harness.controller.presentation.operationState).toBe('waiting');
    await harness.clock.advanceBy(151);
    expect(harness.controller.presentation.operationState).toBe('pending');
    expect(harness.editor.insertText('x')).toBe(true);

    hover.cancel();
    await hover.settled;
    expect(harness.controller.presentation.operationState).toBe('idle');
    expect(harness.controller.presentation.serviceState).toBe('ready');

    const timeout = harness.coordinator.requestHover({ line: 0, character: 1 });
    await harness.clock.advanceBy(500);
    expect(await timeout.settled).toEqual({ outcome: 'timeout' });
    expect(harness.controller.presentation.serviceState).toBe('degraded');
    expect(harness.controller.publicState.commandAvailability.edit).toBe(true);
    expect(harness.controller.publicState.commandAvailability.search).toBe(true);

    const failed = harness.coordinator.requestHover({ line: 0, character: 1 });
    harness.session.fail(failed.requestId, new Error('server leaked secret source text'));
    expect(await failed.settled).toEqual({ outcome: 'failed' });
    expect(JSON.stringify(harness.controller.presentation)).not.toContain('secret source text');
  });

  it('should reject late results across capability loss, disconnect, and reconnect', async () => {
    // Results from an obsolete service generation must remain inert after capabilities or connection change.
    const harness = await createRecoveryHarness();
    const completion = harness.coordinator.requestCompletion({ line: 0, character: 5 });
    harness.session.updateCapabilities({ hover: true });
    harness.session.reconnect();
    await Promise.resolve();
    expect(harness.controller.presentation.serviceState).toBe('connecting');
    expect(harness.controller.presentation.commandAvailability.completion).toBe(false);
    const before = {
      text: harness.document.text,
      revision: harness.document.identity.revision,
      undoDepth: harness.document.undoDepth,
      assistance: harness.controller.presentation.assistance,
    };
    harness.session.respond(completion.requestId, {
      items: [{ label: 'late', insertText: 'late' }],
    });
    await completion.settled;
    expect({
      text: harness.document.text,
      revision: harness.document.identity.revision,
      undoDepth: harness.document.undoDepth,
      assistance: harness.controller.presentation.assistance,
    }).toEqual(before);

    await harness.coordinator.resynchronize();
    expect(harness.controller.presentation.serviceState).toBe('ready');
    expect(harness.editor.insertText('!')).toBe(true);
    expect(harness.document.text).toContain('!');
  });
});
