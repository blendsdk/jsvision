import { describe, expect, it, vi } from 'vitest';

import { createDocumentModel } from '../document/model.js';
import { createCodeEditorLspCoordinator, createInProcessLspSession } from './index.js';
import { parseSafeSnippet, validateCompletionItems } from './completion.js';
import { validateFormattingEdits } from './formatting.js';
import { boundedArray, isAllowedUri, renderSafeMarkdown, sanitizeProtocolText } from './validation.js';

const uri = 'file:///workspace/source.ts';

describe('LSP protocol validation', () => {
  it('should reject non-file and traversal-bearing URIs', () => {
    expect(isAllowedUri('https://example.test/source.ts')).toBe(false);
    expect(isAllowedUri('file:///workspace/../secret')).toBe(false);
    expect(isAllowedUri('file:///workspace/source.ts')).toBe(true);
  });

  it('should strip complete terminal control sequences and directional controls', () => {
    const hostile = 'before\u001B[31mred\u001B[0m\u001B]52;c;secret\u0007\u202Eafter';
    expect(sanitizeProtocolText(hostile, 100)).toBe('beforeredafter');
  });

  it('should render links as inert labels and remove HTML and images', () => {
    const rendered = renderSafeMarkdown(
      '<script>run()</script> [safe label](javascript:run) ![image](file:///secret)',
      100,
    );
    expect(rendered.text).toContain('safe label');
    expect(rendered.text).not.toMatch(/script|javascript:|file:|image/iu);
  });

  it('should guard completion collection against throwing getters', () => {
    const hostile = Object.defineProperty({}, 'label', {
      enumerable: true,
      get() {
        throw new Error('hostile getter');
      },
    });
    expect(validateCompletionItems({ items: [hostile] }, 10, 100)).toEqual([]);
  });

  it('should reject revoked proxy arrays without throwing', () => {
    const revocable = Proxy.revocable([], {});
    revocable.revoke();
    expect(() => boundedArray(revocable.proxy, 10)).not.toThrow();
    expect(boundedArray(revocable.proxy, 10)).toEqual([]);
  });

  it('should preserve unsupported snippet constructs as literal data', () => {
    const parsed = parseSafeSnippet('${1:name}-${TM_FILENAME}-${command:run}-$0');
    expect(parsed.text).toBe('name-${TM_FILENAME}-${command:run}-');
    expect([...parsed.placeholders.keys()]).toEqual([1, 0]);
  });

  it('should reject a formatting flood before document mutation', () => {
    const document = createDocumentModel({ text: 'abc', uri, languageId: 'typescript' });
    const edits = Array.from({ length: 11 }, () => ({
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      newText: 'x',
    }));
    expect(validateFormattingEdits(document, edits, 10, 100)).toBeUndefined();
    expect(document.text).toBe('abc');
  });
});

describe('LSP session and coordinator hardening', () => {
  it('should cancel a superseded generation and settle pending work once', async () => {
    const session = createInProcessLspSession({ capabilities: { hover: true } });
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'value', uri, languageId: 'typescript' }),
      session,
      uri,
      languageId: 'typescript',
    });
    await coordinator.open();
    const hover = coordinator.requestHover({ line: 0, character: 1 });
    session.reconnect();
    await hover.settled;
    session.respond(hover.requestId, { contents: 'late' });
    expect(coordinator.presentation.hover).toBeUndefined();
    expect(coordinator.serviceState).toBe('connecting');
  });

  it('should isolate cancellation among requests sharing one session', async () => {
    const session = createInProcessLspSession({ capabilities: { hover: true } });
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'value', uri, languageId: 'typescript' }),
      session,
      uri,
      languageId: 'typescript',
    });
    await coordinator.open();
    const first = coordinator.requestHover({ line: 0, character: 1 });
    const second = coordinator.requestHover({ line: 0, character: 2 });
    first.cancel();
    session.respond(second.requestId, { contents: 'current' });
    await Promise.all([first.settled, second.settled]);
    expect(coordinator.presentation.hover?.text).toBe('current');
  });

  it('should expose pending only after the interaction threshold', async () => {
    let time = 0;
    const session = createInProcessLspSession({ capabilities: { hover: true } });
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'value', uri, languageId: 'typescript' }),
      session,
      uri,
      languageId: 'typescript',
      now: () => time,
    });
    await coordinator.open();
    const hover = coordinator.requestHover({ line: 0, character: 1 });
    time = 149;
    coordinator.tick();
    expect(coordinator.operationState).toBe('waiting');
    time = 150;
    coordinator.tick();
    expect(coordinator.operationState).toBe('pending');
    hover.cancel();
  });

  it('should allow later requests after one operation-local timeout', async () => {
    const clock = deterministicClock();
    const session = createInProcessLspSession({ capabilities: { hover: true } });
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'value', uri, languageId: 'typescript' }),
      session,
      uri,
      languageId: 'typescript',
      clock,
    });
    await coordinator.open();
    const first = coordinator.requestHover({ line: 0, character: 1 });
    await clock.advanceBy(5_000);
    expect(await first.settled).toEqual({ outcome: 'timeout' });
    const second = coordinator.requestHover({ line: 0, character: 2 });
    session.respond(second.requestId, { contents: 'recovered' });
    await second.settled;
    expect(coordinator.presentation.hover?.text).toBe('recovered');
  });

  it('should honor incremental synchronization and live trigger capabilities', async () => {
    const session = createInProcessLspSession({
      capabilities: {
        completion: true,
        textDocumentSync: 'incremental',
        completionTriggers: ['.'],
      },
    });
    const document = createDocumentModel({ text: 'a', uri, languageId: 'typescript' });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    await coordinator.open();
    const transaction = document.createTransaction({
      base: document.identity,
      edits: [{ range: { from: 1, to: 1 }, text: 'b' }],
      origin: 'typing',
    });
    document.apply(transaction);
    await coordinator.synchronize();
    expect(session.notifications.at(-1)?.params.contentChanges).toEqual([
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, text: 'ab' },
    ]);
    expect((await coordinator.triggerCompletion('(', { line: 0, character: 2 }).settled).outcome).toBe('unavailable');
    const triggered = coordinator.triggerCompletion('.', { line: 0, character: 2 });
    expect(session.requests.at(-1)?.id).toBe(triggered.requestId);
    triggered.cancel();
  });

  it('should clear completion and snippet state across a session generation', async () => {
    const session = createInProcessLspSession({ capabilities: { completion: true } });
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'x', uri, languageId: 'typescript' }),
      session,
      uri,
      languageId: 'typescript',
    });
    await coordinator.open();
    const completion = coordinator.requestCompletion({ line: 0, character: 1 });
    session.respond(completion.requestId, {
      items: [{ label: 'x', insertText: '${1:a}${0}', insertTextFormat: 'snippet' }],
    });
    await completion.settled;
    session.reconnect();
    expect(coordinator.presentation.completion).toBeUndefined();
    expect(coordinator.snippet).toBeUndefined();
  });

  it('should keep direct command execution outside the editor', async () => {
    const host = vi.fn(async () => false);
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'value', uri, languageId: 'typescript' }),
      uri,
      languageId: 'typescript',
      host,
    });
    expect(await coordinator.forwardCommand({ command: 'workspace.build', arguments: ['safe'] })).toBe(false);
    expect(host).toHaveBeenCalledWith(expect.objectContaining({ kind: 'command-authorization' }));
  });

  it('should reject malformed workspace edits before invoking the host', async () => {
    const host = vi.fn(async () => true);
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'value', uri, languageId: 'typescript' }),
      uri,
      languageId: 'typescript',
      host,
    });
    expect(
      await coordinator.proposeWorkspaceEdit({
        changes: {
          'file:///workspace/../secret': [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
              newText: 'x',
            },
          ],
        },
      }),
    ).toBe(false);
    expect(host).not.toHaveBeenCalled();
  });

  it('should reject public limit values outside immutable ceilings', () => {
    expect(() =>
      createCodeEditorLspCoordinator({
        document: createDocumentModel({ text: '', uri }),
        uri,
        languageId: 'plain',
        limits: { completionItems: 513 },
      }),
    ).toThrow(RangeError);
  });
});

function deterministicClock() {
  let now = 0;
  let id = 0;
  const tasks = new Map<number, { readonly due: number; readonly callback: () => void }>();
  return {
    now: () => now,
    schedule(callback: () => void, delay: number) {
      const taskId = id++;
      tasks.set(taskId, { due: now + delay, callback });
      return { dispose: () => tasks.delete(taskId) };
    },
    async advanceBy(milliseconds: number) {
      now += milliseconds;
      for (const [taskId, task] of [...tasks].filter(([, task]) => task.due <= now)) {
        tasks.delete(taskId);
        task.callback();
        await Promise.resolve();
      }
    },
  };
}
