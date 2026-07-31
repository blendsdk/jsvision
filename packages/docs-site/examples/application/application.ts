/**
 * An Application laboratory demonstrating app-wide keymaps, command dispatch, and enablement.
 */
import { Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 11;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_RUN = 'application-lab.run';
const CMD_ENABLE = 'application-lab.enable';

export default defineExample({
  title: 'Application Lab',
  blurb: 'Dispatch an app-wide command and toggle command enablement through one shared keymap.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+r': CMD_RUN,
        'alt+e': CMD_ENABLE,
      }),
    });
    const enabled = signal(true);
    const runs = signal(0);
    const commandState = signal('ready');
    const dialog = new Template1Dialog({
      title: ' Application Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(at(new Text('One Application owns the loop, commands, focus, chrome, and theme.'), 0, 0, 60, 1));
    content.add(at(new Text('keymap chord'), 2, 3, 16, 1));
    content.add(at(new Text('→ named command →'), 18, 3, 19, 1));
    content.add(at(new Text('central handler'), 39, 3, 17, 1));
    content.add(at(new Text(() => `Command: ${commandState()} · runs ${runs()}`), 0, 6, CONTENT_WIDTH, 1));
    content.add(at(new Text(() => `Run enabled: ${enabled() ? 'yes' : 'no'}`), 0, 7, CONTENT_WIDTH, 1));
    content.add(at(new Text('Alt+R dispatches Run · Alt+E toggles command enablement'), 0, 9, CONTENT_WIDTH, 1));
    content.add(at(new Text('Disabled commands are dropped before their handler runs'), 0, 10, CONTENT_WIDTH, 1));

    app.onCommand(CMD_RUN, () => {
      runs.update((count) => count + 1);
      commandState.set('ran');
    });
    app.onCommand(CMD_ENABLE, () => {
      const next = !enabled.peek();
      enabled.set(next);
      app.loop.enableCommand(CMD_RUN, next);
      commandState.set(next ? 'ready' : 'disabled');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
