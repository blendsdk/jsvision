import { describe, expect, it, vi } from 'vitest';

import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  type CodeEditorHostEffect,
} from '../index.js';

/** Creates a real editor with navigation, symbol, and formatting capabilities. */
async function createIntelligenceHarness(text = 'alpha\nbeta\n', readOnly = false) {
  const document = createDocumentModel({
    text,
    uri: 'file:///workspace/main.ts',
    languageId: 'typescript',
    readOnly,
  });
  const session = createInProcessLspSession({
    capabilities: {
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
    uri: 'file:///workspace/main.ts',
    languageId: 'typescript',
    host: async (effect) => {
      effects.push(effect);
      return true;
    },
  });
  const controller = createCodeEditorController({ document, lsp: coordinator });
  const editor = new CodeEditor({ controller });
  editor.focus();
  await coordinator.open();
  return { controller, coordinator, document, editor, effects, session };
}

describe('definition and symbol navigation', () => {
  it('should choose validated targets locally or through the host and navigate back', async () => {
    // Same-document navigation moves only the caret; cross-document navigation remains host-authorized.
    const { coordinator, document, editor, effects, session } = await createIntelligenceHarness();
    document.setSelection({ anchor: 2, head: 2 });
    const operation = coordinator.requestDefinition({ line: 0, character: 2 });
    session.respond(operation.requestId, [
      {
        uri: 'file:///workspace/main.ts',
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
      },
      {
        uri: 'file:///workspace/other.ts',
        range: { start: { line: 3, character: 1 }, end: { line: 3, character: 2 } },
      },
    ]);
    await operation.settled;

    expect(editor.assistanceView.items).toHaveLength(2);
    expect(editor.routeKey({ key: 'Enter' })).toEqual({ handled: true, owner: 'completion' });
    expect(Number(document.selection.head)).toBe(document.text.indexOf('beta'));
    expect(effects).toHaveLength(0);
    expect(editor.routeKey({ key: 'ArrowLeft', alt: true })).toEqual({ handled: true, owner: 'editor' });
    expect(Number(document.selection.head)).toBe(2);

    const external = coordinator.requestDefinition({ line: 0, character: 2 });
    session.respond(external.requestId, [
      {
        uri: 'file:///workspace/main.ts',
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
      },
      {
        uri: 'file:///workspace/other.ts',
        range: { start: { line: 3, character: 1 }, end: { line: 3, character: 2 } },
      },
    ]);
    await external.settled;
    editor.routeKey({ key: 'ArrowDown' });
    editor.routeKey({ key: 'Enter' });
    await Promise.resolve();
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ kind: 'navigate', targetUri: 'file:///workspace/other.ts' });
    expect(Number(document.selection.head)).toBe(2);
  });

  it('should present bounded symbols and return to the previous caret', async () => {
    // Document symbols use the same chooser controls and preserve a bounded local back target.
    const { coordinator, document, editor, session } = await createIntelligenceHarness();
    document.setSelection({ anchor: 1, head: 1 });
    const operation = coordinator.requestDocumentSymbols();
    session.respond(operation.requestId, [
      {
        name: 'beta',
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
        selectionRange: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
      },
    ]);
    await operation.settled;

    expect(editor.assistanceView.items).toEqual(['beta']);
    editor.routeKey({ key: 'Enter' });
    expect(Number(document.selection.head)).toBe(document.text.indexOf('beta'));
    editor.routeKey({ key: 'ArrowLeft', alt: true });
    expect(Number(document.selection.head)).toBe(1);
  });
});

describe('document and range formatting', () => {
  it('should choose range formatting for a selection and apply one current atomic mutation', async () => {
    // Formatting a selection must send its exact protocol range and create one revision and undo unit.
    const { document, editor, session } = await createIntelligenceHarness('let x=1;\nlet y=2;\n');
    document.setSelection({ anchor: 0, head: 8 });
    const beforeRevision = Number(document.identity.revision);
    editor.execute('format');
    const request = session.requests.at(-1);
    expect(request?.method).toBe('textDocument/rangeFormatting');
    expect(request?.params).toMatchObject({
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 8 },
      },
    });
    session.respond(request?.id, [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
        newText: 'let x = 1;',
      },
    ]);
    await Promise.resolve();

    expect(document.text).toBe('let x = 1;\nlet y=2;\n');
    expect(Number(document.identity.revision)).toBe(beforeRevision + 1);
    expect(document.undoDepth).toBe(1);
  });

  it('should reject invalid, overlapping, stale, excessive, and read-only formatting', async () => {
    // Invalid provider formatting must leave text, identity, history, and callbacks unchanged.
    const scenarios: readonly unknown[] = [
      [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
          newText: 'one',
        },
        {
          range: { start: { line: 0, character: 2 }, end: { line: 0, character: 5 } },
          newText: 'two',
        },
      ],
      [
        {
          range: { start: { line: -1, character: 0 }, end: { line: 0, character: 1 } },
          newText: 'invalid',
        },
      ],
    ];
    for (const result of scenarios) {
      const harness = await createIntelligenceHarness();
      const changed = vi.fn();
      const editor = new CodeEditor({ controller: harness.controller, onDocumentChange: changed });
      const before = {
        text: harness.document.text,
        identity: harness.document.identity,
        undoDepth: harness.document.undoDepth,
      };
      editor.execute('format');
      harness.session.respond(harness.session.requests.at(-1)?.id, result);
      await Promise.resolve();
      expect({
        text: harness.document.text,
        identity: harness.document.identity,
        undoDepth: harness.document.undoDepth,
      }).toEqual(before);
      expect(changed).not.toHaveBeenCalled();
    }

    const locked = await createIntelligenceHarness('alpha\n', true);
    locked.editor.execute('format');
    expect(locked.session.requests.at(-1)?.method).not.toBe('textDocument/formatting');
    expect(locked.document.undoDepth).toBe(0);
  });
});
