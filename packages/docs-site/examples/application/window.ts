/**
 * A Window laboratory demonstrating real frame state, zoom/restore, and a protected close policy.
 */
import { Desktop, Group, Text, Window, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_ZOOM = 'window-lab.zoom';
const CMD_CLOSE = 'window-lab.close';

export default defineExample({
  title: 'Window Lab',
  blurb: 'Zoom and restore a real managed Window while inspecting its active frame and close policy.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+z': CMD_ZOOM,
        'alt+c': CMD_CLOSE,
      }),
    });
    const state = signal('restored');
    const closeFeedback = signal('Close policy: protected');
    const content = new Group();
    const desktop = new Desktop();
    const dialog = new Template1Dialog({
      title: ' Window Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: (view) => view !== desktop,
    });
    const specimen = new Window('Specimen');
    specimen.closable = false;
    specimen.number = 1;
    specimen.minWidth = 22;
    specimen.minHeight = 6;
    specimen.setLayout({ rect: { x: 8, y: 1, width: 38, height: 8 } });
    specimen.add(at(new Text('Padded window content'), 1, 1, 28, 1));
    desktop.addWindow(specimen);

    content.add(at(new Text('Window contributes title, border, icons, padding, and manager state.'), 0, 0, 60, 1));
    content.add(at(desktop, 2, 2, 56, 9));
    content.add(at(new Text(() => `Window: active · ${state()}`), 0, 11, CONTENT_WIDTH, 1));
    content.add(at(new Text(() => closeFeedback()), 0, 12, CONTENT_WIDTH, 1));
    content.add(at(new Text('Alt+Z zooms/restores · Alt+C tests protected close'), 0, 13, CONTENT_WIDTH, 1));

    app.onCommand(CMD_ZOOM, () => {
      specimen.zoom();
      state.set(specimen.isZoomed() ? 'zoomed' : 'restored');
    });
    app.onCommand(CMD_CLOSE, () => {
      specimen.close();
      closeFeedback.set('Close blocked: laboratory stays open');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
