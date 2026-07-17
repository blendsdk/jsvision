/**
 * Specification tests (immutable oracles) — the body's chord→action dispatch (`editable-grid-rows.ts`).
 *
 * A key event is resolved to a `GridAction` against the merged keymap and routed to the matching seam:
 * column-cursor moves, base-delegated row navigation, begin-edit / value-help, selection toggle/extend,
 * and filter-open. The editability precedence is preserved — on an editable cell a key that could edit
 * or select begins the edit; on a read-only cell it selects or activates. A remapped chord flows through
 * the same router; an unknown chord is ignored. With NO keymap option the whole gesture matrix behaves
 * exactly as the pre-keymap grid (the regression oracle). A panel that does not own the global cursor
 * no-ops on edit/selection keys (frozen-panel correctness).
 *
 * Expectations derive from the requirements + the AR decisions, never the implementation. An open editor
 * is observable as one child mounted in the overlay; the cursor is the `focused`/`focusedCol` signals.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column, toEngineColumn } from '../src/column.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { mergeKeymap } from '../src/keymap.js';
import type { GridKeymap } from '../src/keymap.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface Person {
  id: number;
  name: string;
}

/** col 0 = editable Name (parse+set), col 1 = read-only ID. */
const NAME = column<Person, string>({
  id: 'name',
  title: 'Name',
  value: (r) => r.name,
  parse: (t) => t,
  set: (r, v) => {
    r.name = v;
  },
  width: 8,
});
const ID = column<Person, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6 });

const W = 24;
const H = 6;

interface BuildOpts {
  keymap?: GridKeymap;
  columnOffset?: number;
  totalCols?: number;
}

function build(opts: BuildOpts = {}) {
  const rows: Person[] = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bo' },
    { id: 3, name: 'Cy' },
  ];
  const typedColumns = [NAME, ID];
  const engineCols = typedColumns.map(toEngineColumn);
  const focused = signal(0);
  const focusedCol = signal(0);
  const selected = signal(-1);
  const indent = signal(0);
  const version = signal(0);
  const overlay = new Group();
  overlay.layout = { position: 'fill' };
  const toggled: number[] = [];
  const ranged: number[] = [];
  const filtered: number[] = [];
  const grid = new EditableGridRows<Person>({
    display: () => {
      version();
      return rows;
    },
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent,
    focused,
    selected,
    zebra: false,
    focusedCol,
    typedColumns,
    overlay,
    rowKey: (r) => r.id,
    bumpVersion: () => version.set(version() + 1),
    onToggleRow: (i) => toggled.push(i),
    onRangeToRow: (i) => ranged.push(i),
    onOpenFilter: (g) => filtered.push(g),
    columnOffset: opts.columnOffset,
    totalCols: opts.totalCols !== undefined ? () => opts.totalCols! : undefined,
    keymap: opts.keymap,
  });
  grid.layout = { position: 'fill' };
  const container = new Group();
  container.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  container.add(grid);
  container.add(overlay);
  const root = new Group();
  root.add(container);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid);
  return { grid, loop, overlay, rows, focused, focusedCol, toggled, ranged, filtered };
}

// ST-7 — every default nav chord moves the cursor per the documented table (up/down/page delegate to base).
test('ST-7: default navigation chords move the row/column cursor', () => {
  const { loop, focused, focusedCol } = build();
  loop.dispatch(key('right'));
  expect(focusedCol()).toBe(1); // moveRight
  loop.dispatch(key('left'));
  expect(focusedCol()).toBe(0); // moveLeft
  loop.dispatch(key('end'));
  expect(focusedCol()).toBe(1); // rowEnd → last column
  loop.dispatch(key('home'));
  expect(focusedCol()).toBe(0); // rowStart → first column
  loop.dispatch(key('down'));
  expect(focused()).toBe(1); // moveDown (base focusBy(+1))
  loop.dispatch(key('up'));
  expect(focused()).toBe(0); // moveUp
  loop.dispatch(key('end', { ctrl: true }));
  expect(focused()).toBe(2); // gridEnd → last row
  expect(focusedCol()).toBe(1); //         and last column
  loop.dispatch(key('home', { ctrl: true }));
  expect(focused()).toBe(0); // gridStart → first row
  expect(focusedCol()).toBe(0); //           and first column
  loop.dispatch(key('pagedown'));
  expect(focused()).toBe(2); // pageDown (base focusBy(+viewportRows), clamped to last)
});

// ST-8 — begin-edit chords on an editable cell open the editor (F2, printable, F4 value-help).
test('ST-8: F2 / printable / F4 open the editor on an editable cell', () => {
  const a = build();
  a.loop.dispatch(key('f2'));
  expect(a.overlay.children.length).toBe(1);

  const b = build();
  b.loop.dispatch(key('x')); // a printable begins a replace-edit
  expect(b.overlay.children.length).toBe(1);
  const editor = b.loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  expect(editor instanceof Input ? editor.getValueSignal()() : '').toBe('x');

  const c = build();
  c.loop.dispatch(key('f4')); // value help begins the edit (dropdown opener; inert on a text column)
  expect(c.overlay.children.length).toBe(1);
});

// ST-9 — Enter on a read-only cell activates the base row, mounting no editor.
test('ST-9: Enter on a read-only cell mounts no editor (base activate)', () => {
  const { grid, loop, overlay } = build();
  loop.dispatch(key('right')); // move to the read-only ID column
  loop.dispatch(key('enter'));
  expect(overlay.children.length).toBe(0);
  expect(loop.getFocused()).toBe(grid); // no editor took focus
});

// ST-10 — selection keys: Space toggles a read-only row; Shift+Down extends the range one row.
test('ST-10: Space toggles a read-only row and Shift+Down extends the range', () => {
  const { loop, toggled, ranged } = build();
  loop.dispatch(key('right')); // read-only ID column, so Space is a selection toggle (not an edit)
  loop.dispatch(key('space'));
  expect(toggled).toEqual([0]); // toggled the focused row
  loop.dispatch(key('down', { shift: true }));
  expect(ranged).toEqual([1]); // extended the range to the next row
});

// ST-11 — Alt+Down opens the focused column's filter popup.
test('ST-11: Alt+Down opens the focused column filter', () => {
  const { loop, filtered } = build();
  loop.dispatch(key('right'));
  loop.dispatch(key('down', { alt: true }));
  expect(filtered).toEqual([1]); // openFilter reported the focused (global) column index
});

// ST-12 — a remapped chord flows through the router; the original survives; an unknown chord is ignored.
test('ST-12: a keymap remap takes effect, the default still works, unknown is ignored', () => {
  const a = build({ keymap: mergeKeymap({ 'ctrl+e': 'beginEdit' }) });
  a.loop.dispatch(key('e', { ctrl: true }));
  expect(a.overlay.children.length).toBe(1); // Ctrl+E now begins the edit

  const b = build({ keymap: mergeKeymap({ 'ctrl+e': 'beginEdit' }) });
  b.loop.dispatch(key('f2'));
  expect(b.overlay.children.length).toBe(1); // F2 still begins the edit

  const c = build({ keymap: mergeKeymap({ 'ctrl+e': 'beginEdit' }) });
  expect(() => c.loop.dispatch(key('j', { ctrl: true }))).not.toThrow();
  expect(c.overlay.children.length).toBe(0); // Ctrl+J is unmapped → no effect
});

// ST-13 — regression: with NO keymap option the whole gesture matrix behaves as the pre-keymap grid.
test('ST-13: no keymap option → the RD-02..09 gesture matrix is byte-identical', () => {
  const { loop, overlay, rows, focused, focusedCol, toggled, ranged, filtered } = build();

  // Edit gestures on the editable Name column (col 0).
  loop.dispatch(key('f2'));
  expect(overlay.children.length).toBe(1); // F2 edits
  loop.dispatch(key('escape')); // close the editor
  expect(overlay.children.length).toBe(0);

  // Space on an editable cell begins a replace-edit (edit-before-select precedence), not a toggle.
  loop.dispatch(key('space'));
  expect(overlay.children.length).toBe(1);
  expect(toggled).toEqual([]); // no selection toggle on an editable cell
  loop.dispatch(key('escape'));

  // Cursor keys.
  loop.dispatch(key('right'));
  expect(focusedCol()).toBe(1);

  // Space on the read-only ID column toggles selection.
  loop.dispatch(key('space'));
  expect(toggled).toEqual([0]);

  // Shift+arrows extend the range; Alt+Down opens the filter; Enter on read-only activates (no editor).
  loop.dispatch(key('down', { shift: true }));
  expect(ranged).toEqual([1]);
  loop.dispatch(key('down', { alt: true }));
  expect(filtered).toEqual([1]);
  loop.dispatch(key('enter'));
  expect(overlay.children.length).toBe(0);
  expect(rows[0]).toEqual({ id: 1, name: 'Ada' }); // record untouched by the read-only activate
  expect(focused()).toBe(0);
});

// ST-13b — a panel that does not own the global cursor no-ops on edit/selection keys (frozen-panel).
test('ST-13b: a non-owning frozen panel no-ops on edit/selection keys', () => {
  // This panel owns local column 0 only (its slice is [Name]); the global cursor lives at column 2.
  const g = build({ columnOffset: 0, totalCols: 3 });
  g.focusedCol.set(2); // the cursor is in another panel → localCol() < 0 here

  g.loop.dispatch(key('space'));
  expect(g.toggled).toEqual([]); // no toggle from the non-owning panel
  g.loop.dispatch(key('down', { shift: true }));
  expect(g.ranged).toEqual([]); // no range-extend either
  g.loop.dispatch(key('enter'));
  expect(g.overlay.children.length).toBe(0); // no edit of the wrong panel's column 0

  // Control: once this panel owns the cursor again, the selection gesture fires.
  g.focusedCol.set(0);
  g.loop.dispatch(key('space')); // editable Name cell → begins an edit, still no toggle
  expect(g.overlay.children.length).toBe(1);
});
