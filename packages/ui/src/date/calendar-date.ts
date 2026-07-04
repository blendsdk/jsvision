/**
 * `CalendarDate` — the civil (wall-clock) date value the whole date family passes around, plus pure,
 * zero-dep helpers and `Date`/ISO interop (RD-20, AR-196 / PA-7). View-free and reactivity-free, so it
 * is unit-testable in isolation. `month` is **1-based** (1-12), TV-faithful (`TCalendarView` uses
 * 1-based months, `calendar.cpp`).
 *
 * Purity: no `Date` except in the two boundary functions {@link fromDate}/{@link toDate}. Day math
 * ({@link addDays}) walks a proleptic-Gregorian day number (Julian Day Number), so it rolls across
 * month/year boundaries without a `Date`. `parseISO` is range-validated and returns `null` on any
 * malformed / out-of-range input — it never throws and never yields an invalid date (AC-1/AC-17).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */

/** A civil (wall-clock) date — no time-of-day, no timezone. `month` is 1-12, `day` is 1-31. (PA-7) */
export interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1-12 (TV-faithful: TCalendarView uses 1-based months)
  readonly day: number; // 1-31
}

/** Fixed month lengths (index 1-12); February is corrected for leap years by {@link daysInMonth}. */
const MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Gregorian leap year: divisible by 4, except centuries not divisible by 400. */
function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Days in a month, Gregorian leap-correct: Feb = 29 when `year%4===0 && (year%100!==0 || year%400===0)`
 * (correcting TV's simpler `year%4==0`, `calendar.cpp:128-129`). Returns `0` for a month outside 1-12
 * (bounds-checked, AC-17) so an out-of-range parse is rejected rather than yielding `NaN`.
 *
 * @param year  The full year (e.g. 2026).
 * @param month The 1-based month (1-12).
 * @returns The number of days in the month (28-31), or 0 if `month` is out of range.
 */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_DAYS[month];
}

/**
 * Day of week, 0 = Sunday … 6 = Saturday — the Zeller congruence transcribed from
 * `TCalendarView`'s `dayOfWeek` (`calendar.cpp:100-121`), with Sunday = 0.
 *
 * @param date The civil date.
 * @returns 0 (Sunday) … 6 (Saturday).
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
    (Math.trunc((26 * month - 2) / 10) + date.day + yr + Math.trunc(yr / 4) + Math.trunc(century / 4) - 2 * century) % 7;
  if (dw < 0) dw += 7;
  return dw;
}

/**
 * Add `n` months (may be negative); the day is **clamped** to the target month's length (so
 * Jan-31 + 1 month → Feb-28/29, never an invalid date). (PA-7)
 *
 * @param date The civil date.
 * @param n    Months to add (negative to subtract).
 * @returns A fresh, valid `CalendarDate`.
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
 * Add `n` days (may be negative); rolls across month/year boundaries via a day-number walk. (PA-7)
 *
 * @param date The civil date.
 * @param n    Days to add (negative to subtract).
 * @returns A fresh, valid `CalendarDate`.
 */
export function addDays(date: CalendarDate, n: number): CalendarDate {
  return fromDayNumber(toDayNumber(date) + n);
}

/**
 * Order two dates: -1 if a<b, 0 if equal, +1 if a>b (year, then month, then day).
 *
 * @param a The left date.
 * @param b The right date.
 * @returns -1 | 0 | 1.
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
 */
export function toISO(date: CalendarDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Matches a strict `YYYY-MM-DD` shape (4-2-2 digits, `-` separators). */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse `"YYYY-MM-DD"` → a range-validated `CalendarDate`, or **null** on any malformed / out-of-range
 * input (bad shape, month∉1-12, day∉1-daysInMonth). Never throws, never yields an invalid date. (AC-1/AC-17)
 *
 * @param str The candidate string.
 * @returns A valid `CalendarDate`, or `null`.
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
 * Read a JS `Date` into a civil date (getFullYear / getMonth()+1 / getDate). The `+1` lives ONLY here.
 *
 * @param d A JS `Date` (its local-time fields are read).
 * @returns The civil date.
 */
export function fromDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Materialize a JS `Date` at local midnight (`new Date(y, m-1, d)`). The `-1` lives ONLY here.
 *
 * @param cd The civil date.
 * @returns A JS `Date` at local midnight.
 */
export function toDate(cd: CalendarDate): Date {
  return new Date(cd.year, cd.month - 1, cd.day);
}
