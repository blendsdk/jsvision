import { describe, expect, it, vi } from 'vitest';

import {
  CodeEditor,
  CodeEditorKeyBindingConflictError,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  registerCodeEditorKeyBindings,
  type CodeEditorDisposable,
  type CodeEditorMutationInput,
  type CodeEditorMutationSink,
  type CodeEditorOptions,
  type DocumentIdentity,
  type LocalLanguageResult,
} from './index.js';

type ConfiguredCommand = NonNullable<CodeEditorOptions['keyBindings']>[string];

/** Creates a real coordinator whose asynchronous state can be driven deterministically. */
function createCoordinatorHarness() {
  const document = createDocumentModel({
    text: 'value',
    uri: 'file:///workspace/integration.ts',
    languageId: 'typescript',
  });
  const session = createInProcessLspSession({
    capabilities: { diagnostics: true, documentFormatting: true },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///workspace/integration.ts',
    languageId: 'typescript',
  });
  return { coordinator, document, session };
}

describe('integration foundation lifecycle', () => {
  it('should isolate failures and release listeners when subscriptions are disposed', () => {
    const { coordinator, session } = createCoordinatorHarness();
    const survivingListener = vi.fn();
    const subscriptions: CodeEditorDisposable[] = [
      coordinator.subscribeState(() => {
        throw new Error('listener failure');
      }),
      coordinator.subscribeState(survivingListener),
    ];
    for (let index = subscriptions.length; index < 16; index += 1) {
      subscriptions.push(coordinator.subscribeState(() => undefined));
    }

    expect(() => coordinator.subscribeState(() => undefined)).toThrow(RangeError);
    session.publishDiagnostics('file:///workspace/integration.ts', 0, [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        message: 'diagnostic',
      },
    ]);
    expect(survivingListener).toHaveBeenCalledTimes(1);

    for (const subscription of subscriptions) {
      subscription.dispose();
      subscription.dispose();
    }
  });

  it('should release exact-document ownership when a mutation binding is disposed', () => {
    const { coordinator, document } = createCoordinatorHarness();
    const foreignDocument = createDocumentModel({ text: '', languageId: 'plain' });
    const foreignSink: CodeEditorMutationSink = {
      document: foreignDocument,
      apply: () => Object.freeze({ accepted: false, reason: 'invalid-edit' }),
    };
    expect(() => coordinator.bindMutationSink(foreignSink)).toThrow(TypeError);

    const sink: CodeEditorMutationSink = {
      document,
      apply: () => Object.freeze({ accepted: false, reason: 'read-only' }),
    };
    const binding = coordinator.bindMutationSink(sink);
    expect(() => coordinator.bindMutationSink(sink)).toThrow(/already has a mutation sink/u);
    binding.dispose();
    binding.dispose();
    expect(() => coordinator.bindMutationSink(sink)).not.toThrow();
  });

  it('should reject manual completion when its document revision is stale', () => {
    const document = createDocumentModel({
      text: 'con',
      uri: 'file:///workspace/stale.ts',
      languageId: 'typescript',
    });
    const controller = createCodeEditorController({ document });
    const editor = new CodeEditor({ controller });
    editor.openCompletion([{ label: 'console', insertText: 'console' }]);
    expect(
      controller.applyMutation({
        base: document.identity,
        edits: [{ range: { from: 0, to: 0 }, text: 'x' }],
        origin: 'external',
      }),
    ).toEqual({ accepted: true });

    expect(controller.routeAssistanceKey({ key: 'Enter' })).toBe('unhandled');
    expect(document.text).toBe('xcon');
    expect(controller.presentation.assistance.completion).toBeUndefined();
  });

  it('should coalesce protocol synchronization when mutations arrive in one synchronous burst', async () => {
    const { coordinator, document, session } = createCoordinatorHarness();
    const controller = createCodeEditorController({ document, lsp: coordinator });
    await coordinator.open();
    const notificationStart = session.notifications.length;

    for (let index = 0; index < 1_000; index += 1) {
      expect(controller.replaceSelection('x')).toBe(true);
    }
    await Promise.resolve();
    await Promise.resolve();

    const changes = session.notifications
      .slice(notificationStart)
      .filter((notification) => notification.method === 'textDocument/didChange');
    expect(changes.length).toBeLessThanOrEqual(2);
    expect(changes.at(-1)?.params.textDocument).toMatchObject({
      version: Number(document.identity.revision),
    });
  });

  it('should publish every accepted mutation when operations are consecutive', async () => {
    const document = createDocumentModel({ text: '', languageId: 'plain' });
    const controller = createCodeEditorController({ document });
    const revisions: number[] = [];
    controller.subscribe((event) => {
      if (event.kind === 'document') revisions.push(Number(event.mutation.after.revision));
    });

    expect(controller.replaceSelection('a')).toBe(true);
    expect(controller.replaceSelection('b')).toBe(true);
    await Promise.resolve();

    expect(revisions).toEqual([1, 2]);
  });

  it('should release mutation ownership when controller subscription setup fails', () => {
    const { coordinator } = createCoordinatorHarness();
    const subscriptions = Array.from({ length: 16 }, () => coordinator.subscribeState(() => undefined));

    expect(() =>
      createCodeEditorController({
        document: coordinator.document,
        lsp: coordinator,
      }),
    ).toThrow(RangeError);

    subscriptions.pop()?.dispose();
    const controller = createCodeEditorController({
      document: coordinator.document,
      lsp: coordinator,
    });
    controller.dispose();
    for (const subscription of subscriptions) subscription.dispose();

    const occupied = createCoordinatorHarness();
    const binding = occupied.coordinator.bindMutationSink({
      document: occupied.document,
      apply: () => Object.freeze({ accepted: false, reason: 'read-only' }),
    });
    expect(() =>
      createCodeEditorController({
        document: occupied.document,
        lsp: occupied.coordinator,
      }),
    ).toThrow(/already has a mutation sink/u);
    const unaffectedSubscriptions = Array.from({ length: 16 }, () =>
      occupied.coordinator.subscribeState(() => undefined),
    );
    binding.dispose();
    for (const subscription of unaffectedSubscriptions) subscription.dispose();
  });

  it('should release coordinator handles when later controller initialization fails', () => {
    const { coordinator, document } = createCoordinatorHarness();
    const result: LocalLanguageResult = {
      syntax: [],
      folds: [],
      brackets: [],
      get identity(): DocumentIdentity {
        throw new Error('hostile adapter result');
      },
      adapterId: 'typescript',
      generation: 1,
      state: 'ready',
    };

    expect(() => createCodeEditorController({ document, lsp: coordinator, languageResult: result })).toThrow(
      /hostile adapter result/u,
    );
    const controller = createCodeEditorController({ document, lsp: coordinator });
    controller.dispose();
  });

  it('should reject hostile mutation accessors without invoking them', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({ text: '', languageId: 'plain' }),
    });
    const editsGetter = vi.fn(() => {
      throw new Error('host code must remain inert');
    });
    const input: CodeEditorMutationInput = {
      get edits() {
        return editsGetter();
      },
      origin: 'external',
    };

    expect(controller.applyMutation(input)).toEqual({ accepted: false, reason: 'invalid-edit' });
    expect(editsGetter).not.toHaveBeenCalled();
  });

  it('should detach published snapshots when mutable presentation sources change', () => {
    const { coordinator } = createCoordinatorHarness();
    const items = [{ label: 'first' }];
    coordinator.presentation = {
      diagnostics: { items: [], totalCount: 0, truncated: false, versioned: true },
      completion: {
        items,
        selected: 0,
        filter: '',
        lineage: coordinator.document.identity.lineage,
        revision: 0,
        sessionGeneration: 1,
        coordinatorGeneration: 1,
      },
    };
    const published = coordinator.state;

    items[0]!.label = 'changed';
    items.push({ label: 'second' });

    expect(published.presentation.completion?.items).toEqual([{ label: 'first' }]);
    expect(Object.isFrozen(published.presentation.completion?.items[0])).toBe(true);
  });

  it('should bound dense and sparse compatibility presentation arrays', () => {
    const { coordinator } = createCoordinatorHarness();
    const dense = Array.from({ length: 10_000 }, (_, index) => ({ label: `item-${index}` }));
    coordinator.presentation = {
      diagnostics: { items: [], totalCount: 0, truncated: false, versioned: true },
      completion: {
        items: dense,
        selected: 0,
        filter: '',
        lineage: coordinator.document.identity.lineage,
        revision: 0,
        sessionGeneration: 1,
        coordinatorGeneration: 1,
      },
    };
    expect(coordinator.state.presentation.completion?.items).toHaveLength(12);

    const sparse = new Array<{ label: string }>(10_000);
    sparse[9_999] = { label: 'late' };
    coordinator.presentation = {
      diagnostics: { items: [], totalCount: 0, truncated: false, versioned: true },
      completion: {
        items: sparse,
        selected: 0,
        filter: '',
        lineage: coordinator.document.identity.lineage,
        revision: 0,
        sessionGeneration: 1,
        coordinatorGeneration: 1,
      },
    };
    expect(coordinator.state.presentation.completion).toBeUndefined();
  });
});

describe('keybinding input hardening', () => {
  it('should reject accessor-backed records without invoking host code', () => {
    const getter = vi.fn(() => 'assist');
    const bindings: Record<string, ConfiguredCommand> = Object.create(null);
    Object.defineProperty(bindings, 'Ctrl+K', { enumerable: true, get: getter });
    const controller = createCodeEditorController({
      document: createDocumentModel({ text: '', languageId: 'plain' }),
    });

    expect(() => new CodeEditor({ controller, keyBindings: bindings })).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
  });

  it('should reject canonical custom conflicts and unused overrides', () => {
    const createController = () =>
      createCodeEditorController({
        document: createDocumentModel({ text: '', languageId: 'plain' }),
      });

    expect(
      () =>
        new CodeEditor({
          controller: createController(),
          keyBindings: { 'ctrl+j': 'assist', 'CTRL+J': 'save' },
        }),
    ).toThrow(CodeEditorKeyBindingConflictError);
    expect(
      () =>
        new CodeEditor({
          controller: createController(),
          keyBindings: { 'Ctrl+J': 'assist' },
          keyBindingOverrides: { 'Ctrl+F': 'search.open' },
        }),
    ).toThrow(CodeEditorKeyBindingConflictError);
  });

  it('should reject conflicting canonical defaults instead of overwriting them', () => {
    expect(() => registerCodeEditorKeyBindings({ 'ctrl+j': 'assist', 'CTRL+J': 'save' }, undefined, undefined)).toThrow(
      CodeEditorKeyBindingConflictError,
    );
  });
});
