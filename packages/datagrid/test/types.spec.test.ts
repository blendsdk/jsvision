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
import { column } from '../src/column.js';
import { EditableDataGrid } from '../src/grid.js';

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

test('should require a rowKey-bearing source when constructing the grid', () => {
  // The assertions below are purely at the type level — the closure is never invoked.
  const typeOnly = (): void => {
    const columns = [column({ id: 'id', title: 'Id', value: (r: Row) => r.id })];

    // @ts-expect-error - `source` is required (and it carries the mandatory rowKey).
    new EditableDataGrid<Row>({ columns });

    // A source that omits rowKey fails to construct, so the grid does too.
    // @ts-expect-error - the source's rowKey is required.
    new EditableDataGrid<Row>({ columns, source: fromRows(signal<Row[]>([]), {}) });
  };
  expect(typeOnly).toBeTypeOf('function');
});
