/** Typed route params, history operations, root policy, and shared-chrome laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { RoutingStackPanel } from '../../src/example-fixtures/screens-and-routing/routing-stack-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_PUSH = 'guide.routing-stack.push';
const CMD_BACK = 'guide.routing-stack.back';
const CMD_REPLACE = 'guide.routing-stack.replace';
const CMD_RESET = 'guide.routing-stack.reset';

export default defineExample({
  title: 'Typed Routing Stack Laboratory',
  blurb:
    'Compare push, back, replace, reset, typed parameters, root policy, and screen-driven shared chrome on one real Router stack.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_PUSH,
        'alt+b': CMD_BACK,
        'alt+p': CMD_REPLACE,
        'alt+r': CMD_RESET,
      }),
    });
    const panel = new RoutingStackPanel();
    app.onCommand(CMD_PUSH, () => panel.pushDetail('keyboard'));
    app.onCommand(CMD_BACK, () => panel.back('keyboard'));
    app.onCommand(CMD_REPLACE, () => panel.replaceSettings('keyboard'));
    app.onCommand(CMD_RESET, () => panel.resetHome('keyboard'));

    const push = new Button('Push ~N~ext', { onClick: () => panel.pushDetail('mouse') });
    const replace = new Button('Re~p~lace', { onClick: () => panel.replaceSettings('mouse') });
    const back = new Button('~B~ack', { onClick: () => panel.back('mouse') });
    const reset = new Button('~R~eset', { onClick: () => panel.resetHome('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 60, 9));
    content.add(at(push, 0, 9, 13, 2));
    content.add(at(replace, 14, 9, 11, 2));
    content.add(at(back, 26, 9, 8, 2));
    content.add(at(reset, 35, 9, 9, 2));
    content.add(at(new Text('Alt+N push · Alt+P replace · Alt+B back · Alt+R reset'), 0, 12, 60, 1));
    content.add(at(new Text('Tab reaches every action · mouse follows the same Router operations'), 0, 13, 60, 1));

    const dialog = new Template1Dialog({
      title: ' Typed Routes, History & Chrome ',
      width: 64,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 60, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(push);
    return app;
  },
});
