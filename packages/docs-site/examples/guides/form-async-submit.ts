/** Async validation supersession, submit failure, retry, and cleanup laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { FormAsyncSubmitPanel } from '../../src/example-fixtures/forms-guide/form-async-submit-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_VALIDATE = 'guide.form-async-submit.validate';
const CMD_NEWER = 'guide.form-async-submit.newer';
const CMD_SETTLE_OLDER = 'guide.form-async-submit.settle-older';
const CMD_SETTLE_NEWEST = 'guide.form-async-submit.settle-newest';
const CMD_FAIL = 'guide.form-async-submit.fail';
const CMD_SUBMIT = 'guide.form-async-submit.submit';
const CMD_ALLOW = 'guide.form-async-submit.allow';
const CMD_PERSIST = 'guide.form-async-submit.persist';
const CMD_RETRY = 'guide.form-async-submit.retry';

export default defineExample({
  title: 'Async Form Submission Laboratory',
  blurb:
    'Validate, supersede, and abort stale work, then drive submission through persistence failure, retry, and owned cleanup.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+v': CMD_VALIDATE,
        'alt+n': CMD_NEWER,
        'alt+l': CMD_SETTLE_OLDER,
        'alt+o': CMD_SETTLE_NEWEST,
        'alt+f': CMD_FAIL,
        'alt+s': CMD_SUBMIT,
        'alt+a': CMD_ALLOW,
        'alt+p': CMD_PERSIST,
        'alt+r': CMD_RETRY,
      }),
    });
    const panel = new FormAsyncSubmitPanel();
    app.onCommand(CMD_VALIDATE, () => panel.validate('keyboard'));
    app.onCommand(CMD_NEWER, () => panel.supersede('keyboard'));
    app.onCommand(CMD_SETTLE_OLDER, () => panel.settleOlder('keyboard'));
    app.onCommand(CMD_SETTLE_NEWEST, () => panel.settleNewest('keyboard'));
    app.onCommand(CMD_FAIL, () => panel.failNext('keyboard'));
    app.onCommand(CMD_SUBMIT, () => panel.submit('keyboard'));
    app.onCommand(CMD_ALLOW, () => panel.settleValidation('keyboard'));
    app.onCommand(CMD_PERSIST, () => panel.settlePersistence('keyboard'));
    app.onCommand(CMD_RETRY, () => panel.retry('keyboard'));

    const validate = new Button('~V~alidate', { onClick: () => panel.validate('mouse') });
    const newer = new Button('~N~ewer', {
      onClick: () => panel.supersede('mouse'),
      disabled: () => !panel.canSupersede(),
    });
    const older = new Button('Settle o~l~der', {
      onClick: () => panel.settleOlder('mouse'),
      disabled: () => !panel.canSettleOlder(),
    });
    const newest = new Button('Newest d~o~ne', {
      onClick: () => panel.settleNewest('mouse'),
      disabled: () => !panel.canSettleNewest(),
    });
    const fail = new Button('~F~ail next', { onClick: () => panel.failNext('mouse') });
    const submit = new Button('~S~ubmit', {
      onClick: () => panel.submit('mouse'),
      disabled: () => !panel.canSubmit(),
    });
    const allow = new Button('~A~llow', {
      onClick: () => panel.settleValidation('mouse'),
      disabled: () => !panel.canSettleValidation(),
    });
    const persist = new Button('~P~ersist', {
      onClick: () => panel.settlePersistence('mouse'),
      disabled: () => !panel.canSettlePersistence(),
    });
    const retry = new Button('~R~etry', {
      onClick: () => panel.retry('mouse'),
      disabled: () => !panel.canRetry(),
    });
    const content = new Group();
    content.add(at(new Text('Deterministic bounded in-memory fixture · no network.'), 0, 0, 62, 1));
    content.add(at(new Text('Text status is ASCII-safe and works in monochrome.'), 0, 1, 62, 1));
    content.add(at(panel, 0, 2, 62, 8));
    content.add(at(validate, 0, 10, 10, 2));
    content.add(at(newer, 11, 10, 9, 2));
    content.add(at(older, 21, 10, 15, 2));
    content.add(at(newest, 37, 10, 16, 2));
    content.add(at(fail, 0, 12, 12, 2));
    content.add(at(submit, 13, 12, 10, 2));
    content.add(at(allow, 24, 12, 9, 2));
    content.add(at(persist, 34, 12, 10, 2));
    content.add(at(retry, 45, 12, 9, 2));
    content.add(at(new Text('Alt+V/N/L/O validation · Alt+F/S submit'), 0, 14, 62, 1));
    content.add(at(new Text('Alt+A/P settle · Alt+R retry · mouse click'), 0, 15, 62, 1));

    const dialog = new Template1Dialog({
      title: ' Async Form Submission Laboratory ',
      width: 66,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 62, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(validate);
    return app;
  },
});
