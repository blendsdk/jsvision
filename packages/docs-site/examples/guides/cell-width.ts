/**
 * Interactive terminal-cell laboratory for the Text, Unicode & terminal cells course.
 */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { CellWidthPanel } from '../../src/example-fixtures/text-unicode-and-cells/cell-width-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_WIDTH = 'text-unicode.cell-width.cycle-width';
const CMD_ZWJ = 'text-unicode.cell-width.zwj';
const CMD_NEXT = 'text-unicode.cell-width.next';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;

export default defineExample({
  title: 'Cell Width Laboratory',
  blurb: 'Compare wide and combining text, then change wrapping and clipping boundaries in terminal cells.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+w': CMD_WIDTH,
        'alt+g': CMD_ZWJ,
        'alt+n': CMD_NEXT,
      }),
    });
    const panel = new CellWidthPanel();

    app.onCommand(CMD_WIDTH, () => panel.cycleWrapWidth('keyboard'));
    app.onCommand(CMD_ZWJ, () => panel.showZwjSample('keyboard'));
    app.onCommand(CMD_NEXT, () => panel.nextSample('keyboard'));

    const nextSample = new Button('~N~ext sample', {
      onClick: () => panel.nextSample('mouse'),
    });
    const cycleWidth = new Button('Cycle ~w~idth', {
      onClick: () => panel.cycleWrapWidth('mouse'),
    });
    const showZwj = new Button('Show ~g~rapheme limit', {
      onClick: () => panel.showZwjSample('mouse'),
    });

    const content = new Group();
    content.add(at(new Text('Code units, code points, graphemes, and cells are different.'), 0, 0, 66, 1));
    content.add(at(panel, 0, 2, 66, 9));
    content.add(at(nextSample, 0, 11, 16, 2));
    content.add(at(cycleWidth, 18, 11, 17, 2));
    content.add(at(showZwj, 37, 11, 25, 2));
    content.add(at(new Text('Alt+N sample · Alt+W width · Alt+G ZWJ · click · resize'), 0, 13, 66, 1));

    const dialog = new Template1Dialog({
      title: ' Cell Width Laboratory ',
      width: CONTENT_WIDTH + 4,
      height: CONTENT_HEIGHT + 4,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(nextSample);
    return app;
  },
});
