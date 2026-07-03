/**
 * Story: `ProgressBar` (RD-18) — a determinate bar with smooth sub-cell fill (a documented new
 * component; TV had no gauge class, AR-186).
 *
 * Three bars driven 0→100% by a shared `~S~tep +10%` button (wrapping at the top) and a `~R~eset`,
 * with a live percent echo. Each shows a different label position (PA-13): a knockout `NN%` caption
 * (PA-12 — reads on the bar, no grey box) plus a `top-left` label, a `left` label, and a `right`
 * label. Under Unicode caps the fill is smooth (eighth-block partials over a `░` track); under ASCII
 * caps it degrades to whole-cell `#`/`-`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Button, Text, ProgressBar, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const progressBarStory: Story = {
  id: 'feedback/progress-bar',
  category: 'Feedback',
  title: 'Progress Bar',
  rd: 'RD-18',
  blurb: 'ProgressBar: smooth fill · knockout % caption · label top/left/right · Step (Alt-S) / Reset (Alt-R).',
  build(ctx: StoryContext) {
    const value = signal(0.4);
    const barW = Math.max(12, Math.min(ctx.width - 2, 40));
    const g = new Group();

    // top-left label + knockout caption (two rows).
    g.add(
      at(new ProgressBar({ value, caption: true, label: 'Downloading…', labelPosition: 'top-left' }), 1, 1, barW, 2),
    );
    // inline left label + caption (one row).
    g.add(at(new ProgressBar({ value, caption: true, label: 'Copy', labelPosition: 'left' }), 1, 4, barW, 1));
    // inline right label (the percent echo lives to the right).
    g.add(
      at(
        new ProgressBar({ value, label: () => `${Math.round(value() * 100)}%`, labelPosition: 'right' }),
        1,
        6,
        barW,
        1,
      ),
    );

    g.add(
      at(
        new Button('~S~tep +10%', {
          onClick: () => value.set(value() >= 1 ? 0 : Math.min(1, Math.round((value() + 0.1) * 10) / 10)),
        }),
        1,
        8,
        15,
        2,
      ),
    );
    g.add(at(new Button('~R~eset', { onClick: () => value.set(0) }), 18, 8, 11, 2));

    g.add(
      at(
        new Text('Tab moves focus · Space / Enter activates · Alt-S steps, Alt-R resets.'),
        1,
        11,
        Math.max(10, ctx.width - 2),
        1,
      ),
    );
    return g;
  },
};
