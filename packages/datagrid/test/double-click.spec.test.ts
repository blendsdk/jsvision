/**
 * Specification tests (immutable oracles) — mouse double-click-to-edit, single-click cell focus, and the
 * scroll-into-view guarantee.
 *
 * Two mouse-downs on the same editable cell within the framework's 500 ms window (driven here by an
 * injected clock) begin the edit; a single click is cursor-only but now moves the COLUMN cursor to the
 * clicked cell too (so click-then-F2 edits the clicked column); a double-click on a read-only cell keeps
 * the base row-activate. Activating an off-screen row or column scrolls it into view — the cursor is
 * never rendered off-screen — over the existing scroll machinery, no new mechanism.
 *
 * Expectations derive from the requirements + the AR decisions, never the implementation. Coordinates are
 * 1-based; the header sits at screen row 0, so body display row `r` is `y = r + 2`.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: { ctrl?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: mods.ctrl ?? false, alt: false, shift: false };
}

interface Person {
  id: number;
  name: string;
  city: string;
}

const editable = (id: 'name' | 'city', title: string) =>
  column<Person, string>({
    id,
    title,
    value: (r) => r[id],
    parse: (t) => t,
    set: (r, v) => {
      r[id] = v;
    },
    width: 8,
  });
const READONLY_ID = column<Person, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6 });

const W = 24;
const H = 6;

/** A clock-injected grid: `clock.t` drives the loop's `now`, so double-click timing is deterministic. */
function build(rowCount = 3) {
  const data: Person[] = Array.from({ length: rowCount }, (_, i) => ({
    id: i + 1,
    name: `n${i + 1}`,
    city: `c${i + 1}`,
  }));
  const rows = signal<Person[]>(data);
  const grid = new EditableDataGrid<Person>({
    columns: [editable('name', 'Name'), editable('city', 'City'), READONLY_ID],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const clock = { t: 0 };
  const loop = createEventLoop({ width: W, height: H }, { caps, now: () => clock.t });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop, rows, clock };
}

/** A body mouse-down at (x, display row r). */
function down(loop: ReturnType<typeof build>['loop'], x: number, r: number) {
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x, y: r + 2 } as never);
}

/** The focused editor's bound value (the editor is a focused Input). */
function fieldValue(loop: ReturnType<typeof build>['loop']): string {
  const editor = loop.getFocused();
  return editor instanceof Input ? editor.getValueSignal()() : '';
}

/** The characters painted on each screen row. */
function frameText(loop: ReturnType<typeof build>['loop']): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

// Column x-centres for the 8/8/6 layout: Name≈2, City≈11, ID≈20.
const X_NAME = 2;
const X_CITY = 11;
const X_ID = 20;

// ST-20 — two downs on the same editable cell within 500 ms edit it; a single down is cursor-only.
test('ST-20: double-click on an editable cell opens the editor; single click does not', () => {
  const g = build();
  down(g.loop, X_NAME, 0); // click 1
  g.clock.t = 200;
  down(g.loop, X_NAME, 0); // click 2 within 500 ms → double-click
  expect(g.grid.overlay.children.length).toBe(1);

  const s = build();
  down(s.loop, X_NAME, 0); // a lone single click
  expect(s.grid.overlay.children.length).toBe(0); // cursor-only, no editor
});

// ST-20b — a single click moves the COLUMN cursor to the clicked cell (single-body grid) — PF-001.
test('ST-20b: a single click focuses the clicked column, so F2 edits that cell', () => {
  const g = build();
  // cursor starts at (col 0). Click a City (col 1) cell, then F2 → the editor seeds from City, proving
  // the column cursor followed the click.
  down(g.loop, X_CITY, 0);
  expect(g.grid.overlay.children.length).toBe(0); // single click is not an edit
  g.loop.dispatch(key('f2'));
  expect(g.grid.overlay.children.length).toBe(1);
  expect(fieldValue(g.loop)).toBe('c1'); // City[row 0] — cursor moved to the clicked column
});

// ST-21 — a double-click on a read-only cell activates the base row, mounting no editor.
test('ST-21: double-click on a read-only cell mounts no editor', () => {
  const g = build();
  down(g.loop, X_ID, 0);
  g.clock.t = 150;
  down(g.loop, X_ID, 0); // double-click the read-only ID cell
  expect(g.grid.overlay.children.length).toBe(0); // no editor — base activate only
});

// ST-22 — two downs >500 ms apart reset the click count, so no edit begins.
test('ST-22: two downs more than 500 ms apart do not begin an edit', () => {
  const g = build();
  down(g.loop, X_NAME, 0);
  g.clock.t = 800; // beyond the 500 ms window
  down(g.loop, X_NAME, 0); // clickCount resets to 1 → single click
  expect(g.grid.overlay.children.length).toBe(0);
});

// ST-23 — activating an off-screen row scrolls it into view (the cursor is never off-screen).
test('ST-23: Ctrl+End scrolls the last row into view', () => {
  const g = build(20); // 20 rows, viewport shows ~4 body rows
  g.loop.dispatch(key('end', { ctrl: true })); // gridEnd → last row
  g.loop.renderRoot.flush();
  expect(frameText(g.loop)).toContain('n20'); // the last row is visible in the window
});

// ST-24 — moving the cursor to an off-screen column (frozen-center panel) scrolls to reveal it.
test('ST-24: an off-screen column scrolls into view on a cursor move', () => {
  const rows = signal<Person[]>([{ id: 1, name: 'Ada', city: 'NYC' }]);
  // A frozen-left grid: the narrow center panel must scroll to reveal a far column. Wide fixed columns
  // guarantee overflow so the cursor move triggers the center panel's auto-scroll.
  const cols = [
    column<Person, string>({ id: 'a', title: 'AAAAA', value: () => 'aaaaa', width: 10 }),
    column<Person, string>({ id: 'b', title: 'BBBBB', value: () => 'bbbbb', width: 10 }),
    column<Person, string>({ id: 'c', title: 'CCCCC', value: () => 'zzzzz', width: 10 }),
  ];
  const grid = new EditableDataGrid<Person>({
    columns: cols,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    freeze: 1, // freeze column 'a' → 'b'/'c' live in the scrolling center panel
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('end')); // rowEnd → last column ('c'), off-screen in the center panel
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
  expect(s).toContain('zzzzz'); // the far column scrolled into view
});
