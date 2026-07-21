/**
 * Implementation tests (edges/internals) — row CRUD through the mutation seam (RD-08 Phase 4).
 *
 * The spec oracles (`row-crud.spec.test.ts`, ST-16 … ST-18) pin the requirement behaviour; these cover
 * the internals: an insert under an active CLIENT sort lands at its value-determined display position
 * (not the raw source index), a delete of a non-selected key leaves the selection intact, a read-only
 * source (no `insert`/`remove` seam) makes every mutator a safe no-op, and `duplicateRow` on a
 * non-structured-cloneable row warns + no-ops with no partial insert.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 20;
const H = 6;

interface Person {
  id: number;
  name: string;
}

function buildGrid(rows: Signal<Person[]>, extra: Partial<EditableDataGridOptions<Person>> = {}) {
  const grid = new EditableDataGrid<Person>({
    columns: [column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop };
}

function text(loop: ReturnType<typeof buildGrid>['loop'], x: number, y: number, len: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let i = 0; i < len; i += 1) s += buf.get(x + i, y)?.char ?? ' ';
  return s;
}

const keysOf = (grid: EditableDataGrid<Person>): number[] =>
  [...(grid.selectedKeys() as ReadonlySet<number>)].sort((a, b) => a - b);

test('insertRow under an active client sort lands at its value-determined display position', () => {
  // Deliberately unsorted source order (Ada, Cy, Bo) so the sort re-orders visibly.
  const rows = signal<Person[]>([
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Cy' },
    { id: 3, name: 'Bo' },
  ]);
  const { grid, loop } = buildGrid(rows);
  grid.sortBy('name', 'asc'); // display: Ada, Bo, Cy
  loop.renderRoot.flush();

  grid.insertRow({ id: 9, name: 'Al' }, 0); // spliced at source index 0, but the client sort re-places it
  loop.renderRoot.flush();
  // Sorted asc: Ada, Al, Bo, Cy — "Al" sits at display index 1 regardless of its source index.
  expect(text(loop, 0, 1, 3)).toBe('Ada');
  expect(text(loop, 0, 2, 2)).toBe('Al');
  expect(text(loop, 0, 3, 2)).toBe('Bo');
  expect(rows().length).toBe(4);
});

test('deleteRows of a non-selected key leaves the selection intact', () => {
  const rows = signal<Person[]>([
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bo' },
    { id: 3, name: 'Cy' },
  ]);
  const { grid } = buildGrid(rows);
  grid.selectRow(2); // {2}
  grid.deleteRows([3]); // delete a DIFFERENT key
  expect(rows().some((r) => r.id === 3)).toBe(false); // id 3 removed
  expect(keysOf(grid)).toEqual([2]); // the selection is untouched (2 was never in the deleted set)
});

test('a read-only source (no insert/remove seam) makes every mutator a no-op', () => {
  const store: Person[] = [{ id: 1, name: 'Ada' }];
  const source: GridDataSource<Person> = {
    rowKey: (r) => r.id,
    length: () => store.length,
    rowAt: (i) => store[i],
    // no `insert` / `remove`
  };
  const grid = new EditableDataGrid<Person>({
    columns: [column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 })],
    source,
    assignKey: (clone) => ({ ...clone, id: 99 }),
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);

  grid.insertRow({ id: 2, name: 'Bo' });
  grid.deleteRows([1]);
  grid.duplicateRow(1);
  expect(store).toEqual([{ id: 1, name: 'Ada' }]); // the backing store is untouched by any mutator
});

test('duplicateRow on a non-structured-cloneable row devWarns and does not insert (no partial state)', () => {
  interface Fancy {
    id: number;
    fn: () => void; // a function member — structuredClone throws on it
  }
  const rows = signal<Fancy[]>([{ id: 1, fn: () => undefined }]);
  const grid = new EditableDataGrid<Fancy>({
    columns: [column<Fancy, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 4 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    assignKey: (clone) => ({ ...clone, id: 2 }),
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  grid.duplicateRow(1);
  expect(rows().length).toBe(1); // nothing inserted — the clone threw and was caught
  expect(warn).toHaveBeenCalledTimes(1); // warned rather than propagating the DataCloneError
  warn.mockRestore();
});
