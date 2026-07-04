/**
 * Implementation tests (edge cases / internals) — RD-20 `calendar-grid` pure math. Companion to the
 * `calendar.spec` geometry oracles: `buildMonthGrid` leading offset per `firstDayOfWeek`, leap
 * February, null blanks, `dayColumn` offsets, and `isoWeek` year-boundary weeks (ISO-8601 standard
 * values). `.js` specifiers required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { buildMonthGrid, dayColumn, isoWeek } from '../src/date/calendar-grid.js';

test('dayColumn is j*3, offset by 3 when the week-number column is present', () => {
  expect(dayColumn(0, false)).toBe(0);
  expect(dayColumn(2, false)).toBe(6);
  expect(dayColumn(6, false)).toBe(18);
  expect(dayColumn(0, true)).toBe(3);
  expect(dayColumn(2, true)).toBe(9);
});

test('buildMonthGrid: leap February 2024 (Feb 1 = Thursday), Sunday-first', () => {
  const g = buildMonthGrid(2024, 2, { firstDayOfWeek: 0, weekNumbers: false });
  expect(g.weekdayLabels).toStrictEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
  // Feb 1 at Thursday column (j=4); the Sun..Wed leading cells are null (previous month).
  expect(g.rows[0].slice(0, 4)).toStrictEqual([null, null, null, null]);
  expect(g.rows[0][4]).toStrictEqual({ year: 2024, month: 2, day: 1 });
  // Feb 29 exists (leap) at grid row 4, Thursday column.
  expect(g.rows[4][4]).toStrictEqual({ year: 2024, month: 2, day: 29 });
});

test('buildMonthGrid: firstDayOfWeek=1 rotates the labels and shifts the leading offset', () => {
  const g = buildMonthGrid(2024, 2, { firstDayOfWeek: 1, weekNumbers: false });
  expect(g.weekdayLabels).toStrictEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  // Monday-first: Feb 1 (Thursday) now at column j=3; cols 0-2 are null.
  expect(g.rows[0].slice(0, 3)).toStrictEqual([null, null, null]);
  expect(g.rows[0][3]).toStrictEqual({ year: 2024, month: 2, day: 1 });
});

test('buildMonthGrid: week numbers null for a fully out-of-month row, present otherwise', () => {
  const g = buildMonthGrid(2026, 9, { firstDayOfWeek: 1, weekNumbers: true });
  // Sept 2026 Monday-first — row 0 Thursday = Sep 3 → ISO week 36.
  expect(g.weekNumbers[0]).toBe(36);
  expect(g.weekNumbers[1]).toBe(37);
  // The last grid row (Oct 5-11) is fully next-month → null (no number shown).
  expect(g.weekNumbers[5]).toBeNull();
});

test('isoWeek: standard year-boundary values (ISO-8601)', () => {
  expect(isoWeek({ year: 2026, month: 1, day: 1 })).toBe(1); // 2026-01-01 is a Thursday → week 1
  expect(isoWeek({ year: 2026, month: 12, day: 31 })).toBe(53); // 2026 starts Thursday → 53 weeks
  expect(isoWeek({ year: 2023, month: 1, day: 1 })).toBe(52); // Sunday → belongs to week 52 of 2022
  expect(isoWeek({ year: 2024, month: 12, day: 30 })).toBe(1); // Monday → week 1 of 2025
});
