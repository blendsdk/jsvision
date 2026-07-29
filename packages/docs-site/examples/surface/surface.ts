/** Surface laboratory for offscreen drawing, sanitized cells, preserving resize, and clearing. */
import { Group, Surface, SurfaceView, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_GROW = 'surface-lab.grow';
const CMD_CLEAR = 'surface-lab.clear';
const CMD_REDRAW = 'surface-lab.redraw';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 11;

export default defineExample({
  title: 'Surface Lab',
  blurb: 'Draw into an offscreen cell buffer, preserve content while resizing, and inspect safe mutation paths.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+g': CMD_GROW, 'alt+c': CMD_CLEAR, 'alt+r': CMD_REDRAW }),
    });
    const surface = new Surface({ size: { x: 28, y: 10 } });
    const status = signal('drawn through DrawContext');
    const draw = (): void => {
      const paint = surface.getDrawContext();
      paint.box(0, 0, surface.size.x, surface.size.y, { fg: 'brightCyan', bg: 'blue' }, ' CANVAS ');
      paint.text(2, 2, 'SAFE CELL', { fg: 'yellow', bg: 'blue' });
      surface.set(2, 4, '\u001b', { fg: 'white', bg: 'blue' });
      status.set('drawn · control byte sanitized');
    };
    draw();
    const view = new SurfaceView({ surface });
    const dialog = new Template1Dialog({
      title: ' Surface Lab ',
      width: 60,
      height: 15,
      preserveChildHeights: (child) => child !== view,
    });
    const content = new Group();
    content.add(at(new Text('Surface owns cells; SurfaceView only projects them.'), 0, 0, 56, 1));
    content.add(at(view, 0, 2, 38, 6));
    content.add(at(new Text(() => `Surface: ${surface.size.x}×${surface.size.y}\n${status()}`), 40, 2, 16, 4));
    content.add(at(new Text('Alt+G grows · Alt+C clears · Alt+R redraws'), 0, 9, 56, 1));
    content.add(at(new Text('Resize preserves overlap; all write paths sanitize.'), 0, 10, 56, 1));
    app.onCommand(CMD_GROW, () => {
      surface.grow({ x: 8, y: 2 });
      status.set('grown · content preserved');
    });
    app.onCommand(CMD_CLEAR, () => {
      surface.clear();
      status.set('Surface cleared');
    });
    app.onCommand(CMD_REDRAW, draw);
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
