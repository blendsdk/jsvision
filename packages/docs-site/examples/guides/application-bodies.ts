/** Desktop-versus-custom-content body laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ApplicationBodiesPanel } from '../../src/example-fixtures/application-shell/application-bodies-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_BODY = 'guide.shell.switch-body';
const CMD_WINDOW = 'guide.shell.window-command';
const CMD_QUIT_REQUEST = 'guide.shell.body-quit-request';

export default defineExample({
  title: 'Application Bodies Laboratory',
  blurb: 'Compare Desktop and custom content ownership, window commands, and lifecycle boundaries.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+b': CMD_BODY,
        'alt+w': CMD_WINDOW,
        'alt+q': CMD_QUIT_REQUEST,
      }),
    });
    const panel = new ApplicationBodiesPanel(ctx.caps);
    app.onCommand(CMD_BODY, () => panel.switchBody('keyboard'));
    app.onCommand(CMD_WINDOW, () => panel.runWindowCommand('keyboard'));
    app.onCommand(CMD_QUIT_REQUEST, () => panel.requestQuit('keyboard'));

    const toggle = new Button('Switch body', { onClick: () => panel.switchBody('mouse') });
    const runCommand = new Button('Run window command', {
      onClick: () => panel.runWindowCommand('mouse'),
    });
    const quit = new Button('Request quit', { onClick: () => panel.requestQuit('mouse') });
    const content = new Group();
    content.add(at(new Text('Choose body ownership before adding application workflows.'), 0, 0, 62, 1));
    content.add(at(panel, 0, 2, 62, 7));
    content.add(at(toggle, 0, 9, 18, 2));
    content.add(at(runCommand, 20, 9, 20, 2));
    content.add(at(quit, 42, 9, 18, 2));
    content.add(at(new Text('Alt+B switch · Alt+W command · Alt+Q request · click · resize'), 0, 12, 62, 1));

    const dialog = new Template1Dialog({
      title: ' Application Bodies Laboratory ',
      width: 66,
      height: 17,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 13));
    app.desktop.addWindow(dialog);
    app.loop.focusView(toggle);
    return app;
  },
});
