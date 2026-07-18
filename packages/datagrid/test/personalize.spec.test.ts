/**
 * Specification tests (immutable oracle) — the grid read API the personalization dialog is built on:
 * `columns()` (the full reactive column-metadata list), `defaultColumnLayout()` (the construction-time
 * baseline for Reset), and `clearColumnWidth()` (return a column to auto width). The dialog and its
 * `personalizeGrid` helper add further cases to this file in later phases. Expectations derive from
 * the requirements + the 03-XX specs, never from the implementation.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal, effect, createRoot } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Emp {
  id: number;
  name: string;
  dept: string;
  total: number;
  note: string;
  active: boolean;
}

const EMPS: Emp[] = [
  { id: 1, name: 'Ann', dept: 'Eng', total: 10, note: 'a', active: true },
  { id: 2, name: 'Bob', dept: 'Ops', total: 30, note: 'b', active: false },
  { id: 3, name: 'Cy', dept: 'Eng', total: 20, note: 'c', active: true },
];

const CONSTRUCTION_ORDER = ['id', 'name', 'dept', 'total', 'note', 'active'];

const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  column<Emp, number>({ id: 'total', title: 'Total', value: (r) => r.total, width: 6, minWidth: 4, maxWidth: 40 }),
  column<Emp, string>({ id: 'note', title: 'Note', value: (r) => r.note, width: 6 }),
  column<Emp, boolean>({ id: 'active', title: 'Active', value: (r) => r.active, width: 6 }),
];

/** Mount a fresh grid; `w` wide enough (default 50) that nothing over-pins, narrow to force over-pin. */
function buildGrid(w = 50, h = 8): EditableDataGrid<Emp> {
  const grid = new EditableDataGrid<Emp>({
    columns: COLS(),
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

// columns() returns one entry per column in the full construction/display order (hidden included),
// each carrying resolved id/title/visible/frozen/width.
test('columns() returns every column (hidden included) in full order with resolved metadata', () => {
  const grid = buildGrid();
  grid.setColumnVisible('dept', false); // hide one
  grid.setFrozen(['id'], []); // freeze one left
  grid.setColumnWidth('total', 22); // override one width (within [4,40])
  const cols = grid.columns();
  expect(cols.map((c) => c.id)).toEqual(CONSTRUCTION_ORDER); // full order, hidden interleaved in place
  const byId = new Map(cols.map((c) => [c.id, c]));
  expect(byId.get('dept')!.visible).toBe(false); // hidden
  expect(byId.get('name')!.visible).toBe(true);
  expect(byId.get('id')!.frozen).toBe('left'); // pinned left
  expect(byId.get('name')!.frozen).toBe('none');
  expect(byId.get('total')!.width).toBe(22); // overridden width, resolved
  expect(byId.get('id')!.title).toBe('ID'); // header title carried
});

// Reading columns() inside an effect re-runs on each layout change (reactive). Asserted per-change
// (the effect grew after every mutation), not by an exact total — the reactive graph may fan out
// more than one re-run per change, but the contract is only that each change re-runs it.
test('reading columns() inside an effect re-runs on each layout change', () => {
  const grid = buildGrid();
  const runs: number[] = [];
  const dispose = createRoot((d) => {
    effect(() => {
      runs.push(grid.columns().length); // reading establishes the reactive dependency
    });
    return d;
  });
  const afterMount = runs.length; // the effect ran on creation
  grid.setColumnVisible('note', false); // hide
  const afterHide = runs.length;
  grid.setColumnVisible('note', true); // show
  const afterShow = runs.length;
  grid.setFrozen(['id'], []); // freeze
  const afterFreeze = runs.length;
  grid.setColumnWidth('total', 15); // resize
  const afterResize = runs.length;
  dispose();
  expect(afterHide).toBeGreaterThan(afterMount); // hide re-ran the effect
  expect(afterShow).toBeGreaterThan(afterHide); // show re-ran the effect
  expect(afterFreeze).toBeGreaterThan(afterShow); // freeze re-ran the effect
  expect(afterResize).toBeGreaterThan(afterFreeze); // resize re-ran the effect
});

// columns() reports the RESOLVED freeze partition — an over-pinned column reads 'none', matching
// grid.frozen() membership exactly.
test("columns() reports the resolved freeze partition — an over-pinned column reads 'none'", () => {
  const grid = buildGrid(12); // narrow viewport
  grid.setFrozen(['id', 'name', 'dept'], []); // request more frozen width than fits
  const resolved = grid.frozen();
  const cols = grid.columns();
  for (const c of cols) {
    const expected = resolved.left.includes(c.id) ? 'left' : resolved.right.includes(c.id) ? 'right' : 'none';
    expect(c.frozen).toBe(expected); // columns() matches the resolved partition cell-for-cell
  }
  expect(resolved.left.length).toBeLessThan(3); // the over-pin guard peeled at least one back
  const peeled = ['id', 'name', 'dept'].find((id) => !resolved.left.includes(id))!;
  expect(cols.find((c) => c.id === peeled)!.frozen).toBe('none'); // the peeled column reads 'none'
});

// defaultColumnLayout() is the construction baseline regardless of the current mutations: every column
// visible, construction order, no freeze, declared/auto widths (no overrides).
test('defaultColumnLayout() is the construction baseline regardless of current mutations', () => {
  const grid = buildGrid();
  grid.setColumnVisible('dept', false);
  grid.setFrozen(['id'], []);
  grid.setColumnWidth('total', 30);
  grid.setColumnOrder([...grid.columnOrder()].reverse()); // reorder the visible columns
  const base = grid.defaultColumnLayout();
  expect(base.map((c) => c.id)).toEqual(CONSTRUCTION_ORDER); // construction order
  expect(base.every((c) => c.visible)).toBe(true); // all visible
  expect(base.every((c) => c.frozen === 'none')).toBe(true); // no freeze
  expect(base.find((c) => c.id === 'total')!.width).toBe(6); // declared width — NOT the 30 override
});

// clearColumnWidth removes a column's override (returns it to auto/declared); an unknown id is a no-op.
test('clearColumnWidth removes an override (unknown id is a no-op)', () => {
  const grid = buildGrid();
  grid.setColumnWidth('name', 20);
  expect(grid.columnWidth('name')).toBe(20);
  grid.clearColumnWidth('name');
  expect(grid.columnWidth('name')).toBe(8); // back to the declared width
  expect(() => grid.clearColumnWidth('nope')).not.toThrow(); // unknown id → silent no-op
});
