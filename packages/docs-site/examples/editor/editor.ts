/** Editor laboratory for multiline input, state signals, undo/redo, and the shared clipboard. */
import { Editor, Group, Text, at, createKeymap } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_RESET = 'editor-lab.reset';
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 13;

export default defineExample({
  title: 'Editor Lab',
  blurb: 'Edit multiline text with selection, undo/redo, modern clipboard bindings, scrolling, and reactive state.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true, keymap: createKeymap({ 'alt+r': CMD_RESET }) });
    const editor = new Editor({ keyBindings: 'modern', autoIndent: true });
    editor.setText('Edit this document\nSecond line for navigation.');
    const dialog = new Template1Dialog({
      title: ' Editor Lab ',
      width: 64,
      height: 17,
      preserveChildHeights: (view) => view !== editor,
    });
    const content = new Group();
    content.add(at(new Text('General Editor — the lightweight multiline text engine.'), 0, 0, 60, 1));
    content.add(at(editor, 0, 2, 45, 8));
    content.add(
      at(
        new Text(() => {
          const pos = editor.curPos();
          return `Caret: ${pos.line}:${pos.col}\nModified: ${editor.modified() ? 'yes' : 'no'}\nUndo: ${editor.canUndo() ? 'yes' : 'no'}`;
        }),
        47,
        2,
        13,
        4,
      ),
    );
    content.add(at(new Text('Type and select · Ctrl+Z/Y undo/redo · Ctrl+A/C/X/V'), 0, 11, 60, 1));
    content.add(at(new Text('Arrows/Pg/Home/End navigate · mouse drag · Alt+R reset'), 0, 12, 60, 1));
    app.onCommand(CMD_RESET, () => editor.setText('Edit this document\nSecond line for navigation.'));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(editor);
    return app;
  },
});
