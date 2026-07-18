/**
 * Implementation tests — internals and edge cases of the column model: the value-aware comparator
 * across number/string/Date/null/mixed, and the type-level guarantee that `column` infers the value
 * type from `value` (a matching `format`/`parse` compiles; a mismatched one is a compile error, which
 * the package's test typecheck enforces via `@ts-expect-error`).
 */
import { test, expect } from 'vitest';
import { column, defaultCompare } from '../src/column.js';

test('should compare numbers numerically', () => {
  expect(Math.sign(defaultCompare(9, 1000))).toBe(-1);
  expect(Math.sign(defaultCompare(1000, 9))).toBe(1);
  expect(defaultCompare(5, 5)).toBe(0);
});

test('should compare strings by locale', () => {
  expect(Math.sign(defaultCompare('a', 'b'))).toBe(-1);
  expect(Math.sign(defaultCompare('b', 'a'))).toBe(1);
});

test('should compare Dates chronologically', () => {
  expect(Math.sign(defaultCompare(new Date('2020-01-01'), new Date('2021-01-01')))).toBe(-1);
  expect(defaultCompare(new Date('2020-01-01'), new Date('2020-01-01'))).toBe(0);
});

test('should sort null/undefined last', () => {
  expect(defaultCompare(null, 5)).toBe(1); // null after 5
  expect(defaultCompare(5, null)).toBe(-1); // 5 before null
  expect(defaultCompare(undefined, undefined)).toBe(0);
  expect(defaultCompare(null, undefined)).toBe(0); // both nullish
});

test('should fall back to a String() locale compare for mixed/other types', () => {
  // number vs string: compares String(a) vs String(b) by locale.
  expect(Math.sign(defaultCompare(10, '9'))).toBe(Math.sign('10'.localeCompare('9')));
  // two objects both stringify to "[object Object]" → equal.
  expect(defaultCompare({ a: 1 }, { b: 2 })).toBe(0);
});

interface Row {
  n: number;
  s: string;
}

test('should infer the value type so a matching format/parse type-checks', () => {
  const c = column({
    id: 'n',
    title: 'N',
    value: (r: Row) => r.n, // V inferred as number
    format: (v) => v.toFixed(2), // v is number — compiles
    parse: (t) => Number(t), // returns number — compiles
  });
  expect(c.value({ n: 3.5, s: 'x' })).toBe(3.5);
});

test('should reject a format/parse that assumes the wrong value type (compile error)', () => {
  column({
    id: 'n',
    title: 'N',
    value: (r: Row) => r.n, // V inferred as number
    // @ts-expect-error - v is number, not string; toUpperCase does not exist on number
    format: (v) => v.toUpperCase(),
  });
  // V is pinned to number, so a parse returning the raw string is a compile error.
  column<Row, number>({
    id: 'n2',
    title: 'N2',
    value: (r) => r.n,
    // @ts-expect-error - parse must return number, not the string text
    parse: (t) => t,
  });
  expect(true).toBe(true);
});
