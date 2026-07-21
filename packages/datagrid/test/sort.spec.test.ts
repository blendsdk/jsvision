/**
 * Specification tests (immutable oracles) — the pure multi-key sort model
 * `sortRowsMulti` (RD-05; plan doc plans/sorting/03-01, 07-testing-strategy
 * ST-3 … ST-12).
 *
 * `sortRowsMulti(rows, keys, columns)` orders a row snapshot by an ordered list
 * of `SortKey`s, comparing each column's TYPED value (never its formatted text).
 * It is stable (ties keep source order), never mutates the input, drops keys
 * whose `columnId` is unknown, and honours a column's `compare`/`nulls`.
 *
 * Expectations derive from the requirements/spec docs, never from the
 * implementation. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { column } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { sortRowsMulti } from '../src/sort.js';

/** Build the `ReadonlyMap<id, column>` the sorter consumes. */
function mapOf<T>(...cols: GridColumn<T>[]): ReadonlyMap<string, GridColumn<T>> {
  return new Map(cols.map((c) => [c.id, c]));
}

// ST-3 — a numeric column orders by VALUE (9 before 1000), not lexically ("1000" < "9").
test('ST-3: should order a numeric column by value, not lexically', () => {
  interface N {
    v: number;
  }
  const col = column<N, number>({ id: 'v', title: 'V', value: (r) => r.v });
  const out = sortRowsMulti([{ v: 1000 }, { v: 9 }], [{ columnId: 'v', dir: 'asc' }], mapOf(col));
  expect(out.map((r) => r.v)).toEqual([9, 1000]);
});

// ST-4 — two keys: rows tie on `a`, fall through to `b`.
test('ST-4: should order by the first key then fall through to the second on a tie', () => {
  interface AB {
    a: string;
    b: number;
  }
  const a = column<AB, string>({ id: 'a', title: 'A', value: (r) => r.a });
  const b = column<AB, number>({ id: 'b', title: 'B', value: (r) => r.b });
  const out = sortRowsMulti(
    [
      { a: 'x', b: 2 },
      { a: 'x', b: 1 },
      { a: 'a', b: 5 },
    ],
    [
      { columnId: 'a', dir: 'asc' },
      { columnId: 'b', dir: 'asc' },
    ],
    mapOf(a, b),
  );
  expect(out).toEqual([
    { a: 'a', b: 5 },
    { a: 'x', b: 1 },
    { a: 'x', b: 2 },
  ]);
});

// ST-5 — equal keys retain source order (stable).
test('ST-5: should keep source order for equal-key rows (stable)', () => {
  interface AB {
    a: string;
    b: number;
  }
  const a = column<AB, string>({ id: 'a', title: 'A', value: (r) => r.a });
  const out = sortRowsMulti(
    [
      { a: 'same', b: 1 },
      { a: 'same', b: 2 },
      { a: 'same', b: 3 },
    ],
    [{ columnId: 'a', dir: 'asc' }],
    mapOf(a),
  );
  expect(out.map((r) => r.b)).toEqual([1, 2, 3]);
});

// ST-6 — strings compare case-insensitively: apple/Apple adjacent, both before banana.
test('ST-6: should compare strings case-insensitively', () => {
  interface S {
    s: string;
  }
  const col = column<S, string>({ id: 's', title: 'S', value: (r) => r.s });
  const out = sortRowsMulti(
    [{ s: 'banana' }, { s: 'Apple' }, { s: 'apple' }],
    [{ columnId: 's', dir: 'asc' }],
    mapOf(col),
  );
  const vals = out.map((r) => r.s);
  expect(vals[2]).toBe('banana'); // banana sorts last
  expect(vals.slice(0, 2).map((v) => v.toLowerCase())).toEqual(['apple', 'apple']); // both apples adjacent, before banana
});

// ST-7 — a column's custom `compare` overrides the type-aware default.
test('ST-7: should honour a custom compare over the default order', () => {
  interface W {
    w: string;
  }
  // Order by string length; alphabetical order would differ (aaa, bbbb, zz).
  const col = column<W, string>({ id: 'w', title: 'W', value: (r) => r.w, compare: (a, b) => a.length - b.length });
  const out = sortRowsMulti([{ w: 'bbbb' }, { w: 'aaa' }, { w: 'zz' }], [{ columnId: 'w', dir: 'asc' }], mapOf(col));
  expect(out.map((r) => r.w)).toEqual(['zz', 'aaa', 'bbbb']);
});

// ST-8 — nulls:'first' places null/undefined values before non-null.
test("ST-8: should place nulls first when nulls:'first'", () => {
  interface NN {
    v: number | null;
  }
  const col = column<NN, number | null>({ id: 'v', title: 'V', value: (r) => r.v, nulls: 'first' });
  const out = sortRowsMulti([{ v: 5 }, { v: null }, { v: 1 }], [{ columnId: 'v', dir: 'asc' }], mapOf(col));
  expect(out.map((r) => r.v)).toEqual([null, 1, 5]);
});

// ST-9 — default nulls ('last') keep nulls last in BOTH directions (absolute of dir).
test('ST-9: should keep default nulls last in both asc and desc (absolute of dir)', () => {
  interface NN {
    v: number | null;
  }
  const col = column<NN, number | null>({ id: 'v', title: 'V', value: (r) => r.v });
  const rows = [{ v: 5 }, { v: null }, { v: 1 }];
  const asc = sortRowsMulti(rows, [{ columnId: 'v', dir: 'asc' }], mapOf(col));
  expect(asc.map((r) => r.v)).toEqual([1, 5, null]);
  const desc = sortRowsMulti(rows, [{ columnId: 'v', dir: 'desc' }], mapOf(col));
  expect(desc.map((r) => r.v)).toEqual([5, 1, null]); // non-nulls reversed, nulls STILL last
});

// ST-10 — an unknown columnId key is dropped; the remaining valid keys still sort. No throw.
test('ST-10: should drop an unknown columnId key and sort by the rest', () => {
  interface N {
    v: number;
  }
  const col = column<N, number>({ id: 'v', title: 'V', value: (r) => r.v });
  const out = sortRowsMulti(
    [{ v: 1000 }, { v: 9 }],
    [
      { columnId: 'nope', dir: 'asc' },
      { columnId: 'v', dir: 'asc' },
    ],
    mapOf(col),
  );
  expect(out.map((r) => r.v)).toEqual([9, 1000]);
});

// ST-11 — an empty key list returns source order and does not mutate the input.
test('ST-11: should return source order and not mutate the input for an empty key list', () => {
  interface N {
    v: number;
  }
  const col = column<N, number>({ id: 'v', title: 'V', value: (r) => r.v });
  const rows = [{ v: 1000 }, { v: 9 }];
  const snapshot = rows.map((r) => r.v);
  const out = sortRowsMulti(rows, [], mapOf(col));
  expect(out.map((r) => r.v)).toEqual([1000, 9]); // source order
  expect(rows.map((r) => r.v)).toEqual(snapshot); // input unmutated
});

// ST-12 — a single desc key reverses the ascending non-null order.
test('ST-12: should reverse the ascending order for a single desc key', () => {
  interface N {
    v: number;
  }
  const col = column<N, number>({ id: 'v', title: 'V', value: (r) => r.v });
  const out = sortRowsMulti([{ v: 9 }, { v: 1000 }, { v: 50 }], [{ columnId: 'v', dir: 'desc' }], mapOf(col));
  expect(out.map((r) => r.v)).toEqual([1000, 50, 9]);
});
