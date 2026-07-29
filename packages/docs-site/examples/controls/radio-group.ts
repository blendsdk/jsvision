/**
 * An interactive RadioGroup laboratory showing exclusive selection, select-on-arrow movement,
 * wrapping navigation, item accelerators, a disabled row, and deterministic reset.
 */
import { Button, Group, RadioGroup, Text, at, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 12;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;
const ALIGNMENTS = ['Left', 'Center', 'Right', 'Justify'] as const;

export default defineExample({
  title: 'Radio Group Lab',
  blurb: 'Choose one alignment and watch arrows select immediately while a disabled option is skipped.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const alignment = signal(0);
    const status = signal('ready');
    const group = new RadioGroup({
      labels: ['~L~eft', '~C~enter', '~R~ight', '~J~ustify'],
      value: alignment,
    });
    group.setItemEnabled(3, false);

    const dialog = new Template1Dialog({
      title: ' Radio Group Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(
      at(new Text('One required choice — moving the highlight selects immediately.'), 0, 0, CONTENT_WIDTH, 1),
    );
    content.add(at(group, 0, 2, 24, 4));
    content.add(at(new Text('Exactly one marker is filled'), 28, 2, 30, 1));
    content.add(at(new Text('Justify is disabled'), 28, 3, 30, 1));
    content.add(at(new Text('Up/Down wrap past the ends'), 28, 4, 30, 1));
    content.add(at(new Text('External index writes repaint'), 28, 5, 30, 1));
    content.add(at(new Text(() => `Alignment: ${ALIGNMENTS[alignment()] ?? 'invalid'}`), 0, 7, 28, 1));
    content.add(at(new Text(() => `Selected index: ${alignment()} · ${status()}`), 0, 8, 42, 1));
    content.add(
      at(
        new Button('R~e~set Left', {
          onClick: () => {
            alignment.set(0);
            status.set('reset');
          },
        }),
        44,
        7,
        14,
        2,
      ),
    );
    content.add(at(new Text('Up/Down selects, wraps, skips disabled · Space/click selects'), 0, 10, 60, 1));
    content.add(at(new Text('Alt+L/C/R/J selects · disabled J is inert · Alt+E resets'), 0, 11, 60, 1));

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
