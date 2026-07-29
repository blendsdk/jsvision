/**
 * A Scroller laboratory showing clipped oversized content, both owned bars, keyboard paging, and
 * independently clamped horizontal and vertical offsets.
 */
import { Group, Scroller, Text, at, createKeymap } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_FAR_RIGHT = 'scroller-lab.far-right';
const CONTENT_WIDTH = 52;
const CONTENT_HEIGHT = 12;

export default defineExample({
  title: 'Scroller Lab',
  blurb: 'Move a clipped coordinate document on both axes while its owned bars mirror the live offset.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+x': CMD_FAR_RIGHT }),
    });
    const sheet = new Group();
    sheet.background = 'dialog';
    for (let row = 0; row < 18; row += 1) {
      sheet.add(
        at(new Text(`${String(row + 1).padStart(2, '0')} │ ${'·'.repeat(18)} column-${row + 20}`), 0, row, 58, 1),
      );
    }
    const scroller = new Scroller({
      content: sheet,
      extent: { width: 58, height: 18 },
      scrollbars: 'both',
    });
    const dialog = new Template1Dialog({ title: ' Scroller Lab ', width: 56, height: 16 });
    const content = new Group();

    content.add(at(new Text('A 58×18 sheet inside a 43×7 viewport.'), 0, 0, 52, 1));
    content.add(at(scroller, 0, 2, 43, 7));
    content.add(at(new Text(() => `Offset: x ${scroller.delta.x} · y ${scroller.delta.y}`), 45, 2, 7, 3));
    content.add(at(new Text('PgDn pages · End bottom · arrows move one cell'), 0, 10, 52, 1));
    content.add(at(new Text('Alt+X clamps right · wheel and bars also work'), 0, 11, 52, 1));

    app.onCommand(CMD_FAR_RIGHT, () => {
      app.loop.focusView(scroller);
      for (let step = 0; step < 80; step += 1) {
        app.loop.dispatch({ type: 'key', key: 'right', ctrl: false, alt: false, shift: false });
      }
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(scroller);
    return app;
  },
});
