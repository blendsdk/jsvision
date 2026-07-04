/**
 * Story: `DatePicker` (RD-20) — a one-line masked field + a trailing `▐↓▌` dropdown opening the `Calendar` in the
 * anchored popup, in `DD/MM/YYYY` format. Shows the live bound `value` echoed as its ISO string.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, DatePicker, Label, Text, signal, toISO } from '@jsvision/ui';
import type { CalendarDate } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const datePickerStory: Story = {
  id: 'date/date-picker',
  category: 'Date',
  title: 'DatePicker',
  rd: 'RD-20',
  blurb: 'DatePicker: a masked field + ▐↓▌ opening the calendar dropdown (DD/MM/YYYY format).',
  build(ctx: StoryContext) {
    const width = Math.max(40, ctx.width - 2);
    const value = signal<CalendarDate | null>(null);
    const dp = new DatePicker({ value, format: 'DD/MM/YYYY' });

    const g = new Group();
    g.add(at(new Label('~D~ate', dp.input), 1, 0, 8, 1));
    g.add(at(dp, 10, 0, 16, 1));
    g.add(
      at(
        new Text(() => {
          const v = value();
          return `value = ${v === null ? '(none)' : toISO(v)}`;
        }),
        1,
        2,
        width,
        1,
      ),
    );
    g.add(
      at(
        new Text(
          '↓ / Alt+↓ / the ▐↓▌ button opens the calendar · pick a day to fill the field · Esc or an outside click cancels.',
        ),
        1,
        4,
        width,
        1,
      ),
    );
    return g;
  },
};
