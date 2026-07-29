/** Indicator laboratory for caret position, modified state, and passive status presentation. */
import { Dialog, Group, Indicator, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_NEXT = 'indicator-lab.next';
const CMD_CLEAR = 'indicator-lab.clear';
const CONTENT_WIDTH = 50;
const CONTENT_HEIGHT = 8;

export default defineExample({
  title: 'Indicator Lab',
  blurb: 'Drive the passive line/column strip through its public IndicatorTarget update seam.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+n': CMD_NEXT, 'alt+c': CMD_CLEAR }),
    });
    const indicator = new Indicator();
    indicator.setValue({ line: 1, col: 1 }, false);
    const dialog = new Dialog({ title: ' Indicator Lab ', width: 54, height: 12 });
    dialog.closable = false;
    const content = new Group();
    content.add(at(new Text('Indicator is a passive Editor status projection.'), 0, 0, 50, 1));
    content.add(at(indicator, 0, 3, 18, 1));
    content.add(at(new Text('═ resting · ─ while an ancestor window drags'), 21, 3, 29, 2));
    content.add(at(new Text('Alt+N moves/marks · Alt+C returns to clean 1:1'), 0, 6, 50, 1));
    content.add(at(new Text('setValue({line,col}, modified) is the public seam.'), 0, 7, 50, 1));
    app.onCommand(CMD_NEXT, () => indicator.setValue({ line: 12, col: 34 }, true));
    app.onCommand(CMD_CLEAR, () => indicator.setValue({ line: 1, col: 1 }, false));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
