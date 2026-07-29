/** Memo laboratory for two-way signal binding and dialog-friendly Tab traversal. */
import { Button, Group, Memo, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_REPLACE = 'memo-lab.replace';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 11;

export default defineExample({
  title: 'Memo Lab',
  blurb: 'Edit a signal-bound multiline field, replace it externally, and let Tab continue through the dialog.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true, keymap: createKeymap({ 'alt+r': CMD_REPLACE }) });
    const value = signal('Initial notes');
    const memo = new Memo({ value });
    const next = new Button('~N~ext control');
    const dialog = new Template1Dialog({
      title: ' Memo Lab ',
      width: 60,
      height: 15,
      preserveChildHeights: (view) => view !== memo,
    });
    const content = new Group();
    content.add(at(new Text('Memo mirrors every edit into one Signal<string>.'), 0, 0, 56, 1));
    content.add(at(memo, 0, 2, 38, 6));
    content.add(at(new Text(() => `Signal:\n${value()}`), 40, 2, 16, 5));
    content.add(at(next, 0, 9, 16, 2));
    content.add(at(new Text('Type to update the signal · Alt+R replaces externally'), 0, 8, 56, 1));
    content.add(at(new Text('Tab moves to the next dialog control.'), 18, 10, 38, 1));
    app.onCommand(CMD_REPLACE, () => value.set('Replaced from the signal'));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(memo);
    return app;
  },
});
