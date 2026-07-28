import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it, vi } from 'vitest';

import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
} from '../index.js';

const uri = 'file:///workspace/presentation-lifecycle.ts';
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'mono', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

/** Creates a real editor with deliberately small presentation limits. */
async function createPresentationHarness() {
  const document = createDocumentModel({ text: 'value', uri, languageId: 'typescript' });
  const session = createInProcessLspSession({ capabilities: { hover: true } });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri,
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({
    document,
    lsp: coordinator,
    limits: { completionItems: 3, popupWidth: 24 },
  });
  const editor = new CodeEditor({ controller });
  await coordinator.open();
  return { controller, coordinator, editor, session };
}

describe('language-intelligence presentation hardening', () => {
  it('should bound hostile multiline overlays before the terminal view retains them', async () => {
    const { controller, coordinator, editor, session } = await createPresentationHarness();
    const hover = coordinator.requestHover({ line: 0, character: 1 });
    session.respond(hover.requestId, {
      contents: {
        kind: 'markdown',
        value: Array.from(
          { length: 1_000 },
          (_, index) => `<img src="file:///secret-${index}"> row-${index}\u001B[2J`,
        ).join('\n'),
      },
    });
    await hover.settled;

    expect(controller.presentation.assistance.overlay?.items).toHaveLength(3);
    expect(Object.isFrozen(controller.presentation.assistance.overlay?.items)).toBe(true);
    expect(editor.assistanceView.items).toHaveLength(3);
    expect(editor.assistanceView.items.join('\n')).not.toMatch(/file:\/\/|\u001B/u);
  });

  it('should expose hover and document symbols through canonical editor keys', async () => {
    const document = createDocumentModel({ text: 'value', uri, languageId: 'typescript' });
    const session = createInProcessLspSession({ capabilities: { hover: true, documentSymbols: true } });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    const editor = new CodeEditor({ controller: createCodeEditorController({ document, lsp: coordinator }) });
    await coordinator.open();

    expect(editor.routeKey({ key: 'h', ctrl: true, shift: true })).toEqual({ handled: true, owner: 'editor' });
    expect(session.requests.at(-1)?.method).toBe('textDocument/hover');
    expect(editor.routeKey({ key: 'o', ctrl: true, shift: true })).toEqual({ handled: true, owner: 'editor' });
    expect(session.requests.at(-1)?.method).toBe('textDocument/documentSymbol');
  });

  it('should follow an off-screen snippet placeholder and keep the editor focused', async () => {
    const document = createDocumentModel({ text: '', uri, languageId: 'typescript' });
    const session = createInProcessLspSession({ capabilities: { completion: true } });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    const controller = createCodeEditorController({ document, lsp: coordinator });
    const editor = new CodeEditor({ controller });
    editor.resizeViewport(20, 3);
    editor.focus();
    await coordinator.open();

    const completion = coordinator.requestCompletion({ line: 0, character: 0 });
    session.respond(completion.requestId, {
      items: [
        {
          label: 'snippet',
          insertTextFormat: 'snippet',
          insertText: '${1:first}\nline\nline\nline\nline\n${2:second}${0}',
        },
      ],
    });
    await completion.settled;
    editor.routeKey({ key: 'Enter' });
    editor.routeKey({ key: 'Tab' });

    expect(editor.scroll.y()).toBeGreaterThan(0);
    expect(editor.focusState).toBe('focused');
  });

  it('should preserve fold and diagnostic severity markers on the same monochrome line', async () => {
    const text = 'function value() {\n  return 1;\n}';
    const document = createDocumentModel({ text, uri, languageId: 'typescript' });
    const session = createInProcessLspSession({ capabilities: { diagnostics: true } });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    const controller = createCodeEditorController({ document, lsp: coordinator });
    controller.setLanguageResult({
      identity: document.identity,
      adapterId: 'typescript',
      generation: 1,
      state: 'ready',
      syntax: [],
      folds: [{ from: Number(document.snapshot.line(0).from), to: Number(document.snapshot.line(2).to) }],
      brackets: [],
    });
    const editor = new CodeEditor({ controller, lineNumbers: true });
    await coordinator.open();
    session.publishDiagnostics(uri, 0, [
      {
        severity: 1,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
        message: 'error',
      },
    ]);
    await Promise.resolve();

    const gutter = editor.project({ width: 30, height: 3, caps }).cells[0]?.slice(0, 3) ?? [];
    expect(gutter.map((cell) => cell.text).join('')).toMatch(/E[▼v]/u);
    expect(gutter.map((cell) => cell.role)).toContain('diagnostic.error');
    expect(gutter.map((cell) => cell.role)).toContain('fold');
  });

  it('should release popup resources and suppress late notifications after disposal', async () => {
    const { controller, coordinator, editor, session } = await createPresentationHarness();
    const listener = vi.fn();
    controller.subscribe(listener);
    const hover = coordinator.requestHover({ line: 0, character: 1 });

    editor.dispose();
    session.respond(hover.requestId, { contents: 'late result' });
    await hover.settled;
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
    expect(editor.retainedState).toEqual({
      completionItems: 0,
      popupRows: 0,
      snippetPlaceholders: 0,
      pendingHostEffects: 0,
    });
    expect(controller.retainedState).toMatchObject({
      diagnostics: 0,
      completions: 0,
      symbols: 0,
      requests: 0,
    });
  });
});
