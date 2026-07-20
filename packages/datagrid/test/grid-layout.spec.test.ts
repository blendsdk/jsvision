/**
 * Specification tests (immutable oracle) — the container's column-layout API on `EditableDataGrid`
 * (`grid.ts`; plan doc plans/columns-layout/03-04, 07-testing-strategy ST-8 … ST-13).
 *
 * These lock the reactive column-layout STATE + API — `columnOrder`/`setColumnOrder`,
 * `columnWidth`/`setColumnWidth`, `setColumnVisible`, `frozen`, `autoFitColumn` — with unknown-id
 * guards and per-column min/max clamping. The panel RENDERING that consumes this state lands in a
 * later phase; here the oracle is the API's returned values. Expectations derive from the
 * requirements/spec docs. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal, measureAutoWidths, stringWidth } from '@jsvision/ui';
import { column, toEngineColumn } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Emp {
  id: number;
  name: string;
  dept: string;
}
const EMPS: Emp[] = [
  { id: 1, name: 'Ada', dept: 'Eng' },
  { id: 2, name: 'Bo', dept: 'Ops' },
  { id: 3, name: 'Cy', dept: 'Sales' },
];
const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6, minWidth: 4, maxWidth: 20 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
];

const W = 30;
const H = 6;

/** Mount a grid with the given layout options; return it (mounted so reactive reads settle). */
function buildGrid(extra: Partial<EditableDataGridOptions<Emp>> = {}) {
  const grid = new EditableDataGrid<Emp>({
    columns: COLS(),
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

// ST-8 — setColumnWidth clamps to the column's min/max; columnWidth reflects it; unknown id is a no-op.
test('ST-8: setColumnWidth clamps to min/max and columnWidth reflects it; unknown id is a no-op', () => {
  const grid = buildGrid();
  grid.setColumnWidth('id', 99); // maxWidth 20
  expect(grid.columnWidth('id')).toBe(20);
  grid.setColumnWidth('id', 1); // minWidth 4
  expect(grid.columnWidth('id')).toBe(4);
  grid.setColumnWidth('zzz', 12); // unknown → no-op
  expect(grid.columnWidth('id')).toBe(4); // unchanged
});

// ST-9 — setColumnOrder accepts a permutation of the visible ids; a non-permutation is ignored.
test('ST-9: setColumnOrder accepts a visible permutation; a non-permutation is ignored', () => {
  const grid = buildGrid();
  grid.setColumnOrder(['dept', 'id', 'name']);
  expect(grid.columnOrder()).toEqual(['dept', 'id', 'name']);
  grid.setColumnOrder(['dept', 'zzz', 'name']); // unknown id → ignored
  expect(grid.columnOrder()).toEqual(['dept', 'id', 'name']);
  grid.setColumnOrder(['dept', 'id']); // wrong length → ignored
  expect(grid.columnOrder()).toEqual(['dept', 'id', 'name']);
});

// ST-10 — setColumnVisible removes/restores a column from the visible order; sort state stays addressable.
test('ST-10: setColumnVisible omits the column from columnOrder while sort stays addressable', () => {
  const grid = buildGrid();
  grid.sortBy('dept');
  grid.setColumnVisible('dept', false);
  expect(grid.columnOrder()).toEqual(['id', 'name']); // dept omitted from the visible order
  expect(grid.sort()[0]?.columnId).toBe('dept'); // sort on the hidden column still active
  grid.setColumnVisible('dept', true);
  expect(grid.columnOrder()).toEqual(['id', 'name', 'dept']); // restored to its anchor slot
});

// ST-11 — frozen() reports the resolved partition from the freeze spec.
test('ST-11: frozen() reports the resolved left/right partition', () => {
  const grid = buildGrid({ freeze: 2 });
  expect(grid.frozen()).toEqual({ left: ['id', 'name'], right: [] });
});

// ST-12 — autoFitColumn sizes to the widest visible cell (title or data), bounded by maxWidth.
test('ST-12: autoFitColumn sizes a column to its widest visible cell, bounded by max', () => {
  const grid = buildGrid();
  grid.autoFitColumn('id'); // title 'ID'=2, data '1'/'2'/'3'=1 → widest 2, floored to minWidth 4
  expect(grid.columnWidth('id')).toBe(4);
  grid.autoFitColumn('dept'); // title 'Dept'=4, data 'Eng'/'Ops'/'Sales'=5 → 5
  expect(grid.columnWidth('dept')).toBe(5);
});

// ST-13 — per-column minWidth/maxWidth thread through toEngineColumn into the engine Column.
test('ST-13: per-column minWidth/maxWidth reach the engine Column and measureAutoWidths honors them', () => {
  const col = column<Emp, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    width: 'auto',
    minWidth: 8,
  });
  const engine = toEngineColumn(col);
  expect(engine.minWidth).toBe(8);
  // an 'auto' column whose widest cell is < 8 floors to the minWidth:
  const widths = measureAutoWidths([engine], EMPS, stringWidth);
  expect(widths[0]).toBeGreaterThanOrEqual(8);
});
