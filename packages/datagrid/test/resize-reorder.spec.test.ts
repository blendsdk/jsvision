/**
 * Specification tests (immutable oracles) — column resize + auto-fit gestures on the grid header
 * (plan doc plans/columns-layout/03-03, 07-testing-strategy ST-20 … ST-21). The reorder section
 * (ST-22) is added with Phase 5.
 *
 * Gestures are driven through the real event loop at the header row (y = 0): a mouse-down on a
 * column's resize grip (its right-edge divider cell) captures the pointer; captured drags resize the
 * column live and clamp to its `minWidth`; a double-click on a grip auto-fits it. Expectations derive
 * from the requirements — the public `columnWidth(id)` readout — never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Emp {
  id: number;
  name: string;
  city: string;
}
const EMPS: Emp[] = [
  { id: 1, name: 'Alexander', city: 'NYC' }, // 'Alexander' is 9 wide — the auto-fit target
  { id: 2, name: 'Bo', city: 'LA' },
  { id: 3, name: 'Cy', city: 'SF' },
];
// id: fixed 5, floored at min 3. name: fixed 5 (narrower than its widest value, so auto-fit grows it).
const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5, minWidth: 3 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 5 }),
  column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 8 }),
];

const W = 30;
const H = 6;

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
  // `x0` is a 0-based content-x; `loop.dispatch` takes 1-based terminal coords and the header sits at
  // screen row 0, so we send `x0 + 1` and `y = 1` (matching the existing header-click tests).
  const mouse = (kind: 'down' | 'drag' | 'up', x0: number) =>
    loop.dispatch({ type: 'mouse', kind, button: 0, x: x0 + 1, y: 1 } as never);
  const headerText = (): string => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, 0)?.char ?? ' ';
    return s;
  };
  // The 0-based content-x of a column title's first character (robust across the frozen layout).
  const titleX = (label: string): number => headerText().indexOf(label);
  return { grid, loop, mouse, headerText, titleX };
}

// The right-edge grip of a fixed-width column, at content-x `Σ widths + (c) dividers` for column c. With
// id:5 the id grip is at 0-based x=5; the grid does not scroll (content fits), so local x = content x.
const ID_GRIP = 5;
// id:5 + divider + name:5 → the name grip is at 0-based x=11.
const NAME_GRIP = 11;

// ST-20 — a captured drag on a column's grip resizes it live; the width clamps to the column's min.
test('ST-20: dragging a grip resizes the column live and clamps at its minimum', () => {
  const grow = buildGrid();
  expect(grow.grid.columnWidth('id')).toBe(5);
  grow.mouse('down', ID_GRIP); // grab the id grip
  grow.mouse('drag', ID_GRIP + 5); // drag 5 cells right
  grow.mouse('up', ID_GRIP + 5);
  expect(grow.grid.columnWidth('id')).toBe(10); // grew live by ~5

  const clamp = buildGrid();
  clamp.mouse('down', ID_GRIP); // grab the id grip (start width 5)
  clamp.mouse('drag', ID_GRIP - 4); // drag 4 cells left → 1, below the min of 3
  clamp.mouse('up', ID_GRIP - 4);
  expect(clamp.grid.columnWidth('id')).toBe(3); // stopped at the minimum, not 1
});

// ST-21 — a double-click on a grip auto-fits the column to its widest visible cell.
test('ST-21: double-clicking a grip auto-fits the column to its widest cell', () => {
  const { grid, mouse } = buildGrid();
  expect(grid.columnWidth('name')).toBe(5); // narrower than 'Alexander' (9 wide)
  mouse('down', NAME_GRIP); // clickCount 1
  mouse('up', NAME_GRIP);
  mouse('down', NAME_GRIP); // clickCount 2 → double-click → auto-fit
  mouse('up', NAME_GRIP);
  expect(grid.columnWidth('name')).toBe(9); // fitted to 'Alexander'
});

// ---------------------------------------------------------------------------
// Reorder gesture (Phase 5 — ST-22, ST-23)
// ---------------------------------------------------------------------------

// ST-22 — a press-and-drag on a title reorders within the panel; a plain click still sorts.
test('ST-22: a title drag reorders within the panel; a plain click still sorts', () => {
  const drag = buildGrid();
  expect(drag.grid.columnOrder()).toEqual(['id', 'name', 'city']);
  const nameX = drag.titleX('Name');
  const cityX = drag.titleX('City');
  drag.mouse('down', nameX); // press the 'name' title (this also sorts on down…)
  drag.mouse('drag', cityX); // …but a drag past threshold starts the reorder (reverting that sort)
  drag.mouse('up', cityX);
  expect(drag.grid.columnOrder()).toEqual(['id', 'city', 'name']); // name moved to the city slot
  expect(drag.grid.sort()).toEqual([]); // the reorder reverted the on-down sort — a drag never sorts

  const click = buildGrid();
  const idX = click.titleX('ID');
  click.mouse('down', idX); // a plain click (no drag)…
  click.mouse('up', idX);
  expect(click.grid.sort()).toEqual([{ columnId: 'id', dir: 'asc' }]); // …still sorts
  expect(click.grid.columnOrder()).toEqual(['id', 'name', 'city']); // and never reorders
});

// ST-23 — a reorder never crosses a freeze boundary: a frozen column is never displaced by a drag in
// another panel, and the drag stays within its own panel.
test('ST-23: a reorder is constrained to its panel — a cross-boundary drop is rejected', () => {
  const { grid, mouse, titleX } = buildGrid({ freeze: 1 }); // id frozen (left panel); name+city center
  expect(grid.columnOrder()).toEqual(['id', 'name', 'city']);
  expect(grid.frozen().left).toEqual(['id']);
  const cityX = titleX('City'); // a center-panel column
  mouse('down', cityX);
  mouse('drag', 0); // drag hard left, past the freeze boundary into the frozen panel's area
  mouse('up', 0);
  expect(grid.frozen().left).toEqual(['id']); // the frozen column was not displaced
  expect(grid.columnOrder()[0]).toBe('id'); // id stays pinned first — the drop never crossed the boundary
});
