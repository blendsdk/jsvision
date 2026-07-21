/**
 * Specification tests (immutable oracle) — the container's filter wiring on `EditableDataGrid`
 * (`grid.ts`): the imperative `setFilter`/`clearFilter` API, the reactive `filterModel`/
 * `filteredCount`/`totalCount` readouts, `setFilter` push-down, and the client filter→sort
 * composition.
 *
 * The grid is mounted in an event loop and the painted frame is read (mouse/data routing is hit-test
 * based), mirroring the sort-header container tests. Expectations derive from the requirements/spec
 * docs, never from the implementation. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import type { FilterModel } from '../src/filter.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Sale {
  region: string;
  qty: number;
}
const SALES: Sale[] = [
  { region: 'east', qty: 1000 },
  { region: 'west', qty: 9 },
  { region: 'north', qty: 50 },
];

const W = 24;
const H = 6;
const COLUMNS = [
  column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
  column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 8 }),
];

/** Mount an `EditableDataGrid` over `source` in an event loop; return the grid, loop, and a frame reader. */
function buildGrid(source: GridDataSource<Sale> = fromRows(signal(SALES.slice()), { rowKey: (r) => r.region })) {
  const grid = new EditableDataGrid<Sale>({ columns: COLUMNS, source });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const frame = (): string[] => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    const out: string[] = [];
    for (let y = 0; y < H; y += 1) {
      let s = '';
      for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
      out.push(s);
    }
    return out;
  };
  return { grid, loop, frame };
}

/** The body row (screen y in 1..H-1) whose text contains `needle`, or -1. */
function bodyRowOf(rows: string[], needle: string): number {
  for (let y = 1; y < H; y += 1) if (rows[y].includes(needle)) return y;
  return -1;
}

test('ST-12: setFilter registers the filter, filters the body, and drives filteredCount/totalCount', () => {
  const { grid, frame } = buildGrid();
  grid.setFilter('region', { kind: 'text', op: 'contains', value: 'nor' }); // keeps only north
  expect(grid.filterModel().has('region')).toBe(true);
  expect(grid.filteredCount()).toBe(1);
  expect(grid.totalCount()).toBe(3);
  const rows = frame();
  expect(bodyRowOf(rows, 'north')).toBeGreaterThan(0); // north painted
  expect(bodyRowOf(rows, 'east')).toBe(-1); // east filtered out
  expect(bodyRowOf(rows, 'west')).toBe(-1); // west filtered out
});

test('ST-13: clearFilter(id) removes one column filter; clearFilter() empties the model', () => {
  const { grid } = buildGrid();
  grid.setFilter('region', { kind: 'text', op: 'contains', value: 'nor' });
  grid.setFilter('qty', { kind: 'number', op: 'gt', a: 0 });
  expect(grid.filterModel().size).toBe(2);
  grid.clearFilter('region');
  expect(grid.filterModel().has('region')).toBe(false);
  expect(grid.filterModel().size).toBe(1);
  grid.clearFilter();
  expect(grid.filterModel().size).toBe(0);
});

test('ST-14: a setFilter source gets the structured model pushed down; the grid does not filter client-side', () => {
  const setFilter = vi.fn<(model: FilterModel) => void>();
  const pushSource: GridDataSource<Sale> = {
    rowKey: (r) => r.region,
    length: () => SALES.length,
    rowAt: (i) => SALES[i],
    setFilter,
  };
  const { grid, frame } = buildGrid(pushSource);
  grid.setFilter('region', { kind: 'text', op: 'contains', value: 'nor' });
  expect(setFilter).toHaveBeenCalled();
  const model = setFilter.mock.calls.at(-1)?.[0];
  expect(model?.get('region')).toEqual({ kind: 'text', op: 'contains', value: 'nor' });
  // The push-down source owns filtering (its rowAt is unchanged here), so the grid does NOT drop rows.
  const rows = frame();
  expect(bodyRowOf(rows, 'east')).toBeGreaterThan(0); // still present — no client filtering
  expect(grid.filteredCount()).toBe(SALES.length); // display().length == source.length() (eager push-down)
});

test('ST-16: a client grid filters then sorts (survivors sorted, filtered-out rows gone)', () => {
  const { grid, frame } = buildGrid();
  grid.setFilter('qty', { kind: 'number', op: 'gt', a: 10 }); // keeps east(1000), north(50); drops west(9)
  grid.sortBy('qty'); // asc: north(50) before east(1000)
  expect(grid.filteredCount()).toBe(2);
  const rows = frame();
  expect(bodyRowOf(rows, 'west')).toBe(-1); // filtered out
  expect(bodyRowOf(rows, '50')).toBeLessThan(bodyRowOf(rows, '1000')); // sorted ascending among survivors
});
