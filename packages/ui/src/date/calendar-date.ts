/**
 * The civil (wall-clock) date value the whole date family passes around — {@link CalendarDate} — plus
 * a set of pure, dependency-free helpers and JS `Date`/ISO interop. All helpers are side-effect-free:
 * they take and return plain `CalendarDate` values and never mutate their inputs.
 *
 * Notes for callers:
 * - `month` is **1-based** (1 = January … 12 = December).
 * - Day math ({@link addDays}) and {@link addMonths} always return a valid date (month arithmetic
 *   clamps the day to the target month's length).
 * - {@link parseISO} is range-validated: it returns `null` for any malformed or out-of-range input and
 *   never throws or yields an invalid date.
 * - JS `Date` is touched only in {@link fromDate}/{@link toDate}, which read/write local-time fields.
 */

/** A civil (wall-clock) date — no time-of-day, no timezone. `month` is 1-12, `day` is 1-31. */
export interface CalendarDate {
  readonly year: number;
  /** 1-based month: 1 = January … 12 = December. */
  readonly month: number;
  /** Day of the month, 1-31. */
  readonly day: number;
}

/** Fixed month lengths (index 1-12); February is corrected for leap years by {@link daysInMonth}. */
const MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Gregorian leap year: divisible by 4, except centuries not divisible by 400. */
function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Days in a month, Gregorian leap-year-correct. Returns `0` for a month outside 1-12, so an
 * out-of-range value is rejected rather than yielding `NaN`.
 *
 * @param year  The full year (e.g. 2026).
 * @param month The 1-based month (1-12).
 * @returns The number of days in the month (28-31), or 0 if `month` is out of range.
 * @example
 * import { daysInMonth } from '@jsvision/ui';
 *
 * daysInMonth(2024, 2); // 29 (leap year)
 * daysInMonth(2026, 2); // 28
 * daysInMonth(2026, 4); // 30
 */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_DAYS[month];
}

/**
 * Day of week for a civil date, 0 = Sunday … 6 = Saturday.
 *
 * @param date The civil date.
 * @returns 0 (Sunday) … 6 (Saturday).
 * @example
 * import { dayOfWeek } from '@jsvision/ui';
 *
 * dayOfWeek({ year: 2026, month: 7, day: 8 }); // 3 (Wednesday)
 */
export function dayOfWeek(date: CalendarDate): number {
  let month = date.month;
  let year = date.year;
  if (month < 3) {
    month += 10;
    year -= 1;
  } else {
    month -= 2;
  }
  const century = Math.trunc(year / 100);
  const yr = year % 100;
  let dw =
    (Math.trunc((26 * month - 2) / 10) + date.day + yr + Math.trunc(yr / 4) + Math.trunc(century / 4) - 2 * century) %
    7;
  if (dw < 0) dw += 7;
  return dw;
}

/**
 * Add `n` months (may be negative); the day is **clamped** to the target month's length, so the result
 * is always a valid date.
 *
 * @param date The civil date.
 * @param n    Months to add (negative to subtract).
 * @returns A fresh, valid `CalendarDate`.
 * @example
 * import { addMonths } from '@jsvision/ui';
 *
 * addMonths({ year: 2026, month: 1, day: 31 }, 1);  // { year: 2026, month: 2, day: 28 } (day clamped)
 * addMonths({ year: 2026, month: 1, day: 15 }, -2); // { year: 2025, month: 11, day: 15 }
 */
export function addMonths(date: CalendarDate, n: number): CalendarDate {
  const total = date.year * 12 + (date.month - 1) + n;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1; // 1-12, negative-safe
  const day = Math.min(date.day, daysInMonth(year, month));
  return { year, month, day };
}

/**
 * The proleptic-Gregorian day number (Julian Day Number) of a civil date — a monotone integer used to
 * roll {@link addDays} across month/year boundaries without a `Date`. Internal (not exported).
 */
function toDayNumber(date: CalendarDate): number {
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

/** Inverse of {@link toDayNumber}: a Julian Day Number → a civil `CalendarDate`. Internal. */
function fromDayNumber(jdn: number): CalendarDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

/**
 * Add `n` days (may be negative); rolls across month and year boundaries.
 *
 * @param date The civil date.
 * @param n    Days to add (negative to subtract).
 * @returns A fresh, valid `CalendarDate`.
 * @example
 * import { addDays } from '@jsvision/ui';
 *
 * addDays({ year: 2026, month: 1, day: 31 }, 1);  // { year: 2026, month: 2, day: 1 }
 * addDays({ year: 2026, month: 3, day: 1 }, -1);  // { year: 2026, month: 2, day: 28 }
 */
export function addDays(date: CalendarDate, n: number): CalendarDate {
  return fromDayNumber(toDayNumber(date) + n);
}

/**
 * Order two dates: -1 if a<b, 0 if equal, +1 if a>b (compared by year, then month, then day).
 *
 * @param a The left date.
 * @param b The right date.
 * @returns -1 | 0 | 1.
 * @example
 * import { compare } from '@jsvision/ui';
 * import type { CalendarDate } from '@jsvision/ui';
 *
 * compare({ year: 2026, month: 7, day: 8 }, { year: 2026, month: 7, day: 9 }); // -1
 *
 * // Sort an array of dates ascending:
 * const dates: CalendarDate[] = [
 *   { year: 2026, month: 7, day: 9 },
 *   { year: 2026, month: 7, day: 8 },
 * ];
 * dates.sort(compare);
 */
export function compare(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return 0;
}

/** Left-pad a non-negative integer to `width` with '0'. */
function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Serialize to `"YYYY-MM-DD"` (zero-padded).
 *
 * @param date The civil date.
 * @returns The ISO-8601 calendar-date string.
 * @example
 * import { toISO } from '@jsvision/ui';
 *
 * toISO({ year: 2026, month: 7, day: 8 }); // '2026-07-08'
 */
export function toISO(date: CalendarDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Matches a strict `YYYY-MM-DD` shape (4-2-2 digits, `-` separators). */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse `"YYYY-MM-DD"` into a range-validated `CalendarDate`, or `null` on any malformed or
 * out-of-range input (wrong shape, month outside 1-12, or day outside the month's length). Never
 * throws and never yields an invalid date.
 *
 * @param str The candidate string.
 * @returns A valid `CalendarDate`, or `null`.
 * @example
 * import { parseISO } from '@jsvision/ui';
 *
 * parseISO('2026-07-08'); // { year: 2026, month: 7, day: 8 }
 * parseISO('2026-02-30'); // null (out of range)
 * parseISO('nope');       // null
 */
export function parseISO(str: string): CalendarDate | null {
  const m = ISO_RE.exec(str);
  if (m === null) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Read a JS `Date`'s local-time fields into a civil date.
 *
 * @param d A JS `Date` (its local-time fields are read).
 * @returns The civil date.
 * @example
 * import { fromDate } from '@jsvision/ui';
 *
 * fromDate(new Date(2026, 6, 8)); // { year: 2026, month: 7, day: 8 } (JS months are 0-based)
 */
export function fromDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Materialize a JS `Date` at local midnight.
 *
 * @param cd The civil date.
 * @returns A JS `Date` at local midnight.
 * @example
 * import { toDate } from '@jsvision/ui';
 *
 * toDate({ year: 2026, month: 7, day: 8 }); // new Date(2026, 6, 8) — local midnight
 */
export function toDate(cd: CalendarDate): Date {
  return new Date(cd.year, cd.month - 1, cd.day);
}
