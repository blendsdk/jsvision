/** Complete-shell chrome and quit-request laboratory. */
import { Button, Group, Text, at, createKeymap, item, statusItem, subMenu } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ApplicationChromePanel } from '../../src/example-fixtures/application-shell/application-chrome-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_MENU = 'guide.shell.menu';
const CMD_QUIT_REQUEST = 'guide.shell.quit-request';
const CMD_MENU_KEYMAP = 'guide.shell.menu.keymap';
const CMD_QUIT_KEYMAP = 'guide.shell.quit-request.keymap';
const CMD_MENU_BUTTON = 'guide.shell.menu.button';
const CMD_QUIT_BUTTON = 'guide.shell.quit-request.button';

export default defineExample({
  title: 'Application Chrome Laboratory',
  blurb: 'Exercise menu, status, content, and a host-safe quit request in one complete shell.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+m': CMD_MENU_KEYMAP, 'alt+q': CMD_QUIT_KEYMAP }),
      menuItems: [
        subMenu('Lesson (~L~)', [
          item('~M~enu action', CMD_MENU, 'Alt+M'),
          item('Quit request (~Q~)', CMD_QUIT_REQUEST, 'Alt+Q'),
        ]),
      ],
      statusItems: [
        statusItem('~Alt-M~ Lesson', CMD_MENU, 'Alt+M'),
        statusItem('~Alt-Q~ Request', CMD_QUIT_REQUEST, 'Alt+Q'),
      ],
    });
    const panel = new ApplicationChromePanel();
    app.onCommand(CMD_MENU, () => panel.invokeMenu('menu/status'));
    app.onCommand(CMD_QUIT_REQUEST, () => panel.requestQuit('menu/status'));
    app.onCommand(CMD_MENU_KEYMAP, () => panel.invokeMenu('keymap'));
    app.onCommand(CMD_QUIT_KEYMAP, () => panel.requestQuit('keymap'));
    app.onCommand(CMD_MENU_BUTTON, () => panel.invokeMenu('button'));
    app.onCommand(CMD_QUIT_BUTTON, () => panel.requestQuit('button'));

    const menu = new Button('Menu command', { onClick: () => app.loop.emitCommand(CMD_MENU_BUTTON) });
    const quit = new Button('Request quit', { onClick: () => app.loop.emitCommand(CMD_QUIT_BUTTON) });
    const content = new Group();
    content.add(at(new Text('A shell owns chrome, one body, commands, and host lifecycle.'), 0, 0, 62, 1));
    content.add(at(panel, 0, 2, 62, 7));
    content.add(at(menu, 0, 9, 19, 2));
    content.add(at(quit, 21, 9, 19, 2));
    content.add(at(new Text('Alt+M menu · Alt+Q quit request · click · resize'), 0, 12, 62, 1));

    const dialog = new Template1Dialog({
      title: ' Application Chrome Laboratory ',
      width: 66,
      height: 17,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 13));
    app.desktop.addWindow(dialog);
    app.loop.focusView(menu);
    return app;
  },
});
