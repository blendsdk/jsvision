import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
} from '../index.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

/** Creates a line-number editor with every presentation capability enabled. */
async function createPresentationHarness() {
  const document = createDocumentModel({
    text: 'call(first)\nnext',
    uri: 'file:///workspace/presentation.ts',
    languageId: 'typescript',
  });
  const session = createInProcessLspSession({
    capabilities: {
      hover: true,
      signatureHelp: true,
      signatureTriggers: ['('],
      diagnostics: true,
    },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///workspace/presentation.ts',
    languageId: 'typescript',
    limits: { contentCharacters: 48, diagnostics: 2 },
  });
  const controller = createCodeEditorController({ document, lsp: coordinator });
  const editor = new CodeEditor({ controller, lineNumbers: true });
  editor.focus();
  await coordinator.open();
  return { controller, coordinator, document, editor, session };
}

describe('hover and signature terminal presentation', () => {
  it('should show bounded inert hover and dismiss it when caret context changes', async () => {
    // Hover content must be terminal-safe, clipped near the caret, and invalidated by caret movement.
    const { coordinator, editor, session } = await createPresentationHarness();
    const operation = coordinator.requestHover({ line: 0, character: 2 }, { width: 14, height: 3 });
    session.respond(operation.requestId, {
      contents: {
        kind: 'markdown',
        value: '<img src="file:///secret"> **safe documentation** [run](javascript:run())\u001B[2J',
      },
    });
    await operation.settled;

    expect(editor.assistanceView.state.visible).toBe(true);
    expect(editor.assistanceView.items.join('\n')).toContain('safe documentation');
    expect(editor.assistanceView.items.join('\n')).not.toMatch(/file:\/\/|javascript:|\u001B/);
    expect(editor.assistanceView.layout.rect).toMatchObject({ y: 1 });
    editor.routeKey({ key: 'ArrowRight' });
    expect(editor.assistanceView.state.visible).toBe(false);
    expect(editor.focusState).toBe('focused');
  });

  it('should request trigger-driven signature help and expose its active parameter without color', async () => {
    // Typing a negotiated trigger must display a non-color active-parameter marker in the popup.
    const { document, editor, session } = await createPresentationHarness();
    document.setSelection({ anchor: 4, head: 4 });
    editor.routeKey({ key: '(', text: '(' });
    expect(session.requests.at(-1)?.method).toBe('textDocument/signatureHelp');
    const request = session.requests.at(-1);
    session.respond(request?.id, {
      signatures: [
        {
          label: 'call(first, second)',
          parameters: [{ label: 'first' }, { label: 'second' }],
        },
      ],
      activeSignature: 0,
      activeParameter: 1,
    });
    await Promise.resolve();

    expect(editor.assistanceView.state.visible).toBe(true);
    expect(editor.assistanceView.items.join('\n')).toContain('▶ second');
    expect(editor.routeKey({ key: 'Escape' })).toEqual({ handled: true, owner: 'dismissal' });
    expect(editor.assistanceView.state.visible).toBe(false);
  });
});

describe('diagnostic terminal presentation', () => {
  it('should style ranges and gutter severity without obscuring selection or caret', async () => {
    // Diagnostics must remain perceivable without color while selection and caret keep visual precedence.
    const { controller, document, editor, session } = await createPresentationHarness();
    document.setSelection({ anchor: 0, head: 4 });
    session.publishDiagnostics('file:///workspace/presentation.ts', 0, [
      {
        severity: 1,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } },
        message: 'error\u001B[2J',
      },
    ]);
    await Promise.resolve();
    const frame = editor.project({ width: 28, height: 4, caps });
    const selected = frame.cellAtDocumentOffset(0);
    const firstRow = frame.cells[0]?.map((cell) => cell.text).join('') ?? '';

    expect(controller.presentation.assistance.diagnostics.items).toHaveLength(1);
    expect(selected).toMatchObject({ role: 'selection' });
    expect(selected?.overlays).toContain('diagnostic.error');
    expect(frame.caret.visible).toBe(true);
    expect(firstRow).toMatch(/[E!]/u);
  });

  it('should navigate diagnostics in order and show sanitized bounded detail', async () => {
    // F8 and Shift+F8 must wrap ordered diagnostics and expose inert detail without trapping focus.
    const { document, editor, session } = await createPresentationHarness();
    session.publishDiagnostics('file:///workspace/presentation.ts', 0, [
      {
        severity: 2,
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
        message: 'second warning',
      },
      {
        severity: 1,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } },
        message: 'first\u001B[31m <img src="file:///secret">',
      },
    ]);
    await Promise.resolve();

    expect(editor.routeKey({ key: 'F8' })).toEqual({ handled: true, owner: 'editor' });
    expect(Number(document.selection.head)).toBe(0);
    expect(editor.assistanceView.items.join('\n')).toContain('first');
    expect(editor.assistanceView.items.join('\n')).not.toMatch(/\u001B|file:\/\//);
    expect(editor.routeKey({ key: 'F8' })).toEqual({ handled: true, owner: 'editor' });
    expect(Number(document.selection.head)).toBe(document.text.indexOf('next'));
    expect(editor.routeKey({ key: 'F8', shift: true })).toEqual({ handled: true, owner: 'editor' });
    expect(Number(document.selection.head)).toBe(0);
  });
});
