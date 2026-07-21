/**
 * Implementation tests (edges & internals) — the pure filter model `filter.ts`.
 *
 * Covers the degenerate `between` (with `b` omitted), nil values under every kind, day-ordinal
 * boundaries (time-of-day ignored, `Date`/`CalendarDate` parity, month/year rollover), collator tie
 * ordering, and non-mutation. Everything is exercised through the public `filterRows`/`computeDistinct`
 * surface. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import type { CalendarDate } from '@jsvision/ui';
import { column } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { filterRows, computeDistinct } from '../src/filter.js';
import type { ColumnFilter } from '../src/filter.js';

function mapOf<T>(...cols: GridColumn<T>[]): ReadonlyMap<string, GridColumn<T>> {
  return new Map(cols.map((c) => [c.id, c]));
}
function one(columnId: string, filter: ColumnFilter): ReadonlyMap<string, ColumnFilter> {
  return new Map([[columnId, filter]]);
}
const cd = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

interface N {
  v: number;
}
const nCol = column<N, number>({ id: 'v', title: 'V', value: (r) => r.v });

interface D {
  d: Date | CalendarDate | null;
}
const dCol = column<D, Date | CalendarDate | null>({ id: 'd', title: 'D', value: (r) => r.d });

test('number between with b omitted is a one-point range (eq a)', () => {
  const rows: N[] = [{ v: 99 }, { v: 100 }, { v: 101 }];
  const out = filterRows(rows, one('v', { kind: 'number', op: 'between', a: 100 }), mapOf(nCol));
  expect(out.map((r) => r.v)).toEqual([100]);
});

test('date between with b omitted matches only that single day', () => {
  const rows: D[] = [{ d: cd(2026, 5, 9) }, { d: cd(2026, 5, 10) }, { d: cd(2026, 5, 11) }];
  const out = filterRows(rows, one('d', { kind: 'date', op: 'between', a: cd(2026, 5, 10) }), mapOf(dCol));
  expect(out).toEqual([{ d: cd(2026, 5, 10) }]);
});

test('a nil value fails closed under number / date / text, and is kept only when the empty label is selected', () => {
  const rows: D[] = [{ d: null }];
  expect(filterRows(rows, one('d', { kind: 'number', op: 'gt', a: 0 }), mapOf(dCol))).toEqual([]);
  expect(filterRows(rows, one('d', { kind: 'date', op: 'on', a: cd(2026, 1, 1) }), mapOf(dCol))).toEqual([]);
  expect(filterRows(rows, one('d', { kind: 'text', op: 'contains', value: 'x' }), mapOf(dCol))).toEqual([]);
  const nils = filterRows(rows, one('d', { kind: 'set', selected: new Set(['']) }), mapOf(dCol));
  expect(nils).toEqual([{ d: null }]); // the nil label '' is in the selection
});

test('a custom predicate receives a nil value and decides', () => {
  const rows: D[] = [{ d: null }, { d: cd(2026, 1, 1) }];
  const out = filterRows(rows, one('d', { kind: 'custom', predicate: (v) => v === null }), mapOf(dCol));
  expect(out).toEqual([{ d: null }]);
});

test('date comparison ignores time-of-day (a late-evening Date still matches its day)', () => {
  const rows: D[] = [{ d: new Date(2026, 0, 1, 23, 59, 59) }]; // 2026-01-01, late evening
  const on = filterRows(rows, one('d', { kind: 'date', op: 'on', a: cd(2026, 1, 1) }), mapOf(dCol));
  expect(on).toHaveLength(1);
});

test('date ordinal orders correctly across a month/year boundary', () => {
  const rows: D[] = [{ d: new Date(2025, 11, 31) }, { d: cd(2026, 1, 1) }]; // 2025-12-31, 2026-01-01
  const before = filterRows(rows, one('d', { kind: 'date', op: 'before', a: cd(2026, 1, 1) }), mapOf(dCol));
  expect(before).toEqual([{ d: new Date(2025, 11, 31) }]);
});

interface S {
  s: string;
}
const sCol = column<S, string>({ id: 's', title: 'S', value: (r) => r.s });

test('computeDistinct sorts case-insensitively and keeps case-only ties adjacent', () => {
  const rows: S[] = [{ s: 'banana' }, { s: 'Apple' }, { s: 'apple' }];
  const out = computeDistinct(rows, sCol);
  expect(out).toHaveLength(3); // 'Apple' and 'apple' are distinct labels (exact-string dedup)
  expect(out[2]).toBe('banana'); // banana sorts last
  expect(out.slice(0, 2).map((v) => v.toLowerCase())).toEqual(['apple', 'apple']); // the two apples adjacent, before banana
});

test('filterRows preserves source order among survivors and never mutates the input', () => {
  const rows: N[] = [{ v: 3 }, { v: 1 }, { v: 2 }];
  const snapshot = rows.map((r) => r.v);
  const out = filterRows(rows, one('v', { kind: 'number', op: 'gt', a: 1 }), mapOf(nCol));
  expect(out.map((r) => r.v)).toEqual([3, 2]); // source order kept
  expect(rows.map((r) => r.v)).toEqual(snapshot); // input unmutated
  expect(out).not.toBe(rows); // a fresh array
});
