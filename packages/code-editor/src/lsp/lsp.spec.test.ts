import { describe, expect, it, vi } from 'vitest';

import { createDocumentModel } from '../document/model.js';
import { createCodeEditorLspCoordinator, createInProcessLspSession, type CodeEditorHostEffect } from './index.js';

const firstUri = 'file:///workspace/first.ts';
const secondUri = 'file:///workspace/second.ts';

function createDeterministicClock() {
  let currentTime = 0;
  let nextTaskId = 0;
  const tasks = new Map<number, { readonly due: number; readonly callback: () => void }>();
  return {
    now: () => currentTime,
    schedule(callback: () => void, delayMilliseconds: number) {
      const taskId = nextTaskId;
      nextTaskId += 1;
      tasks.set(taskId, { due: currentTime + delayMilliseconds, callback });
      return { dispose: () => tasks.delete(taskId) };
    },
    async advanceBy(milliseconds: number) {
      currentTime += milliseconds;
      const dueTasks = [...tasks.entries()]
        .filter(([, task]) => task.due <= currentTime)
        .sort((left, right) => left[1].due - right[1].due);
      for (const [taskId, task] of dueTasks) {
        tasks.delete(taskId);
        task.callback();
        await Promise.resolve();
      }
    },
  };
}

function createHarness(
  text = 'const value = 1;\n',
  options: {
    readonly uri?: string;
    readonly readOnly?: boolean;
    readonly limits?: {
      readonly completionItems?: number;
      readonly diagnostics?: number;
      readonly contentCharacters?: number;
    };
    readonly formatOnSave?: boolean;
    readonly host?: (effect: CodeEditorHostEffect) => Promise<boolean>;
    readonly now?: () => number;
    readonly clock?: ReturnType<typeof createDeterministicClock>;
  } = {},
) {
  const document = createDocumentModel({
    text,
    uri: options.uri ?? firstUri,
    languageId: 'typescript',
    readOnly: options.readOnly,
  });
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      hover: true,
      signatureHelp: true,
      diagnostics: true,
      definition: true,
      documentSymbols: true,
      documentFormatting: true,
      rangeFormatting: true,
    },
  });
  const effects: CodeEditorHostEffect[] = [];
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: options.uri ?? firstUri,
    languageId: 'typescript',
    limits: options.limits,
    formatOnSave: options.formatOnSave,
    now: options.now,
    clock: options.clock,
    host: async (effect) => {
      effects.push(effect);
      return options.host?.(effect) ?? false;
    },
  });
  return { coordinator, document, effects, session };
}

function replaceText(document: ReturnType<typeof createDocumentModel>, from: number, to: number, text: string) {
  const transaction = document.createTransaction({
    base: document.identity,
    edits: [{ range: { from, to }, text }],
    origin: 'typing',
  });
  expect(document.apply(transaction)).toMatchObject({ accepted: true });
}

describe('LSP session isolation and lifecycle', () => {
  it('isolates interleaved shared-session traffic by URI, request, session, lineage, and revision', async () => {
    // Shared language-service traffic can affect only the exact editor generation that requested it.
    const session = createInProcessLspSession({ capabilities: { hover: true, diagnostics: true } });
    const first = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'first', uri: firstUri, languageId: 'typescript' }),
      session,
      uri: firstUri,
      languageId: 'typescript',
    });
    const second = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'second', uri: secondUri, languageId: 'typescript' }),
      session,
      uri: secondUri,
      languageId: 'typescript',
    });
    await Promise.all([first.open(), second.open()]);

    const firstHover = first.requestHover({ line: 0, character: 1 });
    const secondHover = second.requestHover({ line: 0, character: 2 });
    session.respond(secondHover.requestId, { contents: 'second result' });
    session.publishDiagnostics(firstUri, 0, [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, message: 'first' },
    ]);
    session.respond(firstHover.requestId, { contents: 'first result' });
    await Promise.all([firstHover.settled, secondHover.settled]);

    expect(first.presentation.hover?.text).toBe('first result');
    expect(second.presentation.hover?.text).toBe('second result');
    expect(first.presentation.diagnostics.items).toHaveLength(1);
    expect(second.presentation.diagnostics.items).toHaveLength(0);
  });

  it('orders open, change, close, reconnect, language, and URI lifecycle before requests', async () => {
    // Requests wait until the active text has been opened or resynchronized in protocol order.
    const { coordinator, document, session } = createHarness();
    await coordinator.open();
    replaceText(document, 6, 11, 'answer');
    const synchronization = coordinator.synchronize();
    const waitingHover = coordinator.requestHover({ line: 0, character: 7 });
    expect(session.requests).toHaveLength(0);
    await synchronization;
    expect(session.notifications.map((item) => item.method)).toEqual([
      'textDocument/didOpen',
      'textDocument/didChange',
    ]);

    session.reconnect();
    const reconnectHover = coordinator.requestHover({ line: 0, character: 7 });
    expect(session.requests).toHaveLength(1);
    const resynchronization = coordinator.resynchronize();
    expect(session.requests).toHaveLength(1);
    await resynchronization;
    expect(session.notifications.at(-2)?.method).toBe('textDocument/didClose');
    expect(session.notifications.at(-1)?.method).toBe('textDocument/didOpen');
    expect(session.requests).toHaveLength(2);

    await coordinator.setLanguage('javascript');
    await coordinator.setUri(secondUri);
    await coordinator.close();
    expect(session.notifications.map((item) => item.method).slice(-5)).toEqual([
      'textDocument/didClose',
      'textDocument/didOpen',
      'textDocument/didClose',
      'textDocument/didOpen',
      'textDocument/didClose',
    ]);
    session.respond(waitingHover.requestId, { contents: 'old' });
    session.respond(reconnectHover.requestId, { contents: 'older' });
  });

  it('ignores stale responses after edit, cancellation, close, switch, and reconnect', async () => {
    // Late work never changes text, history, popups, diagnostics, navigation, or service state.
    const scenarios = ['edit', 'cancel', 'close', 'language', 'uri', 'reconnect'] as const;
    for (const scenario of scenarios) {
      const { coordinator, document, session } = createHarness();
      await coordinator.open();
      const operation = coordinator.requestCompletion({ line: 0, character: 5 });
      if (scenario === 'edit') {
        replaceText(document, 0, 0, 'x');
        await coordinator.synchronize();
      } else if (scenario === 'cancel') {
        operation.cancel();
      } else if (scenario === 'close') {
        await coordinator.close();
      } else if (scenario === 'language') {
        await coordinator.setLanguage('javascript');
      } else if (scenario === 'uri') {
        await coordinator.setUri(secondUri);
      } else {
        session.reconnect();
        await coordinator.resynchronize();
      }
      const before = {
        text: document.text,
        undoDepth: document.undoDepth,
        presentation: coordinator.presentation,
        state: coordinator.serviceState,
      };
      session.respond(operation.requestId, { items: [{ label: 'stale' }] });
      await operation.settled;
      expect({
        text: document.text,
        undoDepth: document.undoDepth,
        presentation: coordinator.presentation,
        state: coordinator.serviceState,
      }).toEqual(before);
    }
  });
});

describe('LSP assistance presentation', () => {
  it('bounds, filters, navigates, accepts, and dismisses completion without trapping focus', async () => {
    // Completion owns only its documented keys while typing filters and unrelated commands remain available.
    const { coordinator, session } = createHarness('con');
    await coordinator.open();
    const operation = coordinator.requestCompletion({ line: 0, character: 3 });
    session.respond(operation.requestId, {
      items: Array.from({ length: 20 }, (_, index) => ({ label: `constant${index}`, insertText: `stant${index}` })),
    });
    await operation.settled;
    expect(coordinator.presentation.completion?.items).toHaveLength(12);

    expect(coordinator.handleKey({ key: 'ArrowDown' })).toBe('completion');
    expect(coordinator.handleKey({ key: 'PageDown' })).toBe('completion');
    expect(coordinator.handleKey({ key: 'n', text: 'n' })).toBe('editor');
    expect(coordinator.presentation.completion?.filter).toBe('conn');
    expect(coordinator.handleKey({ key: 'F2' })).toBe('unhandled');
    expect(coordinator.handleKey({ key: 'Escape' })).toBe('completion');
    expect(coordinator.presentation.completion).toBeUndefined();
  });

  it('applies primary and additional snippet edits atomically and traverses placeholders safely', async () => {
    // Numbered placeholders are data, apply in one undo unit, and exit safely without executing constructs.
    const execute = vi.fn();
    const { coordinator, document, session } = createHarness('fn\n');
    await coordinator.open();
    const operation = coordinator.requestCompletion({ line: 0, character: 2 });
    session.respond(operation.requestId, {
      items: [
        {
          label: 'function',
          textEdit: {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } },
            newText: 'function',
          },
          additionalTextEdits: [
            { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } }, newText: '// generated\n' },
          ],
          insertTextFormat: 'snippet',
          insertText: 'function ${1:name}(${2:arg}) {\n\t${0}\n}${TM_SELECTED_TEXT}${command:run}',
          command: { title: 'never execute', command: 'shell.run' },
        },
      ],
    });
    await operation.settled;
    coordinator.acceptCompletion({ execute });

    expect(document.undoDepth).toBe(1);
    expect(document.text).toContain('function name(arg)');
    expect(document.text).toContain('${TM_SELECTED_TEXT}${command:run}');
    expect(execute).not.toHaveBeenCalled();
    expect(coordinator.snippet?.activePlaceholder).toBe(1);
    expect(coordinator.handleKey({ key: 'Tab' })).toBe('snippet');
    expect(coordinator.snippet?.activePlaceholder).toBe(2);
    expect(coordinator.handleKey({ key: 'Tab', shift: true })).toBe('snippet');
    expect(coordinator.snippet?.activePlaceholder).toBe(1);
    replaceText(document, 0, 0, '!');
    coordinator.documentChanged();
    expect(coordinator.snippet).toBeUndefined();
  });

  it('clips and sanitizes hostile hover and signature content with a non-color active marker', async () => {
    // Terminal popups support only inert bounded text and mark the active parameter with a glyph.
    const { coordinator, session } = createHarness('call(value)', {
      limits: { contentCharacters: 40 },
    });
    await coordinator.open();
    const hover = coordinator.requestHover({ line: 0, character: 2 }, { width: 12, height: 4 });
    session.respond(hover.requestId, {
      contents: { kind: 'markdown', value: '<img src="file:///secret"> **ok** [link](javascript:run())\u001B[31m' },
    });
    await hover.settled;
    expect(coordinator.presentation.hover).toMatchObject({ clipped: true, resourcesActive: false });
    expect(coordinator.presentation.hover?.text).not.toMatch(/<img|javascript:|\u001B/);

    const signature = coordinator.requestSignature({ line: 0, character: 6 });
    session.respond(signature.requestId, {
      signatures: [{ label: 'call(first, second)', parameters: [{ label: 'first' }, { label: 'second' }] }],
      activeSignature: 0,
      activeParameter: 1,
    });
    await signature.settled;
    expect(coordinator.presentation.signature?.lines.join('\n')).toContain('▶ second');
  });

  it('applies diagnostic version, overlap, precedence, truncation, sanitation, and clearing rules', async () => {
    // Only authoritative diagnostics for the active generation are retained in deterministic order.
    const { coordinator, document, session } = createHarness('abcd', { limits: { diagnostics: 2 } });
    await coordinator.open();
    replaceText(document, 0, 0, 'x');
    await coordinator.synchronize();
    session.publishDiagnostics(firstUri, 0, [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, message: 'stale' },
    ]);
    expect(coordinator.presentation.diagnostics.items).toHaveLength(0);

    session.publishDiagnostics(firstUri, 1, [
      { severity: 2, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, message: 'warn' },
      {
        severity: 1,
        range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
        message: 'bad\u001B[2J',
      },
      { severity: 3, range: { start: { line: 0, character: 2 }, end: { line: 0, character: 4 } }, message: 'info' },
    ]);
    expect(coordinator.presentation.diagnostics).toMatchObject({
      totalCount: 3,
      truncated: true,
    });
    expect(coordinator.presentation.diagnostics.items.map((item) => item.severity)).toEqual(['error', 'warning']);
    expect(coordinator.presentation.diagnostics.items[0]?.message).not.toContain('\u001B');
    session.publishDiagnostics(firstUri, 1, []);
    expect(coordinator.presentation.diagnostics.items).toHaveLength(0);
    await coordinator.close();
    expect(coordinator.presentation.diagnostics.totalCount).toBe(0);
  });

  it('ignores diagnostics from a prior session generation after reconnect', async () => {
    // Reconnection invalidates diagnostics from the former session even when URI and version still match.
    const { coordinator, session } = createHarness('abcd');
    await coordinator.open();
    const oldGeneration = session.generation;
    session.reconnect();
    await coordinator.resynchronize();
    session.publishDiagnostics(
      firstUri,
      0,
      [
        {
          severity: 1,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          message: 'late old-generation diagnostic',
        },
      ],
      { generation: oldGeneration },
    );
    expect(coordinator.presentation.diagnostics.items).toHaveLength(0);
  });
});

describe('LSP navigation, formatting, and host authority', () => {
  it('reveals local targets, chooses among many, and emits foreign navigation without reading it', async () => {
    // Current-document navigation is local; multiple results use a chooser and foreign resources stay host-owned.
    const { coordinator, document, effects, session } = createHarness('alpha\nbeta\n');
    await coordinator.open();
    const local = coordinator.requestDefinition({ line: 0, character: 1 });
    session.respond(local.requestId, [
      { uri: firstUri, range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } } },
    ]);
    await local.settled;
    expect(document.selection).toMatchObject({ anchor: 6, head: 6 });

    const many = coordinator.requestDefinition({ line: 0, character: 1 });
    session.respond(many.requestId, [
      { uri: firstUri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
      { uri: secondUri, range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } } },
    ]);
    await many.settled;
    expect(coordinator.presentation.navigationChooser?.items).toHaveLength(2);
    await coordinator.chooseNavigationTarget(1);
    expect(effects.at(-1)).toMatchObject({ kind: 'navigate', targetUri: secondUri, focus: true });

    const symbols = coordinator.requestDocumentSymbols();
    session.respond(symbols.requestId, [
      {
        name: 'alpha',
        kind: 12,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      },
    ]);
    await symbols.settled;
    expect(coordinator.presentation.symbolChooser?.items[0]?.label).toBe('alpha');
  });

  it.each([
    [
      'overlapping',
      [
        { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, newText: 'a' },
        { range: { start: { line: 0, character: 2 }, end: { line: 0, character: 4 } }, newText: 'b' },
      ],
    ],
    ['out-of-range', [{ range: { start: { line: 9, character: 0 }, end: { line: 9, character: 1 } }, newText: 'x' }]],
    [
      'oversized',
      [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: 'x'.repeat(2_000_000) }],
    ],
  ])('rejects %s formatting atomically', async (_label, edits) => {
    // Invalid formatting never partially changes the active document.
    const { coordinator, document, session } = createHarness('let x=1;\n');
    await coordinator.open();
    const operation = coordinator.formatDocument();
    session.respond(operation.requestId, edits);
    await operation.settled;
    expect(document.text).toBe('let x=1;\n');
    expect(document.undoDepth).toBe(0);
  });

  it('accepts only current local formatting as one undo unit and rejects stale, foreign, and read-only work', async () => {
    // Formatting is an atomic mutation tied to the initiating identity and active URI.
    const valid = createHarness('let x=1;\n');
    await valid.coordinator.open();
    const format = valid.coordinator.formatDocument();
    valid.session.respond(format.requestId, [
      { range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } }, newText: ' ' },
    ]);
    await format.settled;
    expect(valid.document.text).toBe('let x =1;\n');
    expect(valid.document.undoDepth).toBe(1);

    for (const mode of ['stale', 'foreign', 'read-only'] as const) {
      const harness = createHarness('let x=1;\n', { readOnly: mode === 'read-only' });
      await harness.coordinator.open();
      const pending = harness.coordinator.formatDocument();
      if (mode === 'stale') {
        replaceText(harness.document, 0, 0, 'x');
        await harness.coordinator.synchronize();
      } else if (mode === 'foreign') {
        await harness.coordinator.setUri(secondUri);
      }
      const before = harness.document.text;
      harness.session.respond(pending.requestId, [
        { range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } }, newText: ' ' },
      ]);
      await pending.settled;
      expect(harness.document.text).toBe(before);
    }
  });

  it('keeps format-on-save off by default and saves current text after timeout, failure, or stale output', async () => {
    // Save never becomes unavailable: only a valid current opt-in format changes the submitted revision.
    const plain = createHarness('let x=1;\n');
    await plain.coordinator.open();
    expect(await plain.coordinator.save()).toMatchObject({ text: 'let x=1;\n', formatting: 'disabled' });
    expect(plain.session.requests).toHaveLength(0);

    const formatted = createHarness('let x=1;\n', { formatOnSave: true });
    await formatted.coordinator.open();
    const save = formatted.coordinator.save();
    const request = formatted.session.requests.at(-1);
    expect(request?.method).toBe('textDocument/formatting');
    formatted.session.respond(request?.id, [
      { range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } }, newText: ' ' },
    ]);
    expect(await save).toMatchObject({ text: 'let x =1;\n', formatting: 'applied' });

    for (const outcome of ['timeout', 'failure', 'stale'] as const) {
      const harness = createHarness('let x=1;\n', { formatOnSave: true });
      await harness.coordinator.open();
      const pendingSave = harness.coordinator.save();
      const pendingRequest = harness.session.requests.at(-1);
      if (outcome === 'timeout') harness.session.timeout(pendingRequest?.id);
      if (outcome === 'failure') harness.session.fail(pendingRequest?.id, new Error('server failed'));
      if (outcome === 'stale') {
        replaceText(harness.document, 0, 0, 'x');
        harness.session.respond(pendingRequest?.id, []);
      }
      const result = await pendingSave;
      expect(result.text).toBe(harness.document.text);
      expect(result.formatting).toBe(outcome);
    }
  });

  it('requires host transaction and command allowlist authorization without direct effects', async () => {
    // Cross-document edits and commands remain inert unless the typed host boundary authorizes them.
    const host = vi.fn(async (effect: CodeEditorHostEffect) => effect.kind === 'workspace-edit');
    const { coordinator, document, effects } = createHarness('value', { host });
    await coordinator.open();
    const before = document.text;
    await coordinator.proposeWorkspaceEdit({
      changes: {
        [secondUri]: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: 'x' }],
      },
    });
    expect(document.text).toBe(before);
    expect(effects.at(-1)).toMatchObject({ kind: 'workspace-edit', atomic: true });

    await coordinator.forwardCommand({ title: 'build', command: 'workspace.build', arguments: ['--safe'] });
    expect(host).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'command-authorization' }));
    expect(document.text).toBe(before);
  });
});

describe('LSP hostile input and degradation', () => {
  it('enables commands only when both language and negotiated session capabilities support them', async () => {
    // Unsupported language-service commands stay disabled and do not send protocol requests.
    const document = createDocumentModel({ text: 'value', uri: firstUri, languageId: 'typescript' });
    const session = createInProcessLspSession({
      capabilities: { completion: false, hover: true, documentFormatting: false },
    });
    const coordinator = createCodeEditorLspCoordinator({
      document,
      session,
      uri: firstUri,
      languageId: 'typescript',
    });
    await coordinator.open();
    expect(coordinator.commandAvailability).toMatchObject({
      completion: false,
      hover: true,
      documentFormatting: false,
    });

    const completion = coordinator.requestCompletion({ line: 0, character: 1 });
    const formatting = coordinator.formatDocument();
    expect(await completion.settled).toMatchObject({ outcome: 'unavailable' });
    expect(await formatting.settled).toMatchObject({ outcome: 'unavailable' });
    expect(session.requests).toHaveLength(0);
  });

  it('rejects or bounds malformed envelopes, URIs, ranges, snippets, Markdown, floods, nesting, and controls', async () => {
    // Untrusted protocol values cannot escape hard bounds or emit active terminal controls.
    const { coordinator, document, session } = createHarness('x', {
      limits: { completionItems: 3, contentCharacters: 24 },
    });
    await coordinator.open();
    for (const envelope of [
      null,
      { jsonrpc: '1.0', id: {}, result: [] },
      { jsonrpc: '2.0', method: '__proto__', params: { uri: 'file:///../secret' } },
      { jsonrpc: '2.0', id: 1, result: { nested: { nested: { nested: { nested: {} } } } } },
    ]) {
      expect(() => session.deliverEnvelope(envelope)).not.toThrow();
    }
    const completion = coordinator.requestCompletion({ line: 0, character: 1 });
    session.respond(completion.requestId, {
      items: Array.from({ length: 1000 }, (_, index) => ({
        label: `item${index}\u001B]52;c;secret\u0007`,
        insertText: '${1:${2:${3:${4:${5:x}}}}}',
      })),
    });
    await completion.settled;
    expect(coordinator.presentation.completion?.items).toHaveLength(3);
    expect(JSON.stringify(coordinator.presentation)).not.toMatch(/\u001B|\u0007|secret/);
    expect(document.text).toBe('x');
  });

  it('preserves local work and reports pending, degraded, timeout, and recovery accurately', async () => {
    // An absent or unhealthy service never blocks editing, local features, save, or close.
    const clock = createDeterministicClock();
    const { coordinator, document, session } = createHarness('alpha', { clock });
    await coordinator.open();
    const hover = coordinator.requestHover({ line: 0, character: 1 });
    expect(coordinator.operationState).toBe('waiting');
    await clock.advanceBy(151);
    expect(coordinator.operationState).toBe('pending');
    await clock.advanceBy(4_849);
    expect(await hover.settled).toMatchObject({ outcome: 'timeout' });
    expect(coordinator.serviceState).toBe('degraded');

    replaceText(document, 0, 5, 'beta');
    expect(coordinator.localCapabilities).toMatchObject({
      editing: true,
      parsing: true,
      search: true,
      gutter: true,
      status: true,
      save: true,
      close: true,
    });
    expect((await coordinator.save()).text).toBe('beta');
    session.reconnect();
    expect(coordinator.serviceState).toBe('connecting');
    await coordinator.resynchronize();
    expect(coordinator.serviceState).toBe('ready');
    await coordinator.close();
    expect(coordinator.closed).toBe(true);

    const absent = createCodeEditorLspCoordinator({
      document: createDocumentModel({ text: 'plain', uri: firstUri }),
      uri: firstUri,
      languageId: 'plain',
    });
    expect(absent.serviceState).toBe('plain');
    expect((await absent.save()).text).toBe('plain');
    await absent.close();
    expect(absent.closed).toBe(true);
  });
});
