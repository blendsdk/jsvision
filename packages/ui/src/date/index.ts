/**
 * Public surface of the date family: the {@link Calendar} month-grid view, the {@link DatePicker}
 * dropdown, the {@link CalendarDate} civil-date value plus its pure helpers, and the field-format
 * model. The grid/format helpers exported here are for building custom date widgets; the curated
 * package entry point re-exports only the widgets and value type.
 */
export { Calendar } from './calendar.js';
export type { CalendarOptions } from './calendar.js';
export { DatePicker } from './date-picker.js';
export type { DatePickerOptions } from './date-picker.js';
export type { CalendarDensity } from './calendar-metrics.js';

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
