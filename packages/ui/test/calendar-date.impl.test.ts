/**
 * Implementation tests (edge cases / internals) — RD-20 `CalendarDate` helpers. Companion to
 * `calendar-date.spec.test.ts`: boundary rolls (Dec→Jan, Jan-31→Feb clamp), negative `n`, every
 * `compare` branch, and every malformed `parseISO` shape. `.js` specifiers required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import {
  daysInMonth,
  addDays,
  addMonths,
  compare,
  parseISO,
  toISO,
  fromDate,
  toDate,
} from '../src/date/calendar-date.js';

test('daysInMonth returns 0 for an out-of-range month (bounds-checked, AC-17)', () => {
  expect(daysInMonth(2026, 0)).toBe(0);
  expect(daysInMonth(2026, 13)).toBe(0);
});

test('addDays rolls across month and year boundaries (forward + backward)', () => {
  expect(addDays({ year: 2026, month: 1, day: 31 }, 1)).toStrictEqual({ year: 2026, month: 2, day: 1 });
  expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toStrictEqual({ year: 2027, month: 1, day: 1 });
  expect(addDays({ year: 2026, month: 1, day: 1 }, -1)).toStrictEqual({ year: 2025, month: 12, day: 31 });
  expect(addDays({ year: 2024, month: 2, day: 28 }, 1)).toStrictEqual({ year: 2024, month: 2, day: 29 }); // leap
  expect(addDays({ year: 2024, month: 2, day: 29 }, 1)).toStrictEqual({ year: 2024, month: 3, day: 1 });
});

test('addDays is a stable round-trip over a large offset', () => {
  const d = { year: 2026, month: 7, day: 4 };
  expect(addDays(addDays(d, 400), -400)).toStrictEqual(d);
});

test('addMonths clamps the day to the target month length', () => {
  expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toStrictEqual({ year: 2026, month: 2, day: 28 });
  expect(addMonths({ year: 2024, month: 1, day: 31 }, 1)).toStrictEqual({ year: 2024, month: 2, day: 29 }); // leap
  expect(addMonths({ year: 2026, month: 3, day: 31 }, -1)).toStrictEqual({ year: 2026, month: 2, day: 28 });
});

test('addMonths rolls the year on negative and large offsets (negative-safe modulo)', () => {
  expect(addMonths({ year: 2026, month: 1, day: 15 }, -1)).toStrictEqual({ year: 2025, month: 12, day: 15 });
  expect(addMonths({ year: 2026, month: 6, day: 10 }, 12)).toStrictEqual({ year: 2027, month: 6, day: 10 });
  expect(addMonths({ year: 2026, month: 6, day: 10 }, -18)).toStrictEqual({ year: 2024, month: 12, day: 10 });
});

test('compare covers every branch (year, month, day, equal)', () => {
  expect(compare({ year: 2025, month: 5, day: 5 }, { year: 2026, month: 5, day: 5 })).toBe(-1);
  expect(compare({ year: 2027, month: 1, day: 1 }, { year: 2026, month: 12, day: 31 })).toBe(1);
  expect(compare({ year: 2026, month: 3, day: 5 }, { year: 2026, month: 4, day: 5 })).toBe(-1);
  expect(compare({ year: 2026, month: 5, day: 5 }, { year: 2026, month: 4, day: 5 })).toBe(1);
  expect(compare({ year: 2026, month: 5, day: 4 }, { year: 2026, month: 5, day: 5 })).toBe(-1);
  expect(compare({ year: 2026, month: 5, day: 6 }, { year: 2026, month: 5, day: 5 })).toBe(1);
  expect(compare({ year: 2026, month: 5, day: 5 }, { year: 2026, month: 5, day: 5 })).toBe(0);
});

test('parseISO rejects every malformed shape (never throws)', () => {
  for (const bad of [
    '',
    '2026',
    '2026-1-1',
    '2026/01/01',
    '20260101',
    'abcd-ef-gh',
    '2026-00-10',
    '2026-01-00',
    '2026-01-32',
  ]) {
    expect(parseISO(bad), `parseISO(${JSON.stringify(bad)})`).toBeNull();
  }
});

test('toISO zero-pads all fields', () => {
  expect(toISO({ year: 7, month: 1, day: 2 })).toBe('0007-01-02');
});

test('fromDate/toDate keep the 1-based month at the boundary', () => {
  const d = new Date(2026, 11, 31); // December 31
  expect(fromDate(d)).toStrictEqual({ year: 2026, month: 12, day: 31 });
  const back = toDate({ year: 2026, month: 12, day: 31 });
  expect([back.getFullYear(), back.getMonth(), back.getDate()]).toStrictEqual([2026, 11, 31]);
});
