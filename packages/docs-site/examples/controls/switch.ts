/**
 * An interactive Switch laboratory showing on, off, focused, custom-label, disabled, hotkey,
 * mouse, keyboard, externally reset, and signal-feedback states.
 */
import { Button, Group, Switch, Text, at, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 12;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;

export default defineExample({
  title: 'Switch Lab',
  blurb: 'Compare on, off, custom-label, and disabled switches while toggling by keyboard, hotkey, and mouse.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const wifi = signal(false);
    const sync = signal(true);
    const locked = signal(false);
    const status = signal('ready');

    const wifiSwitch = new Switch({ value: wifi, label: '~W~i-Fi' });
    const syncSwitch = new Switch({
      value: sync,
      label: '~S~ync',
      onLabel: 'Active',
      offLabel: 'Paused',
    });
    const lockedSwitch = new Switch({
      value: locked,
      label: '~L~ocked',
      disabled: true,
    });

    const dialog = new Template1Dialog({
      title: ' Switch Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(at(new Text('One boolean signal per control; external writes repaint immediately.'), 0, 0, 60, 1));
    content.add(at(wifiSwitch, 0, 2, 24, 1));
    content.add(at(new Text('Off state · focused first'), 29, 2, 29, 1));
    content.add(at(syncSwitch, 0, 4, 28, 1));
    content.add(at(new Text('On state · custom words'), 29, 4, 29, 1));
    content.add(at(lockedSwitch, 0, 6, 24, 1));
    content.add(at(new Text('Locked is disabled'), 29, 6, 29, 1));
    content.add(
      at(
        new Text(
          () =>
            `Wi-Fi: ${wifi() ? 'On' : 'Off'} · Sync: ${sync() ? 'On' : 'Off'} · ` +
            `Locked: ${locked() ? 'On' : 'Off'}`,
        ),
        0,
        8,
        48,
        1,
      ),
    );
    content.add(
      at(
        new Button('~R~eset', {
          onClick: () => {
            wifi.set(false);
            sync.set(true);
            locked.set(false);
            status.set('signals reset externally');
          },
        }),
        48,
        7,
        12,
        2,
      ),
    );
    content.add(at(new Text(() => `Status: ${status()}`), 0, 9, 60, 1));
    content.add(at(new Text('Space/Enter or click toggles · Tab moves between switches'), 0, 10, 60, 1));
    content.add(at(new Text('Alt+W/S/L toggles · disabled L is inert · Alt+R resets'), 0, 11, 60, 1));

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
