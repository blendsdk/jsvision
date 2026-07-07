/**
 * Pure, view-free month-matrix geometry and ISO-8601 week numbers for {@link Calendar}. No reactivity,
 * no drawing. It arranges a month into a 6-row × 7-column grid of day dates (with `null` in the
 * leading/trailing blank cells), rotates the weekday labels for a Sunday- or Monday-first week, and
 * computes ISO week numbers.
 *
 * Adjacent-month days are left blank (`null`) rather than shown greyed. Week numbers follow the
 * standard row-Thursday ISO-8601 rule and are stable regardless of the first day of the week.
 */
import type { CalendarDate } from './calendar-date.js';
import { dayOfWeek, daysInMonth, addDays } from './calendar-date.js';

/** The base weekday labels, Sunday-first. Rotated by `firstDayOfWeek`. */
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

/** The 6×7 day matrix for a month: cells hold a `CalendarDate` or `null` (leading/trailing blanks). */
export interface MonthGrid {
  /** 7 weekday labels, rotated by `firstDayOfWeek`. */
  readonly weekdayLabels: readonly string[];
  /** 6 rows × 7 cols; a cell is the in-month `CalendarDate` or `null` (drawn blank). */
  readonly rows: readonly (readonly (CalendarDate | null)[])[];
  /** 6 ISO week numbers (the row's Thursday), or `null` for a row with no in-month day. */
  readonly weekNumbers: readonly (number | null)[];
}

/** ISO weekday: Monday = 1 … Sunday = 7 (converts the Sunday=0 {@link dayOfWeek}). */
function isoDow(date: CalendarDate): number {
  return ((dayOfWeek(date) + 6) % 7) + 1;
}

/** Proleptic-Gregorian day number, for whole-day differences (mirrors calendar-date's internal JDN). */
function dayNumber(date: CalendarDate): number {
  const a = Math.floor((14 - date.month) / 12);
  const y = date.year + 4800 - a;
  const m = date.month + 12 * a - 3;
  return (
    date.day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * ISO-8601 week number of a date, labelled by its week's **Thursday**. Week 1 is the week containing
 * the year's first Thursday; stable regardless of the calendar's first day of the week.
 *
 * @param date Any date; its own ISO Monday-based week's Thursday determines the number.
 * @returns The ISO-8601 week number (1-53).
 */
export function isoWeek(date: CalendarDate): number {
  const thursday = addDays(date, 4 - isoDow(date)); // Thursday of this ISO week (Monday + 3)
  const jan1: CalendarDate = { year: thursday.year, month: 1, day: 1 };
  const firstThursday = addDays(jan1, (4 - isoDow(jan1) + 7) % 7); // first Thursday on/after Jan 1
  return Math.floor((dayNumber(thursday) - dayNumber(firstThursday)) / 7) + 1;
}

/**
 * The view column of day-index `j` (0-6): a 3-cell stride per day, offset by the optional week-number
 * column.
 *
 * @param j             The day column index (0 = first weekday shown).
 * @param weekNumberCol Whether a leading 3-cell ISO week-number column is present.
 * @returns The 0-based view column of the day's 2-digit field.
 */
export function dayColumn(j: number, weekNumberCol: boolean): number {
  return (weekNumberCol ? 3 : 0) + j * 3;
}

/**
 * Build the 6×7 month matrix plus weekday labels and per-row week numbers. Cells outside the month are
 * `null`. Week numbers (when requested) use the row's Thursday; a row with no in-month day gets `null`.
 *
 * @param year  The full year.
 * @param month The 1-based month (1-12).
 * @param opts  `firstDayOfWeek` (0=Sun|1=Mon) + whether to compute `weekNumbers`.
 * @returns The {@link MonthGrid}.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  opts: { firstDayOfWeek: 0 | 1; weekNumbers: boolean },
): MonthGrid {
  const { firstDayOfWeek, weekNumbers } = opts;
  const firstOfMonth: CalendarDate = { year, month, day: 1 };
  const leadingOffset = (dayOfWeek(firstOfMonth) - firstDayOfWeek + 7) % 7;
  const startDate = addDays(firstOfMonth, -leadingOffset); // the date shown in row 0, column 0
  const lastDay = daysInMonth(year, month);

  const weekdayLabels = WEEKDAY_LABELS.map((_, j) => WEEKDAY_LABELS[(j + firstDayOfWeek) % 7]);
  const rows: (CalendarDate | null)[][] = [];
  const rowWeekNumbers: (number | null)[] = [];

  for (let i = 0; i < 6; i += 1) {
    const rowDates: CalendarDate[] = [];
    const row: (CalendarDate | null)[] = [];
    for (let j = 0; j < 7; j += 1) {
      const d = addDays(startDate, i * 7 + j);
      rowDates.push(d);
      const inMonth = d.year === year && d.month === month && d.day >= 1 && d.day <= lastDay;
      row.push(inMonth ? d : null);
    }
    rows.push(row);
    // The row's Thursday (the one date in the seven whose dayOfWeek is Thursday) labels the ISO week.
    // A row with no in-month day (entirely adjacent-month) shows no number.
    const hasInMonth = row.some((c) => c !== null);
    if (weekNumbers && hasInMonth) {
      const thursday = rowDates.find((d) => dayOfWeek(d) === 4) ?? rowDates[0];
      rowWeekNumbers.push(isoWeek(thursday));
    } else {
      rowWeekNumbers.push(null);
    }
  }

  return { weekdayLabels, rows, weekNumbers: rowWeekNumbers };
}
