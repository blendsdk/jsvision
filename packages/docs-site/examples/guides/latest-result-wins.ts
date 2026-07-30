/** Overlapping generations, stale suppression, cancellation, and cleanup laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { LatestResultPanel } from '../../src/example-fixtures/async-work/latest-result-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_PAIR = 'guide.latest-result-wins.pair';
const CMD_NEWEST = 'guide.latest-result-wins.newest';
const CMD_OLDER = 'guide.latest-result-wins.older';
const CMD_CANCEL = 'guide.latest-result-wins.cancel';

export default defineExample({
  title: 'Latest Result Wins Laboratory',
  blurb: 'Overlap two requests, complete them out of order, drop stale work, and publish only the newest result.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+r': CMD_PAIR,
        'alt+n': CMD_NEWEST,
        'alt+l': CMD_OLDER,
        'alt+c': CMD_CANCEL,
      }),
    });
    const panel = new LatestResultPanel();
    app.onCommand(CMD_PAIR, () => panel.requestPair('keyboard'));
    app.onCommand(CMD_NEWEST, () => panel.completeNewest('keyboard'));
    app.onCommand(CMD_OLDER, () => panel.completeOlder('keyboard'));
    app.onCommand(CMD_CANCEL, () => panel.cancelPending('keyboard'));

    const pair = new Button('~R~equest pair', { onClick: () => panel.requestPair('mouse') });
    const newest = new Button('Complete ~n~ewest', {
      onClick: () => panel.completeNewest('mouse'),
    });
    const older = new Button('Complete o~l~der', {
      onClick: () => panel.completeOlder('mouse'),
    });
    const cancel = new Button('~C~ancel pending', {
      onClick: () => panel.cancelPending('mouse'),
    });
    const content = new Group();
    content.add(at(new Text('Generation identity—not timing—decides what may publish.'), 0, 0, 62, 1));
    content.add(at(new Text('Deterministic bounded in-memory fixture · no network.'), 0, 1, 62, 1));
    content.add(at(panel, 0, 2, 62, 8));
    content.add(at(pair, 0, 11, 14, 2));
    content.add(at(newest, 15, 11, 18, 2));
    content.add(at(older, 34, 11, 17, 2));
    content.add(at(cancel, 0, 14, 17, 2));
    content.add(at(new Text('Alt+R pair · Alt+N newest · Alt+L older'), 19, 14, 43, 1));
    content.add(at(new Text('Alt+C cancel · mouse: click a button'), 19, 15, 43, 1));

    const dialog = new Template1Dialog({
      title: ' Latest Result Wins Laboratory ',
      width: 66,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(pair);
    return app;
  },
});
