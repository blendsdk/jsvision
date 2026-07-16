/**
 * Specification tests (immutable oracles) — container selection: state, gestures, and set-membership
 * paint (RD-08 Phase 2; plan doc plans/rows-selection/03-02, 07-testing-strategy ST-8 … ST-12).
 *
 * Selection is a reactive `ReadonlySet<Key>` keyed by `rowKey`, toggled by gestures (`Space` on a
 * read-only cell, `Ctrl`+click, `Shift`+click / `Shift`+↑↓) and the public API. A plain click is
 * cursor-only. Because selection is a key set it survives a re-sort with no reconcile. A selected row
 * paints the `selected` role under the fixed precedence cursor > dirty > selected > cellStyle > zebra >
 * normal — zero `@jsvision/ui` change (the datagrid body's own `draw()` override reads the set).
 *
 * Expectations derive from the requirements, never the implementation. `loop.dispatch` takes 1-based
 * terminal coords; the header sits at screen row 0, so body display row `r` is 1-based `y = r + 2`.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { SelectionMode } from '../src/selection.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 24;
const H = 6;

interface Person {
  id: number;
  name: string;
}
const PEOPLE: Person[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bo' },
  { id: 3, name: 'Cy' },
];

// A trailing read-only column so a row's background is observable AWAY from the focused cell (the
// cursor cell, at col 0, is overpainted in `gridCursor`, which would mask the row's own role colour).
const cityCol = () => column<Person, string>({ id: 'id', title: 'Id', value: (r) => String(r.id), width: 8 });

/** A read-only first column (no `parse`/`set`) — `Space` on it toggles the row's selection. */
function readonlyColumns() {
  return [column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }), cityCol()];
}

/** An editable first column — `Space` on it begins the cell edit (selection unchanged). */
function editableColumns() {
  return [
    column<Person, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 10,
    }),
    cityCol(),
  ];
}

function buildGrid(opts: { editable?: boolean; mode?: SelectionMode } = {}) {
  const rows = signal<Person[]>(PEOPLE.map((p) => ({ ...p })));
  const grid = new EditableDataGrid<Person>({
    columns: opts.editable ? editableColumns() : readonlyColumns(),
    source: fromRows(rows, { rowKey: (r) => r.id }),
    selectionMode: opts.mode,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop, rows };
}

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: !!mods.ctrl, alt: !!mods.alt, shift: !!mods.shift };
}

/** A body-row mouse-down: display row `r` is 1-based `y = r + 2` (header at screen row 0). */
function clickRow(
  loop: ReturnType<typeof buildGrid>['loop'],
  r: number,
  mods: { ctrl?: boolean; shift?: boolean } = {},
) {
  loop.dispatch({
    type: 'mouse',
    kind: 'down',
    button: 0,
    x: 2,
    y: r + 2,
    ctrl: mods.ctrl,
    shift: mods.shift,
  } as never);
  loop.renderRoot.flush();
}

// Read the row background in the SECOND column (col 0 width 10 + divider → col 1 interior at x=12), so
// the reading is never masked by the col-0 cursor cell (the focused column stays 0 in these tests).
const ROW_BG_X = 12;

/** The background hex at a body display row `r` (screen row `r + 1`, header at row 0), away from the cursor cell. */
function rowBg(loop: ReturnType<typeof buildGrid>['loop'], r: number): string | undefined {
  return loop.renderRoot.buffer().get(ROW_BG_X, r + 1)?.bg;
}

const keysOf = (grid: EditableDataGrid<Person>): number[] => [...(grid.selectedKeys() as ReadonlySet<number>)].sort();

// ST-8 — Space on a read-only focused cell toggles the row (multi accumulates, single replaces).
test('ST-8: Space on a read-only cell toggles selection — multi adds/removes, single replaces', () => {
  const multi = buildGrid(); // default 'multi', read-only
  multi.loop.dispatch(key('space')); // cursor on row 0 (id 1) → add
  expect(keysOf(multi.grid)).toEqual([1]);
  multi.loop.dispatch(key('space')); // toggle again → remove
  expect(keysOf(multi.grid)).toEqual([]);

  const single = buildGrid({ mode: 'single' });
  single.loop.dispatch(key('space')); // row 0 (id 1)
  expect(keysOf(single.grid)).toEqual([1]);
  single.loop.dispatch(key('down')); // move cursor to row 1 (id 2)
  single.loop.dispatch(key('space')); // single REPLACES the prior selection
  expect(keysOf(single.grid)).toEqual([2]);
});

// ST-8b — Space on an EDITABLE focused cell begins the edit; the selection is unchanged (AR-19).
test('ST-8b: Space on an editable cell begins the edit and leaves the selection unchanged', () => {
  const { grid, loop } = buildGrid({ editable: true });
  loop.dispatch(key('space'));
  expect(loop.getFocused()).toBeInstanceOf(Input); // an editor opened (begin-edit, replaceWith space)
  expect(keysOf(grid)).toEqual([]); // selection untouched
});

// ST-8c — a plain (unmodified) click moves the cursor but does NOT change the selection (AR-17).
test('ST-8c: a plain click is cursor-only — it moves the cursor and leaves the selection unchanged', () => {
  const { grid, loop } = buildGrid();
  clickRow(loop, 1); // plain click on display row 1
  expect(keysOf(grid)).toEqual([]); // no selection change
  expect(rowBg(loop, 1)).toBe(defaultTheme.listFocused.bg); // …but the cursor moved to row 1 (active highlight)
});

// ST-9 — Shift+↓ from an anchor extends the contiguous range in display order (AC-2).
test('ST-9: Shift+Down extends the contiguous range from the anchor in display order', () => {
  const { grid, loop } = buildGrid();
  loop.dispatch(key('down', { shift: true })); // anchor = row 0 (id 1) → extend to row 1 (id 2)
  loop.dispatch(key('down', { shift: true })); // extend to row 2 (id 3)
  expect(keysOf(grid)).toEqual([1, 2, 3]); // three contiguous keys
});

// ST-10 — a re-sort keeps the SAME row keys selected (not the same indices) (AC-2 / AR-10).
test('ST-10: selected keys survive a re-sort (same keys, not same indices)', () => {
  const { grid } = buildGrid();
  grid.toggleRow(1);
  grid.toggleRow(3); // {1, 3}
  grid.sortBy('name', 'desc'); // Cy, Bo, Ada → the display order changes
  expect(keysOf(grid)).toEqual([1, 3]); // the same keys stay selected
});

// ST-11 — a selected row paints the `selected` role; the focused row wins over selected (AC-4 / AR-13).
test('ST-11: a selected row paints listSelected; a focused+selected row paints listFocused (focused wins)', () => {
  const { grid, loop } = buildGrid();
  grid.selectRow(2); // select display row 1 (id 2); the cursor stays on row 0
  loop.renderRoot.flush();
  expect(rowBg(loop, 1)).toBe(defaultTheme.listSelected.bg); // the non-focused selected row → selected role
  expect(rowBg(loop, 0)).toBe(defaultTheme.listFocused.bg); // the focused (unselected) row → focus role

  grid.selectRow(1); // now select the focused row (id 1, display row 0)
  loop.renderRoot.flush();
  expect(rowBg(loop, 0)).toBe(defaultTheme.listFocused.bg); // focused wins over selected
});

// ST-12 — Ctrl+click toggles a row into the selection and moves the cursor/anchor to it (RD AR-21).
test('ST-12: Ctrl+click toggles a row into the selection and moves the cursor to it', () => {
  const { grid, loop } = buildGrid();
  clickRow(loop, 1, { ctrl: true }); // Ctrl+click display row 1 (id 2)
  expect(keysOf(grid)).toEqual([2]); // toggled in
  expect(rowBg(loop, 1)).toBe(defaultTheme.listFocused.bg); // cursor moved to row 1

  clickRow(loop, 0, { ctrl: true }); // Ctrl+click display row 0 (id 1) → accumulate (multi)
  expect(keysOf(grid)).toEqual([1, 2]);
});
