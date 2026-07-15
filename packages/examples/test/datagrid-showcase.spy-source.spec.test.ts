/**
 * Specification test (immutable oracle) — the bespoke in-memory push-down source used by the Sorting
 * and Filtering push-down demos.
 *
 * Source: RD-15 AC #3 (each demo renders with a live echo) + the plan's PF-020 note. `fromRows` omits
 * the optional `setSort`/`setFilter`/`distinct` seams (client-side path); the push-down demos need a
 * source that *implements* them so the echo can show "pushed down: <model>". This spy sorts/filters its
 * backing rows in memory, records the last model it received (reactively, to drive the echo), and its
 * `length()`/`rowAt` reflect the resulting view. Expectations derive from the seam contract, not demo
 * internals. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { column } from '@jsvision/datagrid';
import type { FilterModel } from '@jsvision/datagrid';
import { createSpySource } from '../datagrid-showcase/stories/lib/spy-source.js';

interface Row {
  readonly id: number;
  readonly name: string;
  readonly qty: number;
}

const ROWS: Row[] = [
  { id: 1, name: 'Banana', qty: 30 },
  { id: 2, name: 'Apple', qty: 10 },
  { id: 3, name: 'Cherry', qty: 20 },
];

const COLUMNS = [
  column({ id: 'name', title: 'Name', value: (r: Row) => r.name }),
  column({ id: 'qty', title: 'Qty', value: (r: Row) => r.qty }),
];

// ST-11 — setSort records the keys and the in-memory view reflects the sorted order.
test('ST-11: setSort records the keys; length/rowAt reflect the sorted order', () => {
  const spy = createSpySource(ROWS, { rowKey: (r) => r.id, columns: COLUMNS });

  spy.setSort([{ columnId: 'name', dir: 'asc' }]);
  expect(spy.lastSort()).toEqual([{ columnId: 'name', dir: 'asc' }]);
  expect(spy.length()).toBe(3);
  expect(spy.rowAt(0)?.name).toBe('Apple');
  expect(spy.rowAt(2)?.name).toBe('Cherry');

  spy.setSort([{ columnId: 'qty', dir: 'desc' }]);
  expect(spy.lastSort()).toEqual([{ columnId: 'qty', dir: 'desc' }]);
  expect(spy.rowAt(0)?.qty).toBe(30);
  expect(spy.rowAt(2)?.qty).toBe(10);
});

// ST-12 — setFilter records the model and the view length reflects the filtered count.
test('ST-12: setFilter records the model; length reflects the filtered count', () => {
  const spy = createSpySource(ROWS, { rowKey: (r) => r.id, columns: COLUMNS });

  const model: FilterModel = new Map([['name', { kind: 'text', op: 'contains', value: 'e' }]]);
  spy.setFilter(model);
  expect(spy.lastFilter().size).toBe(1);
  // 'Apple' and 'Cherry' contain 'e'; 'Banana' does not.
  expect(spy.length()).toBe(2);

  spy.setFilter(new Map()); // clear
  expect(spy.length()).toBe(3);
});
