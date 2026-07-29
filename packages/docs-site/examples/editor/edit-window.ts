/** EditWindow laboratory for hosted editor state, frame gadgets, resize, and zoom. */
import { EditWindow, Group, Text, at, createKeymap } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_ZOOM = 'edit-window-lab.zoom';
const CONTENT_WIDTH = 64;
const CONTENT_HEIGHT = 14;

export default defineExample({
  title: 'Edit Window Lab',
  blurb: 'Use a complete document window with hosted Editor, scroll bars, indicator, activation, and zoom.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true, keymap: createKeymap({ 'alt+z': CMD_ZOOM }) });
    const win = new EditWindow({ rect: { x: 0, y: 1, width: 52, height: 10 } });
    win.editor.setText('EditWindow hosts Editor\nwith scroll bars and an Indicator.');
    const dialog = new Template1Dialog({
      title: ' Edit Window Lab ',
      width: 68,
      height: 18,
      preserveChildHeights: (view) => view !== win,
    });
    const content = new Group();
    content.add(at(new Text('A document window composed inside the teaching dialog.'), 0, 0, 64, 1));
    content.add(win);
    content.add(at(new Text('Edit normally · Alt+Z zooms/restores · bars follow'), 0, 12, 64, 1));
    content.add(at(new Text('The indicator reports caret position and unsaved changes.'), 0, 13, 64, 1));
    app.onCommand(CMD_ZOOM, () => win.zoom());
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(win.editor);
    return app;
  },
});
