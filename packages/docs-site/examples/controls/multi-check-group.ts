/**
 * An interactive MultiCheckGroup laboratory showing three ordered states, independent item cycles,
 * wraparound, readable signal feedback, a disabled row, and deterministic reset.
 */
import { Button, Dialog, Group, MultiCheckGroup, Text, at, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 12;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;
const STATE_NAMES = ['Off', 'Partial', 'Full'] as const;

export default defineExample({
  title: 'Multi-check Group Lab',
  blurb: 'Cycle each setting through Off, Partial, and Full while observing wraparound and disabled behavior.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const levels = signal([0, 2, 1, 0]);
    const group = new MultiCheckGroup({
      items: ['~S~ync', '~B~ackup', '~C~ache', 'Re~m~ote'],
      states: ' xX',
      value: levels,
    });
    group.setItemEnabled(3, false);

    const dialog = new Dialog({ title: ' Multi-check Group Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Each row cycles independently: blank = Off, x = Partial, X = Full.'), 0, 0, 60, 1));
    content.add(at(group, 0, 2, 24, 4));
    content.add(at(new Text('State order: Off → Partial → Full → Off'), 28, 2, 32, 1));
    content.add(at(new Text('Remote is disabled'), 28, 3, 32, 1));
    content.add(at(new Text('Signal indexes: 0, 1, 2'), 28, 4, 32, 1));
    content.add(at(new Text('Every press writes a full array'), 28, 5, 32, 1));
    content.add(
      at(
        new Text(
          () =>
            `Sync: ${STATE_NAMES[levels()[0] ?? 0]} · Backup: ${STATE_NAMES[levels()[1] ?? 0]} · ` +
            `Cache: ${STATE_NAMES[levels()[2] ?? 0]}`,
        ),
        0,
        7,
        60,
        1,
      ),
    );
    content.add(at(new Text(() => `Raw indexes: [${levels().join(', ')}]`), 0, 8, 36, 1));
    content.add(
      at(
        new Button('~R~eset', {
          onClick: () => levels.set([0, 2, 1, 0]),
        }),
        46,
        7,
        12,
        2,
      ),
    );
    content.add(at(new Text('Up/Down moves · Space cycles · click cycles an enabled row'), 0, 10, 60, 1));
    content.add(at(new Text('Alt+S/B/C/M cycles · disabled M is inert · Alt+R resets'), 0, 11, 60, 1));

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
