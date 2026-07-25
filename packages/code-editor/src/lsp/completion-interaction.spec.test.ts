import { describe, expect, it } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createRenderRoot } from '@jsvision/ui';

import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
} from '../index.js';

/** Creates a real editor wired to the deterministic in-process protocol session. */
async function createCompletionHarness(text = 'fn\n', readOnly = false) {
  const document = createDocumentModel({
    text,
    uri: 'file:///workspace/completion.ts',
    languageId: 'typescript',
    readOnly,
  });
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      completionTriggers: ['.'],
    },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///workspace/completion.ts',
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({ document, lsp: coordinator });
  const editor = new CodeEditor({ controller });
  editor.focus();
  await coordinator.open();
  return { controller, coordinator, document, editor, session };
}

describe('completion and snippet interaction', () => {
  it('should frame the completion popup with a single border and drop shadow', async () => {
    // Completion choices must read as one distinct dropdown instead of blending into source text.
    const { editor } = await createCompletionHarness();
    const capabilities = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { unicode: { utf8: true }, glyphs: { boxDrawing: true } },
    }).profile;
    const root = createRenderRoot({ width: 40, height: 14 }, { caps: capabilities });
    root.mount(editor);
    editor.assistanceView.show(['greet', 'format']);
    root.flush();
    const rows = root
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''));

    expect(editor.assistanceView.castsShadow).toBe(true);
    expect(rows.some((row) => row.includes('┌') && row.includes('┐'))).toBe(true);
    expect(rows.some((row) => row.includes('│greet'))).toBe(true);
    expect(rows.some((row) => row.includes('└') && row.includes('┘'))).toBe(true);
  });

  it('should navigate visible provider rows and accept all edits as one inert undo unit', async () => {
    // Provider completion must share the visible popup, keyboard precedence, and one atomic document mutation.
    const { controller, document, editor, session } = await createCompletionHarness();
    controller.requestAssistance();
    const request = session.requests.at(-1);
    session.respond(request?.id, {
      items: [
        { label: 'first', insertText: 'first' },
        {
          label: 'function',
          textEdit: {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } },
            newText: 'function',
          },
          additionalTextEdits: [
            {
              range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
              newText: '// generated\n',
            },
          ],
          insertTextFormat: 'snippet',
          insertText: 'function ${1:name}(${2:arg}) {\n  ${0}\n}${command:run}',
          command: { title: 'must remain inert', command: 'shell.run' },
        },
      ],
    });
    await Promise.resolve();

    expect(editor.assistanceView.state.visible).toBe(true);
    expect(editor.assistanceView.items).toEqual(['first', 'function']);
    expect(editor.routeKey({ key: 'ArrowDown' })).toEqual({ handled: true, owner: 'completion' });
    expect(editor.assistanceView.selected).toBe(1);
    expect(editor.routeKey({ key: 'Enter' })).toEqual({ handled: true, owner: 'completion' });
    expect(document.undoDepth).toBe(1);
    expect(document.text).toContain('function name(arg)');
    expect(document.text).toContain('// generated');
    expect(document.text).toContain('${command:run}');
    expect(editor.assistanceView.state.visible).toBe(false);
    expect(controller.snippets.some((range) => range.active)).toBe(true);

    const firstPlaceholder = document.selection;
    expect(editor.routeKey({ key: 'Tab' })).toEqual({ handled: true, owner: 'snippet' });
    expect(document.selection).not.toEqual(firstPlaceholder);
    expect(editor.routeKey({ key: 'Tab', shift: true })).toEqual({ handled: true, owner: 'snippet' });
    expect(document.selection).toEqual(firstPlaceholder);
    expect(editor.routeKey({ key: 'Escape' })).toEqual({ handled: true, owner: 'snippet' });
    expect(controller.snippets).toHaveLength(0);
    expect(editor.focusState).toBe('focused');
  });

  it('should trigger completion from typing and reject stale or read-only acceptance', async () => {
    // Trigger characters may request assistance, but stale and read-only results must never mutate source.
    const fresh = await createCompletionHarness('object');
    fresh.document.setSelection({ anchor: 6, head: 6 });
    expect(fresh.editor.routeKey({ key: '.', text: '.' })).toEqual({ handled: true, owner: 'text' });
    expect(fresh.session.requests.at(-1)?.method).toBe('textDocument/completion');

    const pending = fresh.session.requests.at(-1);
    fresh.session.respond(pending?.id, { items: [{ label: 'member', insertText: 'member' }] });
    await Promise.resolve();
    const external = fresh.document.createTransaction({
      base: fresh.document.identity,
      edits: [{ range: { from: 0, to: 0 }, text: 'x' }],
      origin: 'external',
    });
    expect(fresh.document.apply(external)).toEqual({ accepted: true });
    const staleState = {
      text: fresh.document.text,
      revision: fresh.document.identity.revision,
      undoDepth: fresh.document.undoDepth,
    };
    fresh.coordinator.acceptCompletion();
    expect({
      text: fresh.document.text,
      revision: fresh.document.identity.revision,
      undoDepth: fresh.document.undoDepth,
    }).toEqual(staleState);

    const locked = await createCompletionHarness('fn', true);
    locked.coordinator.requestCompletion({ line: 0, character: 2 });
    const lockedRequest = locked.session.requests.at(-1);
    locked.session.respond(lockedRequest?.id, { items: [{ label: 'function', insertText: 'function' }] });
    await Promise.resolve();
    locked.editor.routeKey({ key: 'Enter' });
    expect(locked.document.text).toBe('fn');
    expect(locked.document.undoDepth).toBe(0);
  });
});
