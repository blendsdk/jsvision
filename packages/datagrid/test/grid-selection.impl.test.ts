/**
 * Implementation tests (edges/internals) — container selection wiring (RD-08 Phase 2).
 *
 * The spec oracles (`grid-selection.spec.test.ts`, ST-8 … ST-12) pin the requirement behaviour; these
 * cover the internals: a `Shift` range with no prior anchor defaulting to the focused row, single-mode
 * `Ctrl`/`Shift` collapsing to one key, the highlight spanning frozen panels, the dirty `•` compositing
 * onto a selected row's background (the `paintDirtyMarkers` second site, AR-18), a plain click preserving
 * an existing selection (the `select()` override, AR-17), and the AR-6 helper extraction.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column, toEngineColumn } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { createDirtyRegistry, cellKey } from '../src/editing.js';
import type { Key, SelectionMode } from '../src/selection.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 26;
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

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: !!mods.ctrl, alt: !!mods.alt, shift: !!mods.shift };
}

function buildGrid(mode?: SelectionMode) {
  const grid = new EditableDataGrid<Person>({
    columns: [
      column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
      column<Person, string>({ id: 'id', title: 'Id', value: (r) => String(r.id), width: 8 }),
    ],
    source: fromRows(signal(PEOPLE.map((p) => ({ ...p }))), { rowKey: (r) => r.id }),
    selectionMode: mode,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  const clickRow = (r: number, mods: { ctrl?: boolean; shift?: boolean } = {}) => {
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
  };
  return { grid, loop, clickRow };
}

const keysOf = (grid: EditableDataGrid<Person>): number[] => [...(grid.selectedKeys() as ReadonlySet<number>)].sort();

test('a Shift range with no prior anchor extends from the focused row', () => {
  const { grid, loop } = buildGrid();
  loop.dispatch(key('down')); // move the cursor to row 1 (id 2); no selection/anchor yet
  loop.dispatch(key('down', { shift: true })); // extend to row 2 (id 3) from the focused row 1
  expect(keysOf(grid)).toEqual([2, 3]); // the pre-move focused row is the default anchor
});

test('single mode: Ctrl+click then Shift+click each collapse to one key', () => {
  const { grid, clickRow } = buildGrid('single');
  clickRow(0, { ctrl: true }); // Ctrl+click id 1 → {1}
  expect(keysOf(grid)).toEqual([1]);
  clickRow(2, { shift: true }); // Shift+click id 3 → single can't hold a range → {3}
  expect(keysOf(grid)).toEqual([3]);
});

test('a plain click preserves an existing selection (cursor-only, AR-17)', () => {
  const { grid, clickRow } = buildGrid();
  grid.selectRow(2); // {2}
  clickRow(0); // a plain click on another row moves the cursor only
  expect(keysOf(grid)).toEqual([2]); // the prior selection is untouched
});

test('the selected-row highlight spans frozen panels', () => {
  const grid = new EditableDataGrid<Person>({
    columns: [
      column<Person, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 4 }),
      column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    ],
    source: fromRows(signal(PEOPLE.map((p) => ({ ...p }))), { rowKey: (r) => r.id }),
    freeze: 1, // id is a frozen left panel; name is the center panel
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows); // cursor on row 0
  grid.selectRow(2); // select row 1 (id 2, "Bo") — non-focused
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  const y = 2; // display row 1 → screen row 2 (header at row 0)
  let line = '';
  for (let x = 0; x < W; x += 1) line += buf.get(x, y)?.char ?? ' ';
  const idX = line.indexOf('2'); // the frozen id cell of the selected row
  const nameX = line.indexOf('Bo'); // the center-panel name cell
  expect(idX).toBeGreaterThanOrEqual(0);
  expect(nameX).toBeGreaterThan(idX);
  expect(buf.get(idX, y)?.bg).toBe(defaultTheme.gridSelectedRow.bg); // frozen panel highlighted
  expect(buf.get(nameX, y)?.bg).toBe(defaultTheme.gridSelectedRow.bg); // center panel highlighted too
});

test('a dirty marker on a selected, non-focused row composites onto the listSelected background (AR-18)', () => {
  const rows: Person[] = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bo' },
  ];
  const typedColumns = [
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
  ];
  const engineCols = typedColumns.map(toEngineColumn);
  const registry = createDirtyRegistry();
  const body = new EditableGridRows<Person>({
    display: () => rows,
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    focused: signal(1), // the cursor is on row 1 → row 0 is non-focused
    selected: signal(-1),
    selectedKeys: signal<ReadonlySet<Key>>(new Set([1])), // row 0 (id 1) is selected
    zebra: false,
    focusedCol: signal(0),
    typedColumns,
    overlay: new Group(),
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
    dirty: registry,
  });
  body.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 14, height: 5 } };
  const root = new Group();
  root.add(body);
  const loop = createEventLoop({ width: 14, height: 5 }, { caps });
  loop.mount(root);
  loop.focusView(body);
  registry.add(cellKey(1, 'name')); // row 0's cell is pending
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  const MARKER_X = 9; // right edge of the width-10 column
  expect(buf.get(MARKER_X, 0)?.char).toBe('•');
  expect(buf.get(MARKER_X, 0)?.bg).toBe(defaultTheme.gridSelectedRow.bg); // composited onto the selected row's bg
});

test('AR-6: the selection controller is extracted to grid-selection.ts and grid.ts delegates to it', () => {
  const gridSel = readFileSync(fileURLToPath(new URL('../src/grid-selection.ts', import.meta.url)), 'utf8');
  const grid = readFileSync(fileURLToPath(new URL('../src/grid.ts', import.meta.url)), 'utf8');
  expect(gridSel).toContain('export class GridSelection'); // the selection state/logic lives here
  expect(grid).toContain('import { GridSelection }'); // grid.ts wires it, does not inline the state
  // grid.ts entered RD-08 already ~1029 lines; the selection controller (grid-selection.ts) and the
  // row-mutation logic (row-mutations.ts) live outside it, so grid.ts stays a thin set of public
  // delegators + the new options. This ceiling is a runaway-growth guard, not the 700-line target. It
  // was re-based 1200 -> 1250 when the footer surface (its option + three readout accessors + the
  // controller wiring) landed — heavy logic stayed in the new footer modules; see grid-footer.impl.test.
  const lineCount = grid.split('\n').length;
  expect(lineCount).toBeLessThan(1250);
});
