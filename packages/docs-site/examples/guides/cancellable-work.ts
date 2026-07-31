/** Responsive progress, cancellation, failure, retry, and cleanup laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { CancellableWorkPanel } from '../../src/example-fixtures/async-work/cancellable-work-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_START = 'guide.cancellable-work.start';
const CMD_ADVANCE = 'guide.cancellable-work.advance';
const CMD_CANCEL = 'guide.cancellable-work.cancel';
const CMD_FAIL = 'guide.cancellable-work.fail';
const CMD_RETRY = 'guide.cancellable-work.retry';
const CMD_HEARTBEAT = 'guide.cancellable-work.heartbeat';

export default defineExample({
  title: 'Cancellable Work Laboratory',
  blurb: 'Drive bounded progress, prove responsive input, then cancel, fail, retry, and inspect cleanup.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+s': CMD_START,
        'alt+a': CMD_ADVANCE,
        'alt+c': CMD_CANCEL,
        'alt+f': CMD_FAIL,
        'alt+r': CMD_RETRY,
        h: CMD_HEARTBEAT,
      }),
    });
    const panel = new CancellableWorkPanel();
    app.onCommand(CMD_START, () => panel.start('keyboard'));
    app.onCommand(CMD_ADVANCE, () => panel.advance('keyboard'));
    app.onCommand(CMD_CANCEL, () => panel.cancel('keyboard'));
    app.onCommand(CMD_FAIL, () => panel.fail('keyboard'));
    app.onCommand(CMD_RETRY, () => panel.retry('keyboard'));
    app.onCommand(CMD_HEARTBEAT, () => panel.heartbeat('keyboard'));

    const start = new Button('~S~tart', { onClick: () => panel.start('mouse') });
    const advance = new Button('~A~dvance', { onClick: () => panel.advance('mouse') });
    const cancel = new Button('~C~ancel', { onClick: () => panel.cancel('mouse') });
    const fail = new Button('~F~ail', { onClick: () => panel.fail('mouse') });
    const retry = new Button('~R~etry', { onClick: () => panel.retry('mouse') });
    const content = new Group();
    content.add(at(new Text('Deterministic bounded in-memory fixture.'), 0, 0, 62, 1));
    content.add(at(new Text('No network, files, clipboard, or wall clock.'), 0, 1, 62, 1));
    content.add(at(panel, 0, 2, 62, 9));
    content.add(at(start, 0, 11, 9, 2));
    content.add(at(advance, 10, 11, 11, 2));
    content.add(at(cancel, 22, 11, 10, 2));
    content.add(at(fail, 33, 11, 8, 2));
    content.add(at(retry, 42, 11, 9, 2));
    content.add(at(new Text('Alt+S start · Alt+A advance · H heartbeat'), 0, 14, 62, 1));
    content.add(at(new Text('Alt+C cancel · Alt+F fail · Alt+R retry · mouse click'), 0, 15, 62, 1));

    const dialog = new Template1Dialog({
      title: ' Cancellable Work Laboratory ',
      width: 66,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(start);
    return app;
  },
});
