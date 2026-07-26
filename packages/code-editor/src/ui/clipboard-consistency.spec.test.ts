/**
 * Specification tests for CodeEditor participation in JSVision's canonical clipboard.
 *
 * Host paste and host-copy aliases must converge on the same command and insertion paths used by
 * the other editable controls.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, PasteEvent } from '@jsvision/core';
import { Group, createEventLoop } from '@jsvision/ui';
import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

/** Creates a decoded key event with explicit modifier defaults. */
function key(value: string, modifiers: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: value, ctrl: false, alt: false, shift: false, ...modifiers };
}

/** Creates an untruncated external paste event. */
function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false };
}

/** Mounts a focused editor in a real event loop. */
function mountEditor(text = '') {
  const controller = createCodeEditorController({
    document: createDocumentModel({ text, languageId: 'typescript', tabSize: 4 }),
  });
  const editor = new CodeEditor({ controller });
  const root = new Group();
  root.add(editor);
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const loop = createEventLoop({ width: 40, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(editor);
  return { controller, loop };
}

test('an external multiline paste is inserted and becomes the value repeated by Ctrl+V', () => {
  const { controller, loop } = mountEditor();
  const text = 'const café = "☕";\r\n第二行';

  loop.dispatch(paste(text));
  expect(controller.document.text).toBe(text);

  controller.document.setSelection({ anchor: 0, head: text.length });
  loop.dispatch(key('backspace'));
  expect(controller.document.text).toBe('');

  loop.dispatch(key('v', { ctrl: true }));
  expect(controller.document.text).toBe(text);
});

test('delivered Ctrl+Shift+C copies through the same canonical path as Ctrl+C', () => {
  const { controller, loop } = mountEditor('copied');
  controller.document.setSelection({ anchor: 0, head: 6 });

  loop.dispatch(key('c', { ctrl: true, shift: true }));
  loop.dispatch(key('backspace'));
  expect(controller.document.text).toBe('');

  loop.dispatch(key('v', { ctrl: true }));
  expect(controller.document.text).toBe('copied');
});
