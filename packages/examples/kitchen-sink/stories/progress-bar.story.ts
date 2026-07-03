/**
 * Story: `ProgressBar` (RD-18) — a determinate bar with smooth sub-cell fill (a documented new
 * component; TV had no gauge class, AR-186).
 *
 * A gallery of every variant, all driven by one shared `value` (so `~S~tep +10%` / `~R~eset` move
 * them together): the knockout `NN%` caption (PA-12 — reads on the bar, no grey box) and all four
 * label positions (PA-13 — `top`/`top-left`/`left`/`right`), plus a plain bar with no caption and no
 * label. Under Unicode caps the fill is smooth (eighth-block partials over a `░` track); under ASCII
 * caps it degrades to whole-cell `#`/`-`. A right-aligned note names each variant.
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
  blurb: 'ProgressBar: knockout % caption · labels top/top-left/left/right · plain · Step (Alt-S) / Reset (Alt-R).',
  build(ctx: StoryContext) {
    const value = signal(0.4);
    const barW = Math.max(16, Math.min(28, ctx.width - 34));
    const noteX = barW + 3;
    const noteW = Math.max(8, ctx.width - noteX - 1);
    const g = new Group();

    // Right-hand note naming a variant, aligned to a bar row.
    const note = (text: string, y: number) => g.add(at(new Text(text), noteX, y, noteW, 1));

    // top-left label + knockout caption (two rows: label on row 0, bar on row 1).
    g.add(
      at(new ProgressBar({ value, caption: true, label: 'Downloading…', labelPosition: 'top-left' }), 1, 0, barW, 2),
    );
    note('label: top-left + caption', 1);

    // top (centred) label + knockout caption (two rows).
    g.add(at(new ProgressBar({ value, caption: true, label: 'Verifying', labelPosition: 'top' }), 1, 3, barW, 2));
    note('label: top (centred) + caption', 4);

    // inline left label + caption (one row; bar shrinks).
    g.add(at(new ProgressBar({ value, caption: true, label: 'Copy', labelPosition: 'left' }), 1, 6, barW, 1));
    note('label: left + caption', 6);

    // inline right label = live percent echo (one row). Padded to a fixed width (`100%` = 4 cells) so
    // the reserved label column never changes as the number grows — otherwise the bar would reflow
    // (shrink by a cell) crossing 9%→10% / 99%→100%.
    g.add(
      at(
        new ProgressBar({ value, label: () => `${Math.round(value() * 100)}%`.padStart(4), labelPosition: 'right' }),
        1,
        7,
        barW,
        1,
      ),
    );
    note('label: right (= live %)', 7);

    // knockout caption only, no label (one row).
    g.add(at(new ProgressBar({ value, caption: true }), 1, 8, barW, 1));
    note('caption only, no label', 8);

    // plain bar — no caption, no label (one row).
    g.add(at(new ProgressBar({ value }), 1, 9, barW, 1));
    note('plain (no caption/label)', 9);

    g.add(
      at(
        new Button('~S~tep +10%', {
          onClick: () => value.set(value() >= 1 ? 0 : Math.min(1, Math.round((value() + 0.1) * 10) / 10)),
        }),
        1,
        11,
        15,
        2,
      ),
    );
    g.add(at(new Button('~R~eset', { onClick: () => value.set(0) }), 18, 11, 11, 2));

    g.add(
      at(
        new Text('Tab moves focus · Space / Enter activates · Alt-S steps, Alt-R resets.'),
        1,
        14,
        Math.max(10, ctx.width - 2),
        1,
      ),
    );
    return g;
  },
};
