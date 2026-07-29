/** SurfaceView laboratory for reactive, clamped panning over an oversized canvas. */
import { Group, Surface, SurfaceView, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_PAN = 'surface-view-lab.pan';
const CMD_RESET = 'surface-view-lab.reset';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'Surface View Lab',
  blurb: 'Pan a compact viewport over a larger reactive surface while observing clamped two-axis offsets.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+p': CMD_PAN, 'alt+r': CMD_RESET }),
    });
    const rows = Array.from({ length: 12 }, (_, row) => `${String(row).padStart(2, '0')}  ` + '0123456789'.repeat(5));
    const surface = Surface.from(rows);
    const delta = signal({ x: 0, y: 0 });
    const view = new SurfaceView({ surface, delta });
    const dialog = new Template1Dialog({
      title: ' Surface View Lab ',
      width: 60,
      height: 14,
      preserveChildHeights: (child) => child !== view,
    });
    const content = new Group();
    content.add(at(new Text('A 54×12 canvas inside a 38×6 passive viewport.'), 0, 0, 56, 1));
    content.add(at(view, 0, 2, 38, 6));
    content.add(
      at(
        new Text(() => `Offset: ${delta().x},${delta().y}\nCanvas: ${surface.size.x}×${surface.size.y}`),
        40,
        2,
        16,
        3,
      ),
    );
    content.add(at(new Text('Alt+P pans · Alt+R resets · surface edits repaint'), 0, 8, 56, 1));
    content.add(at(new Text('scrollTo/panBy clamp · direct delta may overscroll'), 0, 9, 56, 1));
    app.onCommand(CMD_PAN, () => view.panBy(8, 2));
    app.onCommand(CMD_RESET, () => view.scrollTo({ x: 0, y: 0 }));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
