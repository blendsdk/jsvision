/**
 * Resident virtual-collection laboratory for the Scrolling, lists & large content course.
 */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { VirtualCollectionsPanel } from '../../src/example-fixtures/scrolling-lists-and-large-content/virtual-collections-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_TREE = 'scrolling.collections.toggle-tree';
const CMD_SHRINK = 'scrolling.collections.shrink';
const CMD_EMPTY = 'scrolling.collections.empty';
const CMD_RESET = 'scrolling.collections.reset';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;

export default defineExample({
  title: 'Virtual Collections Laboratory',
  blurb: 'Compare ListView, ListBox, and Tree focus, selection, expansion, and bounded visible-row work.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+t': CMD_TREE,
        'alt+s': CMD_SHRINK,
        'alt+e': CMD_EMPTY,
        'alt+r': CMD_RESET,
      }),
    });
    const panel = new VirtualCollectionsPanel();
    app.onCommand(CMD_TREE, () => panel.toggleTree('keyboard'));
    app.onCommand(CMD_SHRINK, () => panel.shrinkData('keyboard'));
    app.onCommand(CMD_EMPTY, () => panel.emptyData('keyboard'));
    app.onCommand(CMD_RESET, () => panel.resetData('keyboard'));

    const toggle = new Button('Toggle tree', {
      onClick: () => panel.toggleTree('mouse'),
    });
    const shrink = new Button('Shrink data', {
      onClick: () => panel.shrinkData('mouse'),
    });
    const empty = new Button('Empty data', {
      onClick: () => panel.emptyData('mouse'),
    });
    const reset = new Button('Reset data', {
      onClick: () => panel.resetData('mouse'),
    });
    const content = new Group();
    content.add(at(new Text('Virtual rows bound paint work; source arrays remain resident.'), 0, 0, 66, 1));
    content.add(at(panel, 0, 2, 66, 9));
    content.add(at(toggle, 0, 11, 15, 2));
    content.add(at(shrink, 16, 11, 15, 2));
    content.add(at(empty, 32, 11, 15, 2));
    content.add(at(reset, 48, 11, 15, 2));
    content.add(at(new Text('Arrows move focus · Enter selects · Alt+T/S/E/R · click · resize'), 0, 13, 66, 1));

    const dialog = new Template1Dialog({
      title: ' Virtual Collections Laboratory ',
      width: CONTENT_WIDTH + 4,
      height: CONTENT_HEIGHT + 4,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(panel.listView.rows);
    return app;
  },
});
