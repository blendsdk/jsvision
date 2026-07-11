/**
 * Story: the flexible **status bar** — the app-shell status line as a general child-view container.
 *
 * It shows one live `statusLine` composed of interactive command items, a flexible `spacer()` that
 * right-aligns everything after it, an embedded `ProgressBar`, and a command-less accessor-text clock
 * — the `‹Exit›‹Tile›  ——fill——  ‹progress› ‹clock›` layout. The row draws its own status-bar
 * background so the flexible gap stays status-coloured. A static snapshot here; in a live app a timer
 * advances the bar and ticks the clock with no manual redraw.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, ProgressBar, statusLine, statusItem, spacer, fixed, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const statusBarStory: Story = {
  id: 'app-shell/status-bar',
  category: 'App Shell',
  title: 'Status Bar',
  blurb: 'A flexible status line: command items + spacer() right-align + an embedded ProgressBar + a live clock.',
  build(ctx: StoryContext) {
    const g = new Group();
    const value = signal(0.66);
    const clock = signal('12:34:56');

    g.add(
      at(
        new Text('The status line is a general row container — any fitting 1-row view can sit on it.'),
        0,
        0,
        Math.max(10, ctx.width - 1),
        1,
      ),
    );

    // The real StatusLine (a Group): direction 'row' + a statusBar background. It has no seam here, so
    // it is a faithful, non-interactive snapshot of the layout. `at()` would drop the row direction, so
    // set an absolute layout that keeps it.
    const barWidth = Math.min(18, Math.max(12, ctx.width - 28));
    const bar = statusLine([
      statusItem('~Alt-X~ Exit', 'quit', 'Alt+X'),
      statusItem('~F4~ Tile', 'tile', 'F4'),
      spacer(),
      fixed(new ProgressBar({ value, caption: true }), barWidth),
      statusItem(() => clock()),
    ]);
    bar.layout = { position: 'absolute', rect: { x: 0, y: 2, width: ctx.width, height: 1 }, direction: 'row' };
    g.add(bar);

    g.add(
      at(
        new Text('spacer() pushes the ProgressBar and the clock to the right edge; the gap keeps the status colour.'),
        0,
        4,
        Math.max(10, ctx.width - 1),
        1,
      ),
    );
    g.add(
      at(
        new Text(
          'statusItem() takes an optional command (a command-less item is a passive label) and live accessor text.',
        ),
        0,
        5,
        Math.max(10, ctx.width - 1),
        1,
      ),
    );

    return g;
  },
};
