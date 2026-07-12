/**
 * Specification test (immutable oracle) — row identity is mandatory. Constructing a data source (and,
 * later, a grid) without a `rowKey` is a COMPILE error, not a runtime check. Enforced by the package's
 * test typecheck: the `@ts-expect-error` lines must fail to compile, and removing them would fail
 * `tsc`.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { signal } from '@jsvision/ui';
import { fromRows } from '../src/data-source.js';

interface Row {
  id: number;
}

test('should require rowKey when constructing an in-memory source', () => {
  const rows = signal<Row[]>([{ id: 1 }]);

  // A source WITH rowKey compiles and works.
  const ok = fromRows(rows, { rowKey: (r) => r.id });
  expect(ok.length()).toBe(1);

  // @ts-expect-error - rowKey is required; an empty options object does not satisfy the contract.
  fromRows(rows, {});
});
