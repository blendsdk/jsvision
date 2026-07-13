/**
 * Specification tests (immutable oracles) — the `EditableGridRows` cell cursor (ST-12 navigation) and
 * the focused-cell overpaint (ST-13). Navigation reassigns `←`/`→`/`Home`/`End`/`Ctrl+Home`/`Ctrl+End`
 * to the column cursor (all clamped) while `↑`/`↓`/`PgUp`/`PgDn` still move the row through the base;
 * the focused cell is overpainted in `gridCursor` only while the body has focus.
 *
 * Expectations derive from the requirements + the frozen theme roles, never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { EditableGridRows } from '../src/editable-grid-rows.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A synthetic key envelope for `loop.dispatch`. */
function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** A focusable stub used to blur the grid (a plain Group is not a focus target). */
class FocusStub extends View {
  override focusable = true;
  override draw(): void {
    // nothing to paint — it exists only to hold focus away from the grid
  }
}

interface Row {
  name: string;
  city: string;
  qty: number;
}
const DATA: Row[] = [
  { name: 'Ada', city: 'NYC', qty: 1 },
  { name: 'Bo', city: 'LA', qty: 2 },
  { name: 'Cy', city: 'SF', qty: 3 },
];
const COLS: Column<Row>[] = [
  { title: 'Name', accessor: (r) => r.name, width: 8 },
  { title: 'City', accessor: (r) => r.city, width: 8 },
  { title: 'Qty', accessor: (r) => String(r.qty), width: 6, align: 'right' },
];
const N_COLS = COLS.length;
const LAST_ROW = DATA.length - 1;
const W = 30;
const H = 5;

function build() {
  const focused = signal(0);
  const focusedCol = signal(0);
  const selected = signal(-1);
  const indent = signal(0);
  const grid = new EditableGridRows<Row>({
    display: () => DATA,
    columns: COLS,
    autoWidths: () => COLS.map(() => null),
    indent,
    focused,
    selected,
    zebra: false,
    focusedCol,
    typedColumns: COLS.map((c, i) => ({ id: `c${i}`, title: c.title, value: () => 0 })),
    overlay: new Group(),
    rowKey: () => 0,
    bumpVersion: () => undefined,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const stub = new FocusStub();
  stub.layout = { position: 'absolute', rect: { x: 0, y: H - 1, width: 1, height: 1 } };
  const root = new Group();
  root.add(grid);
  root.add(stub);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid);
  return { grid, stub, loop, focused, focusedCol };
}

// ST-12 — ← / → move the column cursor and clamp at the ends.
test('left/right move the column cursor and clamp at 0 and n-1', () => {
  const { loop, focusedCol } = build();
  expect(focusedCol()).toBe(0);
  loop.dispatch(key('right'));
  expect(focusedCol()).toBe(1);
  loop.dispatch(key('right'));
  loop.dispatch(key('right')); // past the last column — clamps
  expect(focusedCol()).toBe(N_COLS - 1);
  loop.dispatch(key('left'));
  expect(focusedCol()).toBe(N_COLS - 2);
  loop.dispatch(key('left'));
  loop.dispatch(key('left')); // past the first column — clamps
  expect(focusedCol()).toBe(0);
});

// ST-12 — Home / End jump to the first / last column.
test('Home/End jump to the first and last column', () => {
  const { loop, focusedCol } = build();
  loop.dispatch(key('end'));
  expect(focusedCol()).toBe(N_COLS - 1);
  loop.dispatch(key('home'));
  expect(focusedCol()).toBe(0);
});

// ST-12 — Ctrl+Home / Ctrl+End jump to the first / last cell of the whole grid.
test('Ctrl+Home/Ctrl+End jump to the grid corners', () => {
  const { loop, focused, focusedCol } = build();
  loop.dispatch(key('end', { ctrl: true }));
  expect(focused()).toBe(LAST_ROW);
  expect(focusedCol()).toBe(N_COLS - 1);
  loop.dispatch(key('home', { ctrl: true }));
  expect(focused()).toBe(0);
  expect(focusedCol()).toBe(0);
});

// ST-12 — ↑ / ↓ still move the row (base fall-through), leaving the column cursor unchanged.
test('up/down move the row through the base and leave the column cursor put', () => {
  const { loop, focused, focusedCol } = build();
  loop.dispatch(key('right')); // put the column cursor at 1
  expect(focusedCol()).toBe(1);
  loop.dispatch(key('down'));
  expect(focused()).toBe(1);
  expect(focusedCol()).toBe(1); // unchanged by a row move
  loop.dispatch(key('up'));
  expect(focused()).toBe(0);
});

// ST-12 — PgUp / PgDn still page the row through the base.
test('PgUp/PgDn page the row through the base', () => {
  const { loop, focused } = build();
  loop.dispatch(key('pagedown'));
  expect(focused()).toBe(LAST_ROW); // clamped to the last row
  loop.dispatch(key('pageup'));
  expect(focused()).toBe(0);
});

// ST-13 — with the body focused, the focused cell is overpainted in gridCursor; the rest of the
// focused row keeps its listFocused colour (proving the cursor is per-cell, not the whole row).
test('the focused cell is overpainted in gridCursor while the body is focused', () => {
  const { loop } = build(); // focusedCol = 0
  const buf = loop.renderRoot.buffer();
  const row0 = Array.from({ length: W }, (_, x) => buf.get(x, 0));
  expect(row0[0]?.bg).toBe(defaultTheme.gridCursor.bg); // the cursor cell (col 0) is white
  expect(row0[0]?.fg).toBe(defaultTheme.gridCursor.fg); // black on white
  expect(row0.some((cell) => cell?.bg === defaultTheme.listFocused.bg)).toBe(true); // rest of the row is still green
});

// ST-13 — with the body NOT focused, there is no cursor box; the focused row falls back to listSelected.
test('there is no cursor box when the body is not focused', () => {
  const { loop, stub } = build();
  loop.focusView(stub); // blur the grid
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 0)?.bg).not.toBe(defaultTheme.gridCursor.bg); // no white cursor cell
  expect(buf.get(0, 0)?.bg).toBe(defaultTheme.listSelected.bg); // unfocused focused-row colour
});
