import { describe, expect, it } from 'vitest';
import { Group, createEventLoop } from '@jsvision/ui';
import { resolveCapabilities } from '@jsvision/core';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

/** Creates one TypeScript editor with a four-column indentation policy. */
function createEditor(text: string): {
  readonly controller: ReturnType<typeof createCodeEditorController>;
  readonly editor: CodeEditor;
} {
  const controller = createCodeEditorController({
    document: createDocumentModel({ text, languageId: 'typescript', tabSize: 4 }),
  });
  return { controller, editor: new CodeEditor({ controller }) };
}

/** Mounts an editor in the real event loop so globalized clipboard commands reach the focused view. */
function mountEditor(text: string, languageId: 'plain' | 'javascript' | 'typescript' | 'postgresql' = 'typescript') {
  const controller = createCodeEditorController({
    document: createDocumentModel({ text, languageId, tabSize: 4 }),
  });
  const editor = new CodeEditor({ controller });
  const root = new Group();
  root.add(editor);
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const loop = createEventLoop({ width: 40, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(editor);
  return { controller, editor, loop };
}

describe('modern keyboard editing', () => {
  // A selection spanning source lines is indented or dedented as one undoable editing operation.
  it('indents and dedents every selected line with Tab and Shift+Tab', () => {
    const { controller, editor } = createEditor('one\ntwo\nthree');
    controller.document.setSelection({ anchor: 1, head: 7 });

    expect(editor.routeKey({ key: 'Tab' })).toEqual({ handled: true, owner: 'text' });
    expect(controller.document.text).toBe('    one\n    two\nthree');
    expect(controller.document.undoDepth).toBe(1);

    expect(editor.routeKey({ key: 'Tab', shift: true })).toEqual({ handled: true, owner: 'text' });
    expect(controller.document.text).toBe('one\ntwo\nthree');
    expect(controller.document.undoDepth).toBe(2);
  });

  // Tab advances to the configured tab stop, while Enter carries leading indentation forward.
  it('uses smart tab stops and preserves leading whitespace on Enter', () => {
    const { controller, editor } = createEditor('  value');
    controller.document.setSelection({ anchor: 2, head: 2 });

    editor.routeKey({ key: 'Tab' });
    expect(controller.document.text).toBe('    value');

    controller.document.setSelection({ anchor: 9, head: 9 });
    editor.routeKey({ key: 'Enter' });
    expect(controller.document.text).toBe('    value\n    ');
  });

  // Select-all and history shortcuts operate on the document model instead of terminal text input.
  it('supports select-all, undo, redo, and the common Ctrl+Shift+Z redo alias', () => {
    const { controller, editor } = createEditor('value');
    controller.document.setSelection({ anchor: 5, head: 5 });
    editor.routeKey({ key: '!', text: '!' });

    editor.routeKey({ key: 'a', ctrl: true });
    expect(controller.document.selection).toMatchObject({ anchor: 0, head: 6 });
    editor.routeKey({ key: 'z', ctrl: true });
    expect(controller.document.text).toBe('value');
    editor.routeKey({ key: 'y', ctrl: true });
    expect(controller.document.text).toBe('value!');
    editor.routeKey({ key: 'z', ctrl: true });
    editor.routeKey({ key: 'z', ctrl: true, shift: true });
    expect(controller.document.text).toBe('value!');
  });

  // Ctrl navigation uses source-code word classes and Shift preserves the selection anchor.
  it('navigates by word and document boundaries with optional selection extension', () => {
    const { controller, editor } = createEditor('const user_name = value;\nnext');

    editor.routeKey({ key: 'ArrowRight', ctrl: true });
    expect(Number(controller.document.selection.head)).toBe(6);
    editor.routeKey({ key: 'ArrowRight', ctrl: true, shift: true });
    expect(controller.document.selection).toMatchObject({ anchor: 6, head: 16 });
    editor.routeKey({ key: 'ArrowLeft', ctrl: true });
    expect(Number(controller.document.selection.head)).toBe(6);

    editor.routeKey({ key: 'End', ctrl: true });
    expect(Number(controller.document.selection.head)).toBe(controller.document.text.length);
    editor.routeKey({ key: 'Home', ctrl: true, shift: true });
    expect(controller.document.selection).toMatchObject({
      anchor: controller.document.text.length,
      head: 0,
    });
  });
});

describe('modern clipboard and language commands', () => {
  // Clipboard shortcuts use the event loop's shared, terminal-safe clipboard seams.
  it('copies, cuts, and pastes through global command events', () => {
    const { controller, loop } = mountEditor('value');
    loop.dispatch({ type: 'key', key: 'a', ctrl: true, alt: false, shift: false });
    loop.dispatch({ type: 'key', key: 'c', ctrl: true, alt: false, shift: false });
    controller.document.setSelection({ anchor: 5, head: 5 });
    loop.dispatch({ type: 'key', key: 'v', ctrl: true, alt: false, shift: false });
    expect(controller.document.text).toBe('valuevalue');

    loop.dispatch({ type: 'key', key: 'a', ctrl: true, alt: false, shift: false });
    loop.dispatch({ type: 'key', key: 'x', ctrl: true, alt: false, shift: false });
    expect(controller.document.text).toBe('');
    loop.dispatch({ type: 'key', key: 'v', ctrl: true, alt: false, shift: false });
    expect(controller.document.text).toBe('valuevalue');
  });

  // Ctrl+/ uses the active built-in adapter delimiter and changes all selected lines atomically.
  it('toggles JavaScript and PostgreSQL line comments in one undo step', () => {
    for (const fixture of [
      { languageId: 'typescript' as const, delimiter: '//' },
      { languageId: 'postgresql' as const, delimiter: '--' },
    ]) {
      const { controller, editor } = mountEditor('one\ntwo', fixture.languageId);
      controller.document.setSelection({ anchor: 0, head: 7 });

      expect(editor.routeKey({ key: '/', ctrl: true })).toEqual({ handled: true, owner: 'text' });
      expect(controller.document.text).toBe(`${fixture.delimiter} one\n${fixture.delimiter} two`);
      expect(controller.document.undoDepth).toBe(1);

      editor.routeKey({ key: '/', ctrl: true });
      expect(controller.document.text).toBe('one\ntwo');
      expect(controller.document.undoDepth).toBe(2);
    }
  });

  // Plain text has no line-comment syntax, so the shortcut is safe and mutation-free.
  it('leaves unsupported plain-text documents unchanged when Ctrl+/ is pressed', () => {
    const { controller, editor } = mountEditor('plain text', 'plain');
    controller.document.setSelection({ anchor: 0, head: 10 });

    expect(editor.routeKey({ key: '/', ctrl: true })).toEqual({ handled: true, owner: 'editor' });
    expect(controller.document.text).toBe('plain text');
    expect(controller.document.undoDepth).toBe(0);
  });
});
