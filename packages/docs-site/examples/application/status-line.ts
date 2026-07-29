/**
 * A StatusLine laboratory demonstrating a real command item, chord, and live enablement.
 */
import { Group, Text, at, createKeymap, signal, statusItem } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 10;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_SAVE = 'status-lab.save';
const CMD_ENABLE = 'status-lab.enable';

export default defineExample({
  title: 'Status Line Lab',
  blurb: 'Activate and disable a real status command while the centered lab reports footer behavior.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+e': CMD_ENABLE }),
      statusItems: [statusItem('~Alt+S~ Save', CMD_SAVE, 'Alt+S')],
    });
    const action = signal('none');
    const enabled = signal(true);
    const saves = signal(0);
    const dialog = new Template1Dialog({ title: ' Status Line Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    const content = new Group();

    content.add(at(new Text('The real footer combines command items, spacers, and passive hints.'), 0, 0, 60, 1));
    content.add(at(new Text('Press'), 3, 3, 10, 1));
    content.add(at(new Text('→ selected on hold →'), 13, 3, 22, 1));
    content.add(at(new Text('emit on release/chord'), 36, 3, 22, 1));
    content.add(at(new Text(() => `Status action: ${action()} · saves ${saves()}`), 0, 6, 38, 1));
    content.add(at(new Text(() => `Save enabled: ${enabled() ? 'yes' : 'no'}`), 39, 6, 21, 1));
    content.add(at(new Text('Alt+S activates Save · Alt+E toggles enablement'), 0, 8, CONTENT_WIDTH, 1));
    content.add(at(new Text('Disabled items grey and reject both keyboard and pointer'), 0, 9, CONTENT_WIDTH, 1));

    app.onCommand(CMD_SAVE, () => {
      saves.update((count) => count + 1);
      action.set('Save');
    });
    app.onCommand(CMD_ENABLE, () => {
      const next = !enabled.peek();
      enabled.set(next);
      app.loop.enableCommand(CMD_SAVE, next);
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
