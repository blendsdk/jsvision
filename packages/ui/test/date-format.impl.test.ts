/**
 * Implementation tests (edge cases / internals) — RD-20 `date-format`. Each format's parse/serialize
 * round-trip + null cases + the DD/MM vs MM/DD disambiguation. `.js` specifiers required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { dateFormat } from '../src/date/date-format.js';

test('ISO (default): mask, serialize, parse round-trip', () => {
  const f = dateFormat();
  expect(f.mask).toBe('####-##-##');
  expect(f.serialize({ year: 2026, month: 9, day: 5 })).toBe('2026-09-05');
  expect(f.parse('2026-09-05')).toStrictEqual({ year: 2026, month: 9, day: 5 });
});

test('DD/MM/YYYY: mask, serialize, parse in day-month-year order', () => {
  const f = dateFormat('DD/MM/YYYY');
  expect(f.mask).toBe('##/##/####');
  expect(f.serialize({ year: 2026, month: 9, day: 15 })).toBe('15/09/2026');
  expect(f.parse('15/09/2026')).toStrictEqual({ year: 2026, month: 9, day: 15 });
});

test('MM/DD/YYYY: mask, serialize, parse in month-day-year order', () => {
  const f = dateFormat('MM/DD/YYYY');
  expect(f.serialize({ year: 2026, month: 9, day: 15 })).toBe('09/15/2026');
  expect(f.parse('09/15/2026')).toStrictEqual({ year: 2026, month: 9, day: 15 });
});

test('the same digits parse differently under DD/MM vs MM/DD (disambiguation)', () => {
  expect(dateFormat('DD/MM/YYYY').parse('01/02/2026')).toStrictEqual({ year: 2026, month: 2, day: 1 });
  expect(dateFormat('MM/DD/YYYY').parse('01/02/2026')).toStrictEqual({ year: 2026, month: 1, day: 2 });
});

test('parse returns null on incomplete / wrong-separator / out-of-range text', () => {
  const iso = dateFormat();
  expect(iso.parse('2026-09')).toBeNull(); // incomplete
  expect(iso.parse('2026/09/05')).toBeNull(); // wrong separator
  expect(iso.parse('2026-13-01')).toBeNull(); // month out of range
  expect(iso.parse('2026-02-30')).toBeNull(); // day out of range
  const dmy = dateFormat('DD/MM/YYYY');
  expect(dmy.parse('31/02/2026')).toBeNull(); // Feb 31 invalid
  expect(dmy.parse('15-09-2026')).toBeNull(); // wrong separator
});
