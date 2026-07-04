/**
 * Specification test (immutable oracle) — jsvision-ui RD-20 `CalendarDate` value + helpers (ST-1).
 *
 * Source: RD-20 AC-1 → ST-1 (plans/date-family/03-01-calendar-date.md, 07-testing-strategy.md; AR-196
 * / PA-7). The civil-date value type + pure, zero-dep helpers + `Date`/ISO interop. Expectations derive
 * from the spec + the `calendar.cpp` Zeller decode — never the implementation. `parseISO` is range-
 * validated and never throws / never yields an invalid date (AC-1/AC-17).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { daysInMonth, dayOfWeek, toISO, parseISO, fromDate, toDate } from '../src/date/calendar-date.js';

test('ST-1: daysInMonth is Gregorian leap-correct (leap / century / normal)', () => {
  expect(daysInMonth(2024, 2)).toBe(29); // divisible by 4, not a century → leap
  expect(daysInMonth(2100, 2)).toBe(28); // century not divisible by 400 → NOT leap
  expect(daysInMonth(2000, 2)).toBe(29); // century divisible by 400 → leap
  expect(daysInMonth(2026, 4)).toBe(30); // April
  expect(daysInMonth(2026, 2)).toBe(28); // non-leap February
});

test('ST-1: dayOfWeek is 0=Sunday…6=Saturday (Zeller, calendar.cpp:100-121)', () => {
  expect(dayOfWeek({ year: 2026, month: 9, day: 1 })).toBe(2); // 2026-09-01 is a Tuesday
});

test('ST-1: toISO serializes to zero-padded YYYY-MM-DD', () => {
  expect(toISO({ year: 2026, month: 9, day: 15 })).toBe('2026-09-15');
  expect(toISO({ year: 2026, month: 1, day: 3 })).toBe('2026-01-03'); // zero-padded month + day
});

test('ST-1: parseISO returns null on malformed / out-of-range input (never throws)', () => {
  expect(parseISO('2026-13-01')).toBeNull(); // month out of range
  expect(parseISO('2026-02-30')).toBeNull(); // day out of range for February
  expect(parseISO('nope')).toBeNull(); // not a date shape
});

test('ST-1: parseISO accepts a valid, in-range ISO date', () => {
  expect(parseISO('2026-09-15')).toStrictEqual({ year: 2026, month: 9, day: 15 });
});

test('ST-1: fromDate/toDate round-trip a March date with a 1-based month', () => {
  const cd = fromDate(new Date(2026, 2, 17)); // JS month 2 = March
  expect(cd).toStrictEqual({ year: 2026, month: 3, day: 17 }); // month is 1-based (March = 3)
  const back = toDate(cd);
  expect(back.getFullYear()).toBe(2026);
  expect(back.getMonth()).toBe(2); // JS 0-based March
  expect(back.getDate()).toBe(17);
});
