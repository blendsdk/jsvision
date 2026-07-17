/**
 * Specification tests (immutable oracles) — Tab cell-traversal (`navigation.ts` + the commit-advance
 * seam). The pure `nextCellIndex`/`prevCellIndex` wrap at row ends and report `'exit'` at the grid edge.
 * `grid.nextCell()` commits an open edit first (a vetoed commit stays put), then advances by one cell.
 * `gridKeymap` binds Tab/Shift-Tab to grid-navigation commands, and `installGridNavigation` registers
 * the command handlers: the focused grid advances, exits to the next widget at its edge, and — because
 * the command path has no event envelope — re-focuses the grid body after a Tab-commit so the grid does
 * not go dead.
 *
 * Expectations derive from the requirements + the AR decisions, never the implementation. Commit is
 * await-close (async), so a committing call is awaited / followed by a macrotask tick before asserting.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { nextCellIndex, prevCellIndex, gridKeymap, installGridNavigation } from '../src/navigation.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

class FocusStub extends View {
  override focusable = true;
  override draw(): void {
    // holds focus away from any grid; paints nothing
  }
}

interface Person {
  id: number;
  name: string;
  city: string;
}

function buildGrid(opts: { onCommit?: () => boolean } = {}) {
  const rows = signal<Person[]>([
    { id: 1, name: 'Ada', city: 'NYC' },
    { id: 2, name: 'Bo', city: 'LA' },
    { id: 3, name: 'Cy', city: 'SF' },
  ]);
  const editable = (id: keyof Person & string, title: string) =>
    column<Person, string>({
      id,
      title,
      value: (r) => String(r[id]),
      parse: (t) => t,
      set: (r, v) => {
        (r[id] as string) = v;
      },
      width: 8,
    });
  const grid = new EditableDataGrid<Person>({
    columns: [editable('name', 'Name'), editable('city', 'City')],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: opts.onCommit,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 6 } };
  return { grid, rows };
}

// ── §C.1 pure cursor math ────────────────────────────────────────────────────────────────────────

// ST-14 — nextCellIndex: col+1 mid-row; wraps to the next row's first column at the last column.
test('ST-14: nextCellIndex advances then wraps at a row end', () => {
  expect(nextCellIndex(0, 0, 3, 3)).toEqual({ col: 1, row: 0 });
  expect(nextCellIndex(2, 0, 3, 3)).toEqual({ col: 0, row: 1 }); // wrap
});

// ST-15 — prevCellIndex: col−1 mid-row; wraps to the previous row's last column at column 0.
test('ST-15: prevCellIndex retreats then wraps at column 0', () => {
  expect(prevCellIndex(2, 1, 3, 3)).toEqual({ col: 1, row: 1 });
  expect(prevCellIndex(0, 1, 3, 3)).toEqual({ col: 2, row: 0 }); // wrap
});

// ST-16 — 'exit' at the grid edges and for an empty grid.
test("ST-16: 'exit' at the last/first cell and for an empty grid", () => {
  expect(nextCellIndex(2, 2, 3, 3)).toBe('exit'); // last cell of last row
  expect(prevCellIndex(0, 0, 3, 3)).toBe('exit'); // first cell
  expect(nextCellIndex(0, 0, 0, 0)).toBe('exit'); // empty grid
  expect(prevCellIndex(0, 0, 3, 0)).toBe('exit'); // no rows
});

// ── §C.2 grid.nextCell commit-then-advance ───────────────────────────────────────────────────────

// ST-17 — nextCell commits an open edit then advances; a vetoed commit stays put; 'exit' at the edge.
test('ST-17: nextCell commits then advances a cell; a vetoed commit stays put', async () => {
  const a = buildGrid();
  const root = new Group();
  root.add(a.grid);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(a.grid.rows);

  loop.dispatch(key('Z')); // begin a replace-edit at (col 0, row 0) → field 'Z'
  expect(a.grid.overlay.children.length).toBe(1);
  const moved = await a.grid.nextCell();
  expect(moved).toBe('moved');
  expect(a.grid.overlay.children.length).toBe(0); // editor closed after commit
  expect(a.rows()[0].name).toBe('Z'); // value committed
  // Advance one more cell: (col 1, row 0) → wrap to (col 0, row 1), so the focused record is row 1.
  await a.grid.nextCell();
  expect(a.grid.focusedRow()?.id).toBe(2);

  // Vetoed commit: the editor stays open and the cursor does not advance.
  const b = buildGrid({ onCommit: () => false });
  const root2 = new Group();
  root2.add(b.grid);
  const loop2 = createEventLoop({ width: 30, height: 6 }, { caps });
  loop2.mount(root2);
  loop2.focusView(b.grid.rows);
  loop2.dispatch(key('Q')); // begin a replace-edit
  const vetoed = await b.grid.nextCell();
  expect(vetoed).toBe('moved'); // handled Tab (do not hand focus away) even though it did not advance
  expect(b.grid.overlay.children.length).toBe(1); // editor still open
  expect(b.rows()[0].name).toBe('Ada'); // reverted

  // 'exit' at the last cell of the last row.
  const c = buildGrid();
  const root3 = new Group();
  root3.add(c.grid);
  const loop3 = createEventLoop({ width: 30, height: 6 }, { caps });
  loop3.mount(root3);
  loop3.focusView(c.grid.rows);
  loop3.dispatch(key('end', { ctrl: true })); // gridEnd → last cell
  expect(await c.grid.nextCell()).toBe('exit');
});

// ── §C.3 gridKeymap + installGridNavigation ──────────────────────────────────────────────────────

// ST-18 — gridKeymap binds Tab / Shift-Tab to the grid-navigation commands.
test('ST-18: gridKeymap binds Tab and Shift-Tab', () => {
  expect(gridKeymap.lookup({ type: 'key', key: 'tab', ctrl: false, alt: false, shift: false })).toBe('grid.nextCell');
  expect(gridKeymap.lookup({ type: 'key', key: 'tab', ctrl: false, alt: false, shift: true })).toBe('grid.prevCell');
});

// ST-19 — installGridNavigation: the focused grid advances; no grid focused → focusNext; multi-grid.
test('ST-19: installGridNavigation advances the focused grid, else focuses the next widget', async () => {
  const a = buildGrid();
  const b = buildGrid();
  const stub = new FocusStub();
  stub.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 4, height: 1 } };
  const root = new Group();
  root.add(a.grid);
  root.add(b.grid);
  root.add(stub);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  const uninstall = installGridNavigation(loop, [a.grid, b.grid]);

  // Only grid A is focused: two advances take A to row 1; B stays put; A keeps focus (no exit).
  loop.focusView(a.grid.rows);
  loop.emitCommand('grid.nextCell');
  await tick();
  loop.emitCommand('grid.nextCell');
  await tick();
  expect(a.grid.focusedRow()?.id).toBe(2); // A advanced (wrapped a row)
  expect(b.grid.focusedRow()?.id).toBe(1); // B untouched — only one grid acted
  expect(loop.getFocused()).toBe(a.grid.rows); // still in A (did not exit)

  // No grid focused → the command falls back to focusNext (focus leaves the stub).
  loop.focusView(stub);
  loop.emitCommand('grid.nextCell');
  await tick();
  expect(loop.getFocused()).not.toBe(stub);

  uninstall();
});

// ST-19b — after a Tab-commit the grid body still holds focus (no dead grid).
test('ST-19b: a Tab-commit restores body focus so the next key still moves the cursor', async () => {
  const a = buildGrid();
  const root = new Group();
  root.add(a.grid);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  const uninstall = installGridNavigation(loop, a.grid);

  loop.focusView(a.grid.rows);
  loop.dispatch(key('Z')); // begin an edit at (0,0)
  expect(a.grid.overlay.children.length).toBe(1);
  loop.emitCommand('grid.nextCell'); // commit + advance
  await tick();
  expect(a.grid.overlay.children.length).toBe(0); // editor closed
  expect(loop.getFocused()).toBe(a.grid.rows); // focus restored to the body, not the disposed editor

  // The next arrow moves the cursor, proving the body is live (not a dead grid).
  const before = a.grid.focusedRow()?.id;
  loop.dispatch(key('down'));
  expect(a.grid.focusedRow()?.id).not.toBe(before);

  uninstall();
});
