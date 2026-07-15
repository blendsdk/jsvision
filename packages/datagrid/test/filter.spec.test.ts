/**
 * Specification tests (immutable oracle) — the pure filter model `filter.ts`.
 *
 * `filterRows(rows, model, columns)` keeps the rows that satisfy EVERY active column filter (AND).
 * Text ops and the value-list match the FORMATTED display label (what the user sees); number/date
 * filters evaluate the TYPED value and fail closed on a type mismatch or nil. `filterRows` never
 * mutates its input and drops filters whose `columnId` is unknown. `computeDistinct` enumerates the
 * sorted distinct display labels (nil → the empty label); `resolveFilterType` picks the popup's
 * operator family from an optional override or a sampled value.
 *
 * Expectations derive from the requirements/spec docs, never from the implementation. The `.js`
 * import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import type { CalendarDate } from '@jsvision/ui';
import { column } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { filterRows, computeDistinct, resolveFilterType } from '../src/filter.js';
import type { ColumnFilter } from '../src/filter.js';

/** Build the `ReadonlyMap<id, column>` the filter evaluator consumes. */
function mapOf<T>(...cols: GridColumn<T>[]): ReadonlyMap<string, GridColumn<T>> {
  return new Map(cols.map((c) => [c.id, c]));
}
/** Build a filter model from `[columnId, filter]` pairs. */
function modelOf(...entries: [string, ColumnFilter][]): ReadonlyMap<string, ColumnFilter> {
  return new Map(entries);
}
/** A civil date literal. */
const cd = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

interface Named {
  name: string;
}
const nameCol = column<Named, string>({ id: 'name', title: 'Name', value: (r) => r.name });

// ST-1 — text `contains` folds case and matches the formatted display.
test('ST-1: should keep rows whose formatted label contains the needle, case-insensitively', () => {
  const rows: Named[] = [{ name: 'Alice' }, { name: 'Bob' }];
  const lower = filterRows(rows, modelOf(['name', { kind: 'text', op: 'contains', value: 'ali' }]), mapOf(nameCol));
  expect(lower.map((r) => r.name)).toEqual(['Alice']);
  const upper = filterRows(rows, modelOf(['name', { kind: 'text', op: 'contains', value: 'ALI' }]), mapOf(nameCol));
  expect(upper.map((r) => r.name)).toEqual(['Alice']); // the needle is folded too
});

// ST-2 — text `startsWith` / `endsWith` / `equals` fold case.
test('ST-2: should honour startsWith / endsWith / equals (case-folded)', () => {
  const rows: Named[] = [{ name: 'Alice' }, { name: 'Bob' }];
  const start = filterRows(rows, modelOf(['name', { kind: 'text', op: 'startsWith', value: 'a' }]), mapOf(nameCol));
  expect(start.map((r) => r.name)).toEqual(['Alice']);
  const end = filterRows(rows, modelOf(['name', { kind: 'text', op: 'endsWith', value: 'e' }]), mapOf(nameCol));
  expect(end.map((r) => r.name)).toEqual(['Alice']);
  const eq = filterRows(rows, modelOf(['name', { kind: 'text', op: 'equals', value: 'alice' }]), mapOf(nameCol));
  expect(eq.map((r) => r.name)).toEqual(['Alice']); // whole-label equality, folded
});

interface Money {
  amount: number;
}
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const amountCol = column<Money, number>({
  id: 'amount',
  title: 'Amount',
  value: (r) => r.amount,
  format: (v) => eur.format(v),
});

// ST-3 — number `between` is inclusive and evaluates the numeric value, not the currency text.
test('ST-3: should apply number between inclusively on the numeric value, not the formatted text', () => {
  const rows: Money[] = [50, 100, 300, 500, 900].map((amount) => ({ amount }));
  const out = filterRows(
    rows,
    modelOf(['amount', { kind: 'number', op: 'between', a: 100, b: 500 }]),
    mapOf(amountCol),
  );
  expect(out.map((r) => r.amount)).toEqual([100, 300, 500]); // inclusive bounds
});

interface NumOrText {
  v: number | string;
}
const nvCol = column<NumOrText, number | string>({ id: 'v', title: 'V', value: (r) => r.v });

// ST-4 — number gt / lt / eq compare the numeric value; a non-numeric value never matches (fail closed).
test('ST-4: should compare gt/lt/eq numerically and never match a non-numeric value', () => {
  const rows: NumOrText[] = [{ v: 50 }, { v: 100 }, { v: 300 }, { v: 'x' }];
  expect(filterRows(rows, modelOf(['v', { kind: 'number', op: 'gt', a: 100 }]), mapOf(nvCol)).map((r) => r.v)).toEqual([
    300,
  ]);
  expect(filterRows(rows, modelOf(['v', { kind: 'number', op: 'lt', a: 100 }]), mapOf(nvCol)).map((r) => r.v)).toEqual([
    50,
  ]);
  expect(filterRows(rows, modelOf(['v', { kind: 'number', op: 'eq', a: 100 }]), mapOf(nvCol)).map((r) => r.v)).toEqual([
    100,
  ]);
});

interface Dated {
  d: Date | CalendarDate;
}
const dCol = column<Dated, Date | CalendarDate>({ id: 'd', title: 'D', value: (r) => r.d });

// ST-5 — date ops compare by day ordinal across JS `Date` and `CalendarDate` values (operands CalendarDate).
test('ST-5: should compare dates by day ordinal across Date and CalendarDate values', () => {
  const rows: Dated[] = [
    { d: new Date(2026, 0, 10) }, // 2026-01-10 (JS Date, month 0-based)
    { d: cd(2026, 1, 20) }, // 2026-01-20 (CalendarDate, month 1-based)
    { d: new Date(2026, 1, 5) }, // 2026-02-05
  ];
  const before = filterRows(rows, modelOf(['d', { kind: 'date', op: 'before', a: cd(2026, 1, 20) }]), mapOf(dCol));
  expect(before).toHaveLength(1); // only 2026-01-10
  const after = filterRows(rows, modelOf(['d', { kind: 'date', op: 'after', a: cd(2026, 1, 20) }]), mapOf(dCol));
  expect(after).toHaveLength(1); // only 2026-02-05
  const on = filterRows(rows, modelOf(['d', { kind: 'date', op: 'on', a: cd(2026, 1, 20) }]), mapOf(dCol));
  expect(on).toHaveLength(1); // the CalendarDate 2026-01-20, matched by day
  const between = filterRows(
    rows,
    modelOf(['d', { kind: 'date', op: 'between', a: cd(2026, 1, 1), b: cd(2026, 1, 31) }]),
    mapOf(dCol),
  );
  expect(between).toHaveLength(2); // both January entries, not the February one
});

interface MaybeName {
  name: string | null;
}
const maybeNameCol = column<MaybeName, string | null>({ id: 'name', title: 'Name', value: (r) => r.name });

// ST-6 — set membership is on the formatted label; a nil value has the empty label.
test('ST-6: should match set membership on the formatted label (nil → empty label)', () => {
  const rows: MaybeName[] = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Cara' }, { name: null }];
  const picked = filterRows(
    rows,
    modelOf(['name', { kind: 'set', selected: new Set(['Alice', 'Bob']) }]),
    mapOf(maybeNameCol),
  );
  expect(picked.map((r) => r.name)).toEqual(['Alice', 'Bob']);
  const nils = filterRows(rows, modelOf(['name', { kind: 'set', selected: new Set(['']) }]), mapOf(maybeNameCol));
  expect(nils.map((r) => r.name)).toEqual([null]); // selecting '' keeps the nil rows
});

interface Tagged {
  v: number;
  tag: string;
}
const tvCol = column<Tagged, number>({ id: 'v', title: 'V', value: (r) => r.v });

// ST-7 — a custom predicate receives the typed value and the row.
test('ST-7: should pass the typed value and row to a custom predicate', () => {
  const rows: Tagged[] = [
    { v: -1, tag: 'a' },
    { v: 2, tag: 'b' },
    { v: 0, tag: 'c' },
  ];
  const out = filterRows(
    rows,
    modelOf(['v', { kind: 'custom', predicate: (v) => typeof v === 'number' && v > 0 }]),
    mapOf(tvCol),
  );
  expect(out.map((r) => r.tag)).toEqual(['b']);
});

interface Sale {
  region: string;
  qty: number;
}
const regionCol = column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region });
const qtyCol = column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty });

// ST-8 — multiple column filters combine with AND.
test('ST-8: should keep a row only when it satisfies every active column filter (AND)', () => {
  const rows: Sale[] = [
    { region: 'east', qty: 300 }, // matches both
    { region: 'east', qty: 50 }, // region ok, qty out of range
    { region: 'west', qty: 300 }, // qty ok, region mismatch
  ];
  const model = modelOf(
    ['region', { kind: 'text', op: 'contains', value: 'ea' }],
    ['qty', { kind: 'number', op: 'between', a: 100, b: 500 }],
  );
  expect(filterRows(rows, model, mapOf(regionCol, qtyCol))).toEqual([{ region: 'east', qty: 300 }]);
});

// ST-9 — an empty model returns a new array in source order and does not mutate the input.
test('ST-9: should return a new array in source order for an empty model, without mutating input', () => {
  const rows: Sale[] = [
    { region: 'west', qty: 9 },
    { region: 'east', qty: 1000 },
  ];
  const snapshot = rows.map((r) => r.region);
  const out = filterRows(rows, new Map(), mapOf(regionCol, qtyCol));
  expect(out.map((r) => r.region)).toEqual(['west', 'east']); // source order
  expect(out).not.toBe(rows); // a fresh array
  expect(rows.map((r) => r.region)).toEqual(snapshot); // input unmutated
});

// ST-10 — an unknown-column filter is dropped; the remaining filters still apply.
test('ST-10: should drop a filter whose columnId is unknown and apply the rest', () => {
  const rows: Sale[] = [
    { region: 'east', qty: 300 },
    { region: 'west', qty: 50 },
  ];
  const model = modelOf(
    ['nope', { kind: 'text', op: 'contains', value: 'zzz' }], // unknown column — must be ignored
    ['qty', { kind: 'number', op: 'gt', a: 100 }],
  );
  expect(filterRows(rows, model, mapOf(regionCol, qtyCol))).toEqual([{ region: 'east', qty: 300 }]);
});

// ST-11 — computeDistinct dedups + sorts (nil → empty); resolveFilterType infers and honours the override.
test('ST-11: should compute sorted distinct labels and resolve the filter type (infer + override)', () => {
  interface Q {
    v: string | null;
  }
  const col = column<Q, string | null>({ id: 'v', title: 'V', value: (r) => r.v });
  const rows: Q[] = [{ v: 'Ada' }, { v: 'Ada' }, { v: 'Bo' }, { v: null }];
  expect(computeDistinct(rows, col)).toEqual(['', 'Ada', 'Bo']); // deduped, sorted, nil → ''

  const plain = column<Q, unknown>({ id: 'v', title: 'V', value: (r) => r.v });
  expect(resolveFilterType(plain, 42)).toBe('number');
  expect(resolveFilterType(plain, new Date())).toBe('date');
  expect(resolveFilterType(plain, 'hello')).toBe('text');
  const overridden = column<Q, unknown>({ id: 'v', title: 'V', value: (r) => r.v, filterType: 'date' });
  expect(resolveFilterType(overridden, 42)).toBe('date'); // the override wins over the numeric sample
});
