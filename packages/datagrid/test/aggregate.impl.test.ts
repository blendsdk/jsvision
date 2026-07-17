/**
 * Implementation tests (edges & internals) for the pure aggregate fold model — precision, mixed-type
 * coercion boundaries, and `formatAggregate` label/format/partial permutations. These cover the corners
 * beyond the spec oracle in `aggregate.spec.test.ts`.
 */
import { test, expect } from 'vitest';
import { foldAggregate, formatAggregate, isAggregateFn } from '../src/aggregate.js';

test('foldAggregate: sum is exact for integer inputs and preserves float precision semantics', () => {
  expect(foldAggregate('sum', [1, 2, 3, 4, 5])).toBe(15);
  // Standard IEEE-754: 0.1 + 0.2 !== 0.3 — the fold does not round, matching plain addition.
  expect(foldAggregate('sum', [0.1, 0.2])).toBeCloseTo(0.3, 10);
});

test('foldAggregate: avg divides by the count of finite contributors, not the row count', () => {
  // 4 rows, 2 finite → 30 / 2 = 15 (the two non-finite entries are excluded from both sum and divisor)
  expect(foldAggregate('avg', [10, 20, null, NaN])).toBe(15);
});

test('foldAggregate: negative zero and mixed signs fold correctly for min/max', () => {
  expect(foldAggregate('min', [-0, 0, 5])).toBe(-0);
  expect(foldAggregate('max', [-5, -1, -10])).toBe(-1);
});

test('foldAggregate: non-number types are skipped by numeric folds but counted by count', () => {
  const mixed = [1, '2', true, null, undefined, {}, [], 3];
  // only 1 and 3 are finite numbers
  expect(foldAggregate('sum', mixed)).toBe(4);
  expect(foldAggregate('avg', mixed)).toBe(2);
  // count counts every element regardless of type
  expect(foldAggregate('count', mixed)).toBe(8);
});

test('foldAggregate: a numeric fold over an all-non-finite set behaves like an empty set', () => {
  expect(foldAggregate('sum', [NaN, Infinity, -Infinity, null])).toBe(0);
  expect(foldAggregate('avg', [NaN, Infinity, 'x'])).toBeUndefined();
  expect(foldAggregate('min', [NaN])).toBeUndefined();
  expect(foldAggregate('max', [null, undefined])).toBeUndefined();
});

test('foldAggregate: count over an empty set is 0 and over a generator counts all yielded items', () => {
  expect(foldAggregate('count', [])).toBe(0);
  function* gen() {
    yield 1;
    yield null;
    yield 3;
  }
  expect(foldAggregate('count', gen())).toBe(3);
});

test('formatAggregate: label-only renders "label value"; no label renders bare value', () => {
  expect(formatAggregate({ fn: 'sum', label: 'Σ' }, 60, false)).toBe('Σ 60');
  expect(formatAggregate({ fn: 'sum' }, 60, false)).toBe('60');
});

test('formatAggregate: format runs before the qualifier and both compose with the label', () => {
  const spec = { fn: 'avg' as const, format: (v: number) => v.toFixed(1), label: 'Avg:' };
  expect(formatAggregate(spec, 12.345, false)).toBe('Avg: 12.3');
  expect(formatAggregate(spec, 12.345, true)).toBe('Avg: 12.3 (loaded)');
});

test('formatAggregate: an undefined value is blank in every label/format/partial permutation', () => {
  expect(formatAggregate({ fn: 'min' }, undefined, false)).toBe('');
  expect(formatAggregate({ fn: 'min', label: 'Min:' }, undefined, false)).toBe('');
  expect(formatAggregate({ fn: 'min', label: 'Min:', format: (v) => `${v}` }, undefined, true)).toBe('');
});

test('formatAggregate: a zero value is rendered (not treated as blank)', () => {
  expect(formatAggregate({ fn: 'sum', label: 'Σ' }, 0, false)).toBe('Σ 0');
});

test('isAggregateFn: is case-sensitive and rejects whitespace-padded names', () => {
  expect(isAggregateFn('Sum')).toBe(false);
  expect(isAggregateFn(' sum ')).toBe(false);
  expect(isAggregateFn('count')).toBe(true);
});
