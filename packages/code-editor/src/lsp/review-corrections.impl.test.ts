import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { validateCompletionItems } from './completion.js';
import { createCodeEditorLspCoordinator } from './coordinator.js';
import { createInProcessLspSession, type CodeEditorLspSession } from './session.js';
import type { CodeEditorLspCapabilities, LspRecordedNotification, LspRecordedRequest } from './types.js';

const uri = 'file:///workspace/review.ts';

/** Session fixture that models asynchronous notification enqueueing and best-effort cancellation. */
class ControlledSession implements CodeEditorLspSession {
  public readonly contractVersion = 1 as const;
  public readonly capabilities: Readonly<CodeEditorLspCapabilities>;
  public readonly requests: LspRecordedRequest[] = [];
  public readonly notifications: LspRecordedNotification[] = [];
  public state = 'ready' as const;
  public generation = 1;
  public deferChanges = false;
  public hangClose = false;
  #nextId = 1;
  #releaseChange: (() => void) | undefined;
  readonly #responses = new Map<number, (result: unknown, error?: Error) => void>();

  public constructor(capabilities: CodeEditorLspCapabilities) {
    this.capabilities = Object.freeze({ ...capabilities });
  }

  public reserveRequestId(): number {
    const id = this.#nextId;
    this.#nextId += 1;
    return id;
  }

  public request(
    id: number,
    method: string,
    params: Readonly<Record<string, unknown>>,
    listener: (result: unknown, error?: Error) => void,
  ): void {
    this.requests.push(Object.freeze({ id, method, params }));
    this.#responses.set(id, listener);
  }

  public notify(method: string, params: Readonly<Record<string, unknown>>): Promise<void> {
    this.notifications.push(Object.freeze({ method, params }));
    if (method === 'textDocument/didClose' && this.hangClose) return new Promise(() => undefined);
    if (method !== 'textDocument/didChange' || !this.deferChanges) return Promise.resolve();
    return new Promise((resolve) => {
      this.#releaseChange = resolve;
    });
  }

  public releaseChange(): void {
    this.#releaseChange?.();
    this.#releaseChange = undefined;
  }

  public cancel(_id: number): void {
    // Real cancellation is advisory, so this fixture deliberately retains the response callback.
  }

  public respond(id: number, result: unknown): void {
    this.#responses.get(id)?.(result);
  }

  public subscribeDiagnostics(): () => void {
    return () => undefined;
  }

  public subscribeState(): () => void {
    return () => undefined;
  }

  public markReady(): void {}
}

/** Deterministic scheduler used to advance one request past its deadline. */
function createClock() {
  let now = 0;
  let nextId = 0;
  const tasks = new Map<number, { readonly due: number; readonly callback: () => void }>();
  return {
    now: () => now,
    schedule(callback: () => void, delay: number) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, { due: now + delay, callback });
      return { dispose: () => tasks.delete(id) };
    },
    advanceBy(milliseconds: number) {
      now += milliseconds;
      for (const [id, task] of [...tasks]) {
        if (task.due > now) continue;
        tasks.delete(id);
        task.callback();
      }
    },
  };
}

describe('reviewed language-service request lifecycle', () => {
  it('should issue a trigger request only after an asynchronous document change is enqueued', async () => {
    const session = new ControlledSession({ completion: true, completionTriggers: ['.'] });
    const document = createDocumentModel({ text: 'value', uri, languageId: 'typescript' });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    await coordinator.open();
    document.apply(
      document.createTransaction({
        edits: [{ range: { from: 5, to: 5 }, text: '.' }],
        origin: 'typing',
      }),
    );
    session.deferChanges = true;
    const synchronization = coordinator.synchronize();
    const completion = coordinator.triggerCompletion('.', { line: 0, character: 6 });

    expect(session.requests).toHaveLength(0);
    session.releaseChange();
    await synchronization;
    await Promise.resolve();
    expect(session.requests.at(-1)?.id).toBe(completion.requestId);
  });

  it('should keep late cancelled and timed-out callbacks inert', async () => {
    const clock = createClock();
    const session = new ControlledSession({ completion: true });
    const document = createDocumentModel({ text: 'value', uri, languageId: 'typescript' });
    const coordinator = createCodeEditorLspCoordinator({
      document,
      session,
      uri,
      languageId: 'typescript',
      clock,
      interactiveTimeoutMs: 20,
    });
    await coordinator.open();

    const cancelled = coordinator.requestCompletion({ line: 0, character: 5 });
    cancelled.cancel();
    session.respond(cancelled.requestId, { items: [{ label: 'late-cancel', insertText: 'x' }] });
    expect(coordinator.presentation.completion).toBeUndefined();

    const timedOut = coordinator.requestCompletion({ line: 0, character: 5 });
    clock.advanceBy(20);
    expect(await timedOut.settled).toEqual({ outcome: 'timeout' });
    session.respond(timedOut.requestId, { items: [{ label: 'late-timeout', insertText: 'x' }] });
    expect(coordinator.presentation.completion).toBeUndefined();
  });

  it('should settle a queued request as stale when its document revision changes before issue', async () => {
    const session = new ControlledSession({ completion: true, completionTriggers: ['.'] });
    const document = createDocumentModel({ text: 'value', uri, languageId: 'typescript' });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    await coordinator.open();
    session.deferChanges = true;
    document.apply(
      document.createTransaction({
        edits: [{ range: { from: 5, to: 5 }, text: '.' }],
        origin: 'typing',
      }),
    );
    const synchronization = coordinator.synchronize();
    const completion = coordinator.triggerCompletion('.', { line: 0, character: 6 });
    document.apply(
      document.createTransaction({
        edits: [{ range: { from: 0, to: 0 }, text: 'x' }],
        origin: 'typing',
      }),
    );

    session.releaseChange();
    await synchronization;
    expect(await completion.settled).toEqual({ outcome: 'stale' });
    expect(coordinator.serviceState).toBe('ready');
  });

  it('should release local resources without awaiting a hanging close notification', async () => {
    const session = new ControlledSession({ hover: true });
    const coordinator = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'value', uri, languageId: 'typescript' }),
      session,
      uri,
      languageId: 'typescript',
    });
    await coordinator.open();
    session.hangClose = true;

    await coordinator.close();

    expect(coordinator.closed).toBe(true);
    expect(coordinator.retainedState.pendingRequests).toBe(0);
  });
});

describe('reviewed language-intelligence state boundaries', () => {
  it('should clear revision-bound assistance after an accepted source mutation', async () => {
    const session = createInProcessLspSession({
      capabilities: { hover: true, diagnostics: true, definition: true, documentSymbols: true },
    });
    const document = createDocumentModel({ text: 'alpha\nbeta', uri, languageId: 'typescript' });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    const controller = createCodeEditorController({ document, lsp: coordinator });
    await coordinator.open();

    const hover = coordinator.requestHover({ line: 0, character: 1 });
    session.respond(hover.requestId, { contents: 'alpha' });
    const symbols = coordinator.requestDocumentSymbols();
    session.respond(symbols.requestId, [
      {
        name: 'alpha',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      },
    ]);
    const definition = coordinator.requestDefinition({ line: 0, character: 1 });
    session.respond(definition.requestId, [
      {
        uri,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      },
      {
        uri: 'file:///workspace/other.ts',
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
      },
    ]);
    session.publishDiagnostics(uri, 0, [
      {
        severity: 1,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        message: 'old',
      },
    ]);
    await Promise.all([hover.settled, symbols.settled, definition.settled]);

    expect(controller.replaceSelection('x')).toBe(true);
    expect(coordinator.presentation.diagnostics.items).toEqual([]);
    expect(coordinator.presentation.hover).toBeUndefined();
    expect(coordinator.presentation.navigationChooser).toBeUndefined();
    expect(coordinator.presentation.symbolChooser).toBeUndefined();
  });

  it('should accept a singleton definition object and keep unsupported range formatting inert', async () => {
    const session = createInProcessLspSession({
      capabilities: { definition: true, documentFormatting: true, rangeFormatting: false },
    });
    const document = createDocumentModel({ text: 'alpha\nbeta', uri, languageId: 'typescript' });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    const controller = createCodeEditorController({ document, lsp: coordinator });
    await coordinator.open();
    controller.setLanguageResult({
      identity: document.identity,
      adapterId: 'typescript',
      generation: 1,
      state: 'ready',
      syntax: [],
      folds: [{ from: Number(document.snapshot.line(0).from), to: Number(document.snapshot.line(1).to) }],
      brackets: [],
    });
    controller.foldLine(0);
    expect(controller.folds).toHaveLength(1);

    const definition = coordinator.requestDefinition({ line: 0, character: 1 });
    session.respond(definition.requestId, {
      uri,
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
    });
    await definition.settled;
    expect(Number(document.selection.head)).toBe(document.text.indexOf('beta'));
    expect(controller.folds).toHaveLength(0);

    document.setSelection({ anchor: 0, head: 5 });
    const requestCount = session.requests.length;
    controller.requestFormatting();
    expect(session.requests).toHaveLength(requestCount);
  });

  it('should stop retaining completion candidates when aggregate edit budgets are exhausted', () => {
    const items = validateCompletionItems(
      {
        items: [
          {
            label: 'within-budget',
            textEdit: {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
              newText: 'a',
            },
            additionalTextEdits: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                newText: 'b',
              },
            ],
          },
          {
            label: 'over-budget',
            textEdit: {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
              newText: 'c',
            },
          },
        ],
      },
      10,
      100,
      2,
      10,
    );

    expect(items.map((item) => item.label)).toEqual(['within-budget']);
  });

  it('should reject file URIs containing terminal or bidirectional controls', () => {
    const session = createInProcessLspSession();
    expect(() =>
      createCodeEditorLspCoordinator({
        document: createDocumentModel({ text: '', uri, languageId: 'typescript' }),
        session,
        uri: 'file:///workspace/\u202eevil.ts',
        languageId: 'typescript',
      }),
    ).toThrow(TypeError);
  });
});
