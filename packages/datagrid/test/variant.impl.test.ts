/**
 * Implementation tests — the variant module's edges and the apply wiring: resolveVariant with
 * all-unknown ids, a duplicate id, and an empty column set; the width clamp on apply; and the
 * sort/filter push-down firing when the source implements it. The pure resolveVariant is exercised
 * directly; clamp + push-down are exercised through a real grid.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import type { SortKey } from '../src/sort.js';
import type { FilterModel } from '../src/filter.js';
import { EditableDataGrid } from '../src/grid.js';
import { resolveVariant } from '../src/variant.js';
import type { GridVariant } from '../src/variant.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const W = 30;
const H = 6;

function mount<T>(grid: EditableDataGrid<T>): EditableDataGrid<T> {
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

// All ids unknown → nothing named; the resolved order is just the current columns, appended in order.
test('resolveVariant with all-unknown ids yields only the appended current columns', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'gone1', visible: true },
      { id: 'gone2', visible: false },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['a', 'b']);
  expect(resolved.order).toEqual(['a', 'b']);
  expect(resolved.visibleById.size).toBe(0); // no named-known column carried a visibility
});

// A duplicate id in the variant collapses to its first occurrence (never a corrupt, doubled order).
test('resolveVariant dedups a duplicate id, keeping the first occurrence', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'a', visible: false },
      { id: 'a', visible: true },
      { id: 'b', visible: true },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['a', 'b']);
  expect(resolved.order).toEqual(['a', 'b']); // 'a' appears once
  expect(resolved.visibleById.get('a')).toBe(false); // the first occurrence wins
});

// An empty column set names nothing → every current column is appended in its current order.
test('resolveVariant with an empty column set appends every current column in order', () => {
  const variant: GridVariant = { name: 'x', columns: [], freeze: { left: [], right: [] }, sort: [], filter: [] };
  expect(resolveVariant(variant, ['a', 'b', 'c']).order).toEqual(['a', 'b', 'c']);
});

// A variant width outside the column's [minWidth, maxWidth] is clamped on apply.
test('applyVariant clamps a variant width to the column min and max', () => {
  const columns = [
    column<{ id: number; v: number }, number>({
      id: 'v',
      title: 'V',
      value: (r) => r.v,
      width: 10,
      minWidth: 4,
      maxWidth: 40,
    }),
  ];
  const grid = mount(
    new EditableDataGrid({ columns, source: fromRows(signal([{ id: 1, v: 1 }]), { rowKey: (r) => r.id }) }),
  );
  const withWidth = (width: number): GridVariant => ({
    name: 'x',
    columns: [{ id: 'v', visible: true, width }],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  });
  grid.applyVariant(withWidth(1));
  expect(grid.columnWidth('v')).toBe(4); // clamped up to minWidth
  grid.applyVariant(withWidth(99));
  expect(grid.columnWidth('v')).toBe(40); // clamped down to maxWidth
});

interface Row {
  id: number;
  dept: string;
}

// On a push-down source, applyVariant's sort/filter reach the source's setSort/setFilter (the same
// path the interactive sort/filter use), so a server-side source re-queries on restore.
test('applyVariant fires the setSort/setFilter push-down when the source implements it', () => {
  const setSort = vi.fn<(keys: SortKey[]) => void>();
  const setFilter = vi.fn<(model: FilterModel) => void>();
  const store: Row[] = [
    { id: 1, dept: 'A' },
    { id: 2, dept: 'B' },
  ];
  const source: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => store.length,
    rowAt: (i) => store[i],
    setSort,
    setFilter,
  };
  const columns = [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5 }),
    column<Row, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  ];
  const grid = mount(new EditableDataGrid({ columns, source }));

  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'id', visible: true },
      { id: 'dept', visible: true },
    ],
    freeze: { left: [], right: [] },
    sort: [{ columnId: 'id', dir: 'desc' }],
    filter: [{ columnId: 'dept', filter: { kind: 'text', op: 'contains', value: 'A' } }],
  };
  grid.applyVariant(variant);

  expect(setSort.mock.calls.at(-1)?.[0]).toEqual([{ columnId: 'id', dir: 'desc' }]); // pushed the restored sort
  const lastFilter = setFilter.mock.calls.at(-1)?.[0];
  expect(lastFilter?.get('dept')).toEqual({ kind: 'text', op: 'contains', value: 'A' }); // pushed the restored filter
});

// Every named column carrying no width lands in clearWidths (with none carrying a width).
test('resolveVariant lists every named-without-width id in clearWidths', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'a', visible: true },
      { id: 'b', visible: true },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['a', 'b']);
  expect(resolved.clearWidths).toEqual(['a', 'b']); // all named, none carried a width
  expect(resolved.widthById.size).toBe(0); // nothing to set
});

// When every named column carries a width, clearWidths is empty and widthById carries them all.
test('resolveVariant reports an empty clearWidths when every named column carries a width', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'a', visible: true, width: 7 },
      { id: 'b', visible: true, width: 9 },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['a', 'b']);
  expect(resolved.clearWidths).toEqual([]); // nothing to clear
  expect([...resolved.widthById.entries()]).toEqual([
    ['a', 7],
    ['b', 9],
  ]);
});

// A column the variant does not name (appended, unnamed) keeps its width override; only named-without-
// width columns are cleared — the delete-then-set never touches an unnamed column.
test('applyVariant leaves an unnamed column width override untouched (only named-without-width clear)', () => {
  interface Cell {
    id: number;
    a: number;
    b: number;
  }
  const columns = [
    column<Cell, number>({ id: 'a', title: 'A', value: (r) => r.a, width: 6 }),
    column<Cell, number>({ id: 'b', title: 'B', value: (r) => r.b, width: 6 }),
  ];
  const grid = mount(
    new EditableDataGrid({ columns, source: fromRows(signal([{ id: 1, a: 1, b: 2 }]), { rowKey: (r) => r.id }) }),
  );
  grid.setColumnWidth('a', 15); // 'a' is named without a width by the variant → the override must clear
  grid.setColumnWidth('b', 20); // 'b' is unnamed (the variant omits it) → the override must persist
  const variant: GridVariant = {
    name: 'x',
    columns: [{ id: 'a', visible: true }], // names only 'a', without a width
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  grid.applyVariant(variant);
  expect(grid.columnWidth('a')).toBe(6); // named-without-width → override cleared → back to declared 6
  expect(grid.columnWidth('b')).toBe(20); // unnamed → override preserved
});
