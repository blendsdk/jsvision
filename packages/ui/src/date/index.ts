/**
 * `date/` barrel — the RD-20 date family public surface (re-exported by the ui entry `src/index.ts`):
 * the `Calendar` month-grid view, the `DatePicker` dropdown, the `CalendarDate` value type + its pure
 * helpers, and the `DateFormat` field-format model. The pure grid/format internals + `dateFormat()` are
 * exported here for intra-`date/` use but are NOT part of the curated public surface (`src/index.ts`
 * re-exports only the plan-listed symbols).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
export { Calendar } from './calendar.js';
export type { CalendarOptions } from './calendar.js';
export { DatePicker } from './date-picker.js';
export type { DatePickerOptions } from './date-picker.js';

export type { CalendarDate } from './calendar-date.js';
export {
  daysInMonth,
  dayOfWeek,
  addMonths,
  addDays,
  compare,
  toISO,
  parseISO,
  fromDate,
  toDate,
} from './calendar-date.js';

export { dateFormat } from './date-format.js';
export type { DateFormat, DateFormatSpec } from './date-format.js';

export { buildMonthGrid, dayColumn, isoWeek } from './calendar-grid.js';
export type { MonthGrid } from './calendar-grid.js';
