import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it, vi } from 'vitest';

import {
  CodeEditorWindow,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
} from './index.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Creates a controller whose provider mutations cross the real coordinator boundary. */
async function createMutationHarness(options: { readonly readOnly?: boolean } = {}) {
  const document = createDocumentModel({
    text: 'const value=1;\n',
    uri: 'file:///workspace/mutation.ts',
    languageId: 'typescript',
    readOnly: options.readOnly,
  });
  const session = createInProcessLspSession({
    capabilities: { documentFormatting: true },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///workspace/mutation.ts',
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({ document, lsp: coordinator });
  const parserSchedule = vi.fn();
  const window = new CodeEditorWindow({ controller, onDocumentChange: parserSchedule });
  await coordinator.open();
  return { controller, coordinator, document, parserSchedule, session, window };
}

describe('controller mutation integration', () => {
  it('should integrate one accepted provider formatting operation exactly once', async () => {
    // One accepted provider edit must create one revision, one undo unit, one sync, and one repaint.
    const { controller, coordinator, document, parserSchedule, session, window } = await createMutationHarness();
    const invalidations = vi.fn();
    const subscription = controller.subscribe(invalidations);
    const beforeRevision = Number(document.identity.revision);
    const format = coordinator.formatDocument();
    invalidations.mockClear();
    const notificationStart = session.notifications.length;

    session.respond(format.requestId, [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 0 },
        },
        newText: 'const value = 1;\n',
      },
    ]);
    await format.settled;
    await window.editor.whenIdle();

    expect(document.text).toBe('const value = 1;\n');
    expect(Number(document.identity.revision)).toBe(beforeRevision + 1);
    expect(document.undoDepth).toBe(1);
    expect(parserSchedule).toHaveBeenCalledTimes(1);
    expect(session.notifications.slice(notificationStart).map((item) => item.method)).toEqual([
      'textDocument/didChange',
    ]);
    expect(window.status).toMatchObject({ line: 1, column: 1 });
    expect(window.editor.project({ width: 24, height: 3, caps }).caret.visible).toBe(true);
    expect(invalidations).toHaveBeenCalledTimes(1);

    subscription.dispose();
  });

  it('should leave every integration consumer unchanged for a rejected stale mutation', async () => {
    // A stale mutation must not alter revision, history, callbacks, parsing, sync, caret, status, or repaint.
    const { controller, document, parserSchedule, session, window } = await createMutationHarness();
    const staleBase = document.identity;
    const accepted = controller.applyMutation({
      origin: 'typing',
      base: document.identity,
      edits: [{ range: { from: 0, to: 0 }, text: 'x' }],
      selection: { anchor: 1, head: 1 },
    });
    expect(accepted).toEqual({ accepted: true });
    await Promise.resolve();
    parserSchedule.mockClear();
    const invalidations = vi.fn();
    const subscription = controller.subscribe(invalidations);
    const before = {
      text: document.text,
      revision: document.identity.revision,
      undoDepth: document.undoDepth,
      selection: document.selection,
      folds: controller.folds,
      parserRuns: controller.metrics.parserRuns,
      notifications: session.notifications.length,
      status: window.status,
    };

    const rejected = controller.applyMutation({
      origin: 'external',
      base: staleBase,
      edits: [{ range: { from: 0, to: 1 }, text: 'y' }],
      selection: { anchor: 1, head: 1 },
    });
    await window.editor.whenIdle();

    expect(rejected).toEqual({ accepted: false, reason: 'stale' });
    expect({
      text: document.text,
      revision: document.identity.revision,
      undoDepth: document.undoDepth,
      selection: document.selection,
      folds: controller.folds,
      parserRuns: controller.metrics.parserRuns,
      notifications: session.notifications.length,
      status: window.status,
    }).toEqual(before);
    expect(invalidations).not.toHaveBeenCalled();
    expect(parserSchedule).not.toHaveBeenCalled();

    subscription.dispose();
  });
});
