/**
 * A MenuBar laboratory demonstrating real menu navigation, item accelerators, and live replacement.
 */
import { Group, MenuBar, Text, at, createKeymap, item, menuSpacer, signal, subMenu } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 62;
const CONTENT_HEIGHT = 11;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_OPEN = 'menu-lab.open';
const CMD_ABOUT = 'menu-lab.about';
const CMD_TOOL = 'menu-lab.tool';
const CMD_DYNAMIC = 'menu-lab.dynamic';

export default defineExample({
  title: 'Menu Bar Lab',
  blurb: 'Navigate a real menu item by accelerator and replace top-level menu data while the app is live.',
  build: (ctx) => {
    const file = subMenu('Fi~l~e', [item('~O~pen', CMD_OPEN, 'O')]);
    const help = subMenu('~H~elp', [item('~A~bout this lab', CMD_ABOUT)]);
    const tools = subMenu('~T~ools', [item('~I~nspect', CMD_TOOL)]);
    const originalExtra = [file, menuSpacer(), help];
    let menu: MenuBar | null = null;
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+d': CMD_DYNAMIC }),
      menuItems: originalExtra,
      onChrome: (chrome) => {
        menu = chrome.menuBar;
      },
    });
    const command = signal('none');
    const dynamic = signal(false);
    const dialog = new Template1Dialog({ title: ' Menu Bar Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    const content = new Group();
    const originalMenus = app.menuBase();

    content.add(at(new Text('The real top row owns titles, popups, navigation, and commands.'), 0, 0, 62, 1));
    content.add(at(new Text('Open title'), 2, 3, 14, 1));
    content.add(at(new Text('→ popup item →'), 19, 3, 17, 1));
    content.add(at(new Text('command handler'), 39, 3, 18, 1));
    content.add(at(new Text(() => `Menu command: ${command()}`), 0, 6, 31, 1));
    content.add(at(new Text(() => `Menus: File${dynamic() ? ', Tools' : ''}, Help`), 32, 6, 30, 1));
    content.add(at(new Text('Alt+L opens File · then O activates Open · Esc closes'), 0, 9, CONTENT_WIDTH, 1));
    content.add(at(new Text('Alt+D adds/removes a real Tools top-level menu'), 0, 10, CONTENT_WIDTH, 1));

    app.onCommand(CMD_OPEN, () => command.set('Open'));
    app.onCommand(CMD_ABOUT, () => command.set('About'));
    app.onCommand(CMD_TOOL, () => command.set('Inspect'));
    app.onCommand(CMD_DYNAMIC, () => {
      const next = !dynamic.peek();
      dynamic.set(next);
      if (next) {
        menu?.setItems([...originalMenus.slice(0, -1), tools, ...originalMenus.slice(-1)]);
      } else {
        menu?.setItems(originalMenus);
      }
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
