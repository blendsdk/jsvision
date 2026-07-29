/**
 * A Desktop laboratory embedding a real window manager inside the centered teaching dialog.
 */
import { Desktop, Dialog, Group, Text, Window, at, createKeymap, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 62;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_NEXT = 'desktop-lab.next';
const CMD_TILE = 'desktop-lab.tile';

export default defineExample({
  title: 'Desktop Lab',
  blurb: 'Switch and arrange two real managed windows inside a compact window-manager stage.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_NEXT,
        'alt+t': CMD_TILE,
      }),
    });
    const activeName = signal('Inspector');
    const layoutName = signal('overlapping');
    const dialog = new Dialog({ title: ' Desktop Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    dialog.closable = false;
    const content = new Group();
    const miniature = new Desktop();
    miniature.shadow = true;

    const editor = new Window('Editor');
    editor.closable = false;
    editor.setLayout({ rect: { x: 1, y: 1, width: 30, height: 7 } });
    editor.add(at(new Text('editor.ts'), 1, 1, 20, 1));
    const inspector = new Window('Inspector');
    inspector.closable = false;
    inspector.setLayout({ rect: { x: 25, y: 3, width: 30, height: 7 } });
    inspector.add(at(new Text('Properties'), 1, 1, 20, 1));
    miniature.addWindow(editor);
    miniature.addWindow(inspector);

    content.add(
      at(new Text('A real nested Desktop owns activation, z-order, and arrangement.'), 0, 0, CONTENT_WIDTH, 1),
    );
    content.add(at(miniature, 2, 2, 58, 9));
    content.add(at(new Text(() => `Active: ${activeName()} · front: ${activeName()}`), 0, 11, 38, 1));
    content.add(at(new Text(() => `Layout: ${layoutName()}`), 39, 11, 23, 1));
    content.add(at(new Text('Alt+N switches active/front window · Alt+T tiles/restores'), 0, 13, CONTENT_WIDTH, 1));

    app.onCommand(CMD_NEXT, () => {
      miniature.focusNextWindow();
      activeName.set(miniature.activeWindow()?.title() ?? 'none');
    });
    app.onCommand(CMD_TILE, () => {
      if (layoutName.peek() === 'overlapping') {
        miniature.tile();
        layoutName.set('tiled');
      } else {
        editor.setLayout({ rect: { x: 1, y: 1, width: 30, height: 7 } });
        inspector.setLayout({ rect: { x: 25, y: 3, width: 30, height: 7 } });
        layoutName.set('overlapping');
      }
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
