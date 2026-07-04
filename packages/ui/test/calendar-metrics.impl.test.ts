/**
 * Implementation tests — `calendar-metrics.ts` pure geometry (PA-20-runtime density feature).
 *
 * Locks the per-density column/row math + the header composition. The spec oracle (`calendar.spec`
 * ST-10…ST-13) covers the observable rendered behaviour; these assert the geometry helpers directly so
 * a regression in the math is caught in isolation. `.js` specifiers per NodeNext.
 */
import { test, expect } from 'vitest';
import {
  metricsFor,
  dayFieldX,
  weekdayLabelX,
  weekRowY,
  weekdayLabels,
  headerLine,
} from '../src/date/calendar-metrics.js';

test('compact metrics reproduce the TV-exact 20×8 (no footer, week rows packed at y=2..7)', () => {
  const m = metricsFor('compact', false);
  expect(m).toMatchObject({ width: 20, height: 8, cellWidth: 3, weekdayLen: 2, footer: null });
  expect(dayFieldX(m, 0)).toBe(0); // day 2-digit at j*3
  expect(dayFieldX(m, 6)).toBe(18);
  expect(weekRowY(m, 0)).toBe(2);
  expect(weekRowY(m, 5)).toBe(7); // packed (stride 1)
  expect(m.monthUpX).toBe(0);
  expect(m.yearDownX).toBe(19);
});

test('comfortable metrics — 28×10, 4-wide cells, a footer with a right-aligned [ Today ] button', () => {
  const m = metricsFor('comfortable', false);
  expect(m).toMatchObject({ width: 28, height: 10, cellWidth: 4, weekdayLen: 3 });
  expect(dayFieldX(m, 0)).toBe(2); // right-justified 2-digit within the 4-wide cell
  expect(weekdayLabelX(m, 0)).toBe(1);
  expect(m.footer).toMatchObject({ dividerY: 8, textY: 9, todayW: 9, todayX: 19 }); // 28 − '[ Today ]'.length
  expect(m.yearUpX).toBe(26);
  expect(m.yearDownX).toBe(27);
});

test('spacious metrics — 35×15, 5-wide cells, a blank spacer row between weeks (stride 2)', () => {
  const m = metricsFor('spacious', false);
  expect(m).toMatchObject({ width: 35, height: 15, cellWidth: 5, weekStride: 2 });
  expect(weekRowY(m, 0)).toBe(2);
  expect(weekRowY(m, 1)).toBe(4); // +2 (a blank row between)
  expect(weekRowY(m, 5)).toBe(12);
  expect(m.footer).toMatchObject({ dividerY: 13, textY: 14 });
});

test('a week-number column shifts width + every column right by 3', () => {
  const bare = metricsFor('comfortable', false);
  const wk = metricsFor('comfortable', true);
  expect(wk.width).toBe(bare.width + 3);
  expect(wk.wkw).toBe(3);
  expect(dayFieldX(wk, 0)).toBe(dayFieldX(bare, 0) + 3);
  expect(wk.monthUpX).toBe(3); // header shifts past the week# column
});

test('weekdayLabels rotate by firstDayOfWeek at the density width', () => {
  const comfy = metricsFor('comfortable', false);
  expect(weekdayLabels(comfy, 0)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  expect(weekdayLabels(comfy, 1)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  expect(weekdayLabels(metricsFor('compact', false), 0)).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
});

test('headerLine — compact is byte-identical to the shipped header for every month width', () => {
  const m = metricsFor('compact', false);
  expect(headerLine(m, 'September', 2026)).toBe('↑↓ September 2026 ↑↓'); // 14-char block centred in 16
  expect(headerLine(m, 'May', 2026)).toBe('↑↓       May 2026 ↑↓'); // right-justified in setw(9)
  // Comfortable centres the same block in a wider content span; arrows still flank exactly.
  const comfy = metricsFor('comfortable', false);
  const header = headerLine(comfy, 'September', 2026);
  expect(header.length).toBe(comfy.contentWidth);
  expect(header.startsWith('↑↓')).toBe(true);
  expect(header.endsWith('↑↓')).toBe(true);
});
