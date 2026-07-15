/**
 * Implementation tests — edges of the pure sort model `sortRowsMulti` beyond the
 * spec oracles: Date ordering, non-string/number stringify, empty/single-row,
 * all-null columns, compare+nulls interaction, three-plus keys, and the
 * non-mutation guarantee under a real sort.
 */
import { test, expect } from 'vitest';
import { column } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { sortRowsMulti } from '../src/sort.js';

function mapOf<T>(...cols: GridColumn<T>[]): ReadonlyMap<string, GridColumn<T>> {
  return new Map(cols.map((c) => [c.id, c]));
}

interface N {
  v: number;
}
const nCol = column<N, number>({ id: 'v', title: 'V', value: (r) => r.v });

test('orders a Date column chronologically (asc and desc)', () => {
  interface D {
    d: Date;
  }
  const col = column<D, Date>({ id: 'd', title: 'D', value: (r) => r.d });
  const rows = [{ d: new Date(2020, 0, 1) }, { d: new Date(2000, 0, 1) }, { d: new Date(2010, 0, 1) }];
  const asc = sortRowsMulti(rows, [{ columnId: 'd', dir: 'asc' }], mapOf(col));
  expect(asc.map((r) => r.d.getFullYear())).toEqual([2000, 2010, 2020]);
  const desc = sortRowsMulti(rows, [{ columnId: 'd', dir: 'desc' }], mapOf(col));
  expect(desc.map((r) => r.d.getFullYear())).toEqual([2020, 2010, 2000]);
});

test('compares a boolean column by String(value) (false before true)', () => {
  interface B {
    b: boolean;
  }
  const col = column<B, boolean>({ id: 'b', title: 'B', value: (r) => r.b });
  const out = sortRowsMulti([{ b: true }, { b: false }], [{ columnId: 'b', dir: 'asc' }], mapOf(col));
  expect(out.map((r) => r.b)).toEqual([false, true]); // 'false' < 'true'
});

test('returns [] for empty rows and the single row for a one-row input', () => {
  expect(sortRowsMulti([], [{ columnId: 'v', dir: 'asc' }], mapOf(nCol))).toEqual([]);
  expect(sortRowsMulti([{ v: 5 }], [{ columnId: 'v', dir: 'asc' }], mapOf(nCol)).map((r) => r.v)).toEqual([5]);
});

test('keeps source order for an all-null column (every row ties)', () => {
  interface NN {
    v: number | null;
    tag: number;
  }
  const col = column<NN, number | null>({ id: 'v', title: 'V', value: (r) => r.v });
  const rows = [
    { v: null, tag: 1 },
    { v: null, tag: 2 },
    { v: null, tag: 3 },
  ];
  const out = sortRowsMulti(rows, [{ columnId: 'v', dir: 'asc' }], mapOf(col));
  expect(out.map((r) => r.tag)).toEqual([1, 2, 3]);
});

test('applies compare only to non-null values while nulls:first floats nulls to the top', () => {
  interface W {
    w: string | null;
  }
  const col = column<W, string | null>({
    id: 'w',
    title: 'W',
    value: (r) => r.w,
    compare: (a, b) => String(a).length - String(b).length, // by length; nulls never reach here
    nulls: 'first',
  });
  const out = sortRowsMulti([{ w: 'bbbb' }, { w: null }, { w: 'zz' }], [{ columnId: 'w', dir: 'asc' }], mapOf(col));
  expect(out.map((r) => r.w)).toEqual([null, 'zz', 'bbbb']);
});

test('resolves three keys in priority order', () => {
  interface R3 {
    a: number;
    b: number;
    c: number;
  }
  const a = column<R3, number>({ id: 'a', title: 'A', value: (r) => r.a });
  const b = column<R3, number>({ id: 'b', title: 'B', value: (r) => r.b });
  const c = column<R3, number>({ id: 'c', title: 'C', value: (r) => r.c });
  const rows = [
    { a: 1, b: 1, c: 2 },
    { a: 1, b: 1, c: 1 },
    { a: 1, b: 2, c: 0 },
    { a: 0, b: 9, c: 9 },
  ];
  const out = sortRowsMulti(
    rows,
    [
      { columnId: 'a', dir: 'asc' },
      { columnId: 'b', dir: 'asc' },
      { columnId: 'c', dir: 'asc' },
    ],
    mapOf(a, b, c),
  );
  expect(out).toEqual([
    { a: 0, b: 9, c: 9 },
    { a: 1, b: 1, c: 1 },
    { a: 1, b: 1, c: 2 },
    { a: 1, b: 2, c: 0 },
  ]);
});

test('does not mutate the input array under a real sort', () => {
  const rows = [{ v: 3 }, { v: 1 }, { v: 2 }];
  const out = sortRowsMulti(rows, [{ columnId: 'v', dir: 'asc' }], mapOf(nCol));
  expect(out.map((r) => r.v)).toEqual([1, 2, 3]); // result sorted
  expect(rows.map((r) => r.v)).toEqual([3, 1, 2]); // input untouched
  expect(out).not.toBe(rows); // a fresh array
});
