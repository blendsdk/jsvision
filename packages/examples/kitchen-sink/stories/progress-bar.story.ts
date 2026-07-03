/**
 * Story: `ProgressBar` (RD-18) — a determinate bar with smooth sub-cell fill (a documented new
 * component; TV had no gauge class, AR-186).
 *
 * A captioned bar driven 0→100% by a `~S~tep +10%` button (wrapping at the top) and a `~R~eset`
 * button, with a live percent echo. Under Unicode caps the fill is smooth (eighth-block partials over
 * a `░` track); under ASCII caps it degrades to whole-cell `#`/`-`.
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
  blurb: 'ProgressBar: smooth sub-cell fill · Step +10% (Alt-S) / Reset (Alt-R) · live percent echo.',
  build(ctx: StoryContext) {
    const value = signal(0.4);
    const barW = Math.max(10, Math.min(ctx.width - 2, 40));
    const g = new Group();

    g.add(at(new ProgressBar({ value, caption: true }), 1, 1, barW, 1));

    g.add(
      at(
        new Button('~S~tep +10%', {
          onClick: () => value.set(value() >= 1 ? 0 : Math.min(1, Math.round((value() + 0.1) * 10) / 10)),
        }),
        1,
        3,
        15,
        2,
      ),
    );
    g.add(at(new Button('~R~eset', { onClick: () => value.set(0) }), 18, 3, 11, 2));

    g.add(at(new Text(() => `value: ${Math.round(value() * 100)}%`), 1, 6, Math.max(10, ctx.width - 2), 1));
    g.add(
      at(
        new Text('Tab moves focus · Space / Enter activates · Alt-S steps, Alt-R resets.'),
        1,
        7,
        Math.max(10, ctx.width - 2),
        1,
      ),
    );
    return g;
  },
};
