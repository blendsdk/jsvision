/**
 * Specification tests (immutable oracles) — the pure aggregate fold model
 * `foldAggregate` / `formatAggregate` / `isAggregateFn`.
 *
 * `foldAggregate(fn, values)` reduces one column's typed values across the
 * displayed rows: numeric folds (`sum`/`avg`/`min`/`max`) include a value only
 * when it is a finite number (skipping `null`/`undefined`/`NaN`/`±Infinity` and
 * non-numbers); `count` counts every row. `formatAggregate(spec, v, partial)`
 * renders the cell text, appending a `" (loaded)"` honesty qualifier for a
 * partial (not-fully-loaded) source. `isAggregateFn` guards config-time input.
 *
 * Expectations derive from the requirements/spec docs, never from the
 * implementation. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { foldAggregate, formatAggregate, isAggregateFn } from '../src/aggregate.js';

// ST-7 — avg over the finite contributors only: (10 + 20) / 2 = 15 (null skipped).
test('ST-7: should average over the finite contributors only', () => {
  expect(foldAggregate('avg', [10, 20, null])).toBe(15);
});

// ST-8 — a numeric fold skips every non-finite / non-number value.
test('ST-8: should skip non-finite and non-number values in a numeric fold', () => {
  expect(foldAggregate('sum', [10, null, NaN, Infinity, 'x', 20])).toBe(30);
});

// ST-9 — min/max over a mixed-sign set.
test('ST-9: should compute min and max over the finite values', () => {
  expect(foldAggregate('min', [5, -2, 3])).toBe(-2);
  expect(foldAggregate('max', [5, -2, 3])).toBe(5);
});

// ST-10 — count counts every row, nulls included (it ignores the value entirely).
test('ST-10: should count every row including nulls', () => {
  expect(foldAggregate('count', [1, null, 3])).toBe(3);
});

// ST-11 — an empty set: sum and count both fold to 0.
test('ST-11: should fold an empty set to 0 for sum and count', () => {
  expect(foldAggregate('sum', [])).toBe(0);
  expect(foldAggregate('count', [])).toBe(0);
});

// ST-12 — an empty avg/min/max is undefined (blank cell); formatAggregate renders
// undefined as blank and appends " (loaded)" for a partial source.
test('ST-12: should render an empty avg/min/max as blank and label a partial total', () => {
  expect(foldAggregate('avg', [])).toBeUndefined();
  expect(foldAggregate('min', [])).toBeUndefined();
  expect(foldAggregate('max', [])).toBeUndefined();
  // undefined value → blank cell even with a label
  expect(formatAggregate({ fn: 'sum', label: 'Σ' }, undefined, false)).toBe('');
  // a present value on a partial (not-fully-loaded) source carries the "(loaded)" qualifier
  expect(formatAggregate({ fn: 'sum', label: 'Σ' }, 60, true)).toBe('Σ 60 (loaded)');
});

// Additional oracle rows for the renderer + guard from 03-01 §Code Examples / AR-12.
test('ST-12: should render label + formatted value with no qualifier for a complete source', () => {
  expect(formatAggregate({ fn: 'sum', format: (v) => `$${v.toFixed(2)}`, label: 'Σ' }, 60, false)).toBe('Σ $60.00');
  expect(formatAggregate({ fn: 'max' }, undefined, false)).toBe('');
});

test('isAggregateFn: should accept the known reductions and reject anything else', () => {
  for (const fn of ['sum', 'avg', 'min', 'max', 'count']) expect(isAggregateFn(fn)).toBe(true);
  expect(isAggregateFn('median')).toBe(false);
  expect(isAggregateFn('')).toBe(false);
});
