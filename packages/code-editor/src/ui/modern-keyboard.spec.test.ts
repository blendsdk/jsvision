import { describe, expect, it } from 'vitest';

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
