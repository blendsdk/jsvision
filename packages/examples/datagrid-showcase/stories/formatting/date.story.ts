/**
 * Formatting · Date — `fmt.date` renders a `CalendarDate` as a locale civil date, and `fmt.datetime`
 * renders a JS `Date` as a locale date+time. Both are display-only (edited via the date-picker editor).
 * The `.js` extension is required by NodeNext ESM resolution.
 */
import { fromDate } from '@jsvision/ui';
import type { CalendarDate } from '@jsvision/ui';
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  day: CalendarDate;
  at: Date;
}

export const fmtDateStory = buildFormatStory<Row>({
  slug: 'date',
  title: 'Date & datetime',
  blurb: 'fmt.date renders a CalendarDate as a locale civil date; fmt.datetime renders a JS Date with time.',
  rows: [
    { id: 1, day: fromDate(new Date(2026, 0, 14)), at: new Date(2026, 0, 14, 9, 30) },
    { id: 2, day: fromDate(new Date(2026, 5, 1)), at: new Date(2026, 5, 1, 17, 5) },
  ],
  columns: [
    column<Row, CalendarDate>({
      id: 'day',
      title: 'fmt.date',
      value: (r) => r.day,
      width: 16,
      ...fmt.date({ locale: 'en-US', style: 'medium' }),
    }),
    column<Row, Date>({
      id: 'at',
      title: 'fmt.datetime',
      value: (r) => r.at,
      width: 24,
      ...fmt.datetime({ locale: 'en-US' }),
    }),
  ],
});
