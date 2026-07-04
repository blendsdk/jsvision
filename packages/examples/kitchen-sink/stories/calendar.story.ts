/**
 * Story: `Calendar` (RD-20) — a faithful `TCalendarView` month grid extended with a day-navigation
 * cursor, disabled days (Sundays here), an ISO week-number column, and a Monday-first week. Shows the
 * live bound `value` echoed as its ISO string.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Calendar, Text, signal, dayOfWeek, toISO } from '@jsvision/ui';
import type { CalendarDate } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const calendarStory: Story = {
  id: 'date/calendar',
  category: 'Date',
  title: 'Calendar',
  rd: 'RD-20',
  blurb: 'Calendar: a TCalendarView month grid + a day cursor, disabled days, and ISO week numbers.',
  build(ctx: StoryContext) {
    const width = Math.max(40, ctx.width - 2);
    const value = signal<CalendarDate | null>(null);
    const cal = new Calendar({
      value,
      isDisabled: (d) => dayOfWeek(d) === 0, // Sundays disabled (dimmed, non-committable)
      firstDayOfWeek: 1, // Monday-first
      showWeekNumbers: true,
    });

    const g = new Group();
    g.add(at(cal, 1, 0, 23, 8)); // 23 wide (20 grid + 3 week-number column)
    g.add(
      at(
        new Text(() => {
          const v = value();
          return `selected = ${v === null ? '(none)' : toISO(v)}`;
        }),
        1,
        9,
        width,
        1,
      ),
    );
    g.add(
      at(
        new Text('Arrows move the cursor · Enter or click selects · +/- (or ▲▼) change month · Sundays disabled.'),
        1,
        11,
        width,
        1,
      ),
    );
    return g;
  },
};
