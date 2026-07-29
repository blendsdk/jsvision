/**
 * An interactive CheckGroup laboratory showing independent values, selection focus, item
 * accelerators, disabled-row behavior, signal-driven feedback, and deterministic reset.
 */
import { Button, CheckGroup, Dialog, Group, Text, at, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 12;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;
const LABELS = ['Bold', 'Italic', 'Strike', 'Underline'] as const;

export default defineExample({
  title: 'Check Group Lab',
  blurb: 'Toggle independent formatting choices and observe hotkeys, wrapping focus, and one disabled item.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const selected = signal([true, false, false, false]);
    const status = signal('ready');
    const group = new CheckGroup({
      labels: ['~B~old', '~I~talic', '~S~trike', '~U~nderline'],
      value: selected,
    });
    group.setItemEnabled(3, false);

    const dialog = new Dialog({ title: ' Check Group Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Independent choices — toggling one row never clears another.'), 0, 0, CONTENT_WIDTH, 1));
    content.add(at(group, 0, 2, 24, 4));
    content.add(at(new Text('Enabled: three independent values'), 28, 2, 31, 1));
    content.add(at(new Text('Underline is disabled'), 28, 3, 31, 1));
    content.add(at(new Text('Missing signal entries read unchecked'), 28, 4, 31, 1));
    content.add(at(new Text('External signal writes repaint every row'), 28, 5, 31, 1));
    content.add(
      at(
        new Text(() => {
          const names = LABELS.filter((_, index) => selected()[index]);
          return `Selected: ${names.length > 0 ? names.join(', ') : 'none'}`;
        }),
        0,
        7,
        CONTENT_WIDTH,
        1,
      ),
    );
    content.add(at(new Text(() => `Status: ${status()}`), 0, 8, 31, 1));
    content.add(
      at(
        new Button('~R~eset', {
          onClick: () => {
            selected.set([true, false, false, false]);
            status.set('reset to Bold');
          },
        }),
        45,
        7,
        12,
        2,
      ),
    );
    content.add(at(new Text('Up/Down wraps, skips disabled · Space/click toggles'), 0, 10, 60, 1));
    content.add(at(new Text('Alt+B/I/S/U targets rows · Alt+R resets'), 0, 11, 60, 1));

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
