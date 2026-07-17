/**
 * Specification tests (immutable oracles) — the footer BAND's layout: sticky-while-scrolling and
 * column-alignment across a frozen/scrolling panel split.
 *
 * The footer is a fixed band directly above the horizontal scroll bar, outside the body's virtual-scroll
 * window — so it never scrolls away, and its total (folded over all displayed rows) is independent of the
 * scroll position. Its aggregate cells reuse the body's per-panel geometry, so each cell aligns to its
 * column's x on both sides of a freeze split (a frozen cell does not pan; a center cell pans with the body).
 *
 * Expectations derive from the requirements/spec docs. Cell text is read from the painted buffer; a body
 * cell is used as the ground-truth x for its column so alignment is asserted against the real geometry.
 */
import { test, expect } from 'vitest';
import { Group, Text, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const key = (k: string) => ({ type: 'key' as const, key: k, ctrl: false, alt: false, shift: false });

function rowText(
  loop: { renderRoot: { buffer(): { get(x: number, y: number): { char: string } | undefined } } },
  y: number,
  width: number,
): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = 0; x < width; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

/** The digits painted on a row (a footer cell renders a trailing `│` divider that `trim` would keep). */
const digits = (s: string): string => s.replace(/\D/g, '');

// ---- Sticky (ST-14/ST-15): a tall single-column grid --------------------------------------------

interface V {
  id: number;
  v: number;
}
function buildTall() {
  const rows = signal<V[]>(Array.from({ length: 8 }, (_x, i) => ({ id: i + 1, v: i + 1 }))); // v = 1..8, Σ = 36
  const grid = new EditableDataGrid<V>({
    columns: [column<V, number>({ id: 'v', title: 'V', value: (r) => r.v, align: 'right', width: 10 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    footer: { aggregates: { v: { fn: 'sum' } } },
  });
  const W = 14;
  const H = 6; // header(0) · body(1,2,3) · footer(4) · hbar(5)
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop, W, H };
}

// ST-14 — the footer stays visible with the same total while the body scrolls vertically.
test('ST-14: should keep the footer total visible and unchanged while the body scrolls', () => {
  const { loop, W, H } = buildTall();
  const footerY = H - 2;
  expect(digits(rowText(loop, footerY, W))).toBe('36'); // Σ over all 8 rows
  const topBefore = digits(rowText(loop, 1, W)); // first visible body row

  for (let i = 0; i < 5; i += 1) loop.dispatch(key('down')); // scroll down
  loop.renderRoot.flush();

  expect(digits(rowText(loop, footerY, W))).toBe('36'); // sticky + unchanged (folds all rows, not the window)
  expect(digits(rowText(loop, 1, W))).not.toBe(topBefore); // the body window scrolled beneath the footer
});

// ST-15 — the footer occupies the fixed bottom band; a body row never appears where the footer sits.
test('ST-15: should occupy the fixed bottom band above the scroll bar', () => {
  const { loop, W, H } = buildTall();
  const footerY = H - 2;
  const bodyBottomY = H - 3; // the last body row, just above the footer
  expect(digits(rowText(loop, footerY, W))).toBe('36');
  expect(digits(rowText(loop, bodyBottomY, W))).not.toBe('36'); // that is a data row, not the footer

  for (let i = 0; i < 5; i += 1) loop.dispatch(key('down'));
  loop.renderRoot.flush();
  expect(digits(rowText(loop, footerY, W))).toBe('36'); // still the footer band at the same y after scrolling
});

// ---- Frozen alignment (ST-16): a frozen-left column + scrolling center columns ------------------

interface ABC {
  id: number;
  a: number;
  b: number;
  c: number;
}
function buildFrozen() {
  const rows = signal<ABC[]>([
    { id: 1, a: 10, b: 200, c: 3000 },
    { id: 2, a: 20, b: 300, c: 4000 },
  ]);
  // a Σ = 30 (frozen), c Σ = 7000 (center, rightmost — off-screen until the center scrolls)
  const grid = new EditableDataGrid<ABC>({
    columns: [
      column<ABC, number>({ id: 'a', title: 'A', value: (r) => r.a, width: 5 }),
      column<ABC, number>({ id: 'b', title: 'B', value: (r) => r.b, width: 5 }),
      column<ABC, number>({ id: 'c', title: 'C', value: (r) => r.c, width: 5 }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    freezeLeft: ['a'],
    footer: { aggregates: { a: { fn: 'sum' }, c: { fn: 'sum' } } },
  });
  const W = 13;
  const H = 5; // header(0) · body(1,2) · footer(3) · hbar(4)
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop, W, H };
}

// ST-16 — each aggregate aligns to its column's x across the split: the frozen cell never pans, the
// center cell pans with the body (verified against the body cell's own x).
test('ST-16: should align aggregate cells to their columns across a frozen/scrolling split', () => {
  const { loop, W, H } = buildFrozen();
  const footerY = H - 2;
  const footer0 = rowText(loop, footerY, W);
  const bodyTop0 = rowText(loop, 1, W);
  // The frozen aggregate (Σ a = 30) sits in the frozen panel at the same x as the frozen body value (10).
  expect(footer0.indexOf('30')).toBe(bodyTop0.indexOf('10'));
  expect(footer0.indexOf('30')).toBeGreaterThanOrEqual(0);
  const frozenXBefore = footer0.indexOf('30');

  // Scroll the center right until the rightmost center column (c) is revealed.
  loop.dispatch(key('right')); // cursor a → b
  loop.dispatch(key('right')); // cursor b → c (off-screen ⇒ center auto-scrolls to reveal it)
  loop.renderRoot.flush();

  const footer1 = rowText(loop, footerY, W);
  const bodyTop1 = rowText(loop, 1, W);
  // The frozen aggregate did NOT pan — still at the same x.
  expect(footer1.indexOf('30')).toBe(frozenXBefore);
  // The center aggregate (Σ c = 7000) is now visible, aligned to the center body value (3000) — it panned
  // with the body.
  expect(footer1.indexOf('7000')).toBeGreaterThanOrEqual(0);
  expect(footer1.indexOf('7000')).toBe(bodyTop1.indexOf('3000'));
});

// ---- Security (ST-28) ---------------------------------------------------------------------------

// ST-28 — a footer aggregate label and a widget text carrying control bytes render stripped: no raw
// ESC/BEL ever reaches the buffer or the serialized frame (the ctx.text draw boundary sanitizes).
test('ST-28: should strip control bytes from footer label + widget text at the draw boundary', () => {
  const rows = signal<V[]>([
    { id: 1, v: 10 },
    { id: 2, v: 20 },
  ]);
  const grid = new EditableDataGrid<V>({
    columns: [column<V, number>({ id: 'v', title: 'V', value: (r) => r.v, align: 'right', width: 12 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    footer: {
      aggregates: { v: { fn: 'sum', label: '\x1b[31mΣ\x07' } }, // ESC/BEL-laden aggregate label
      widgets: [new Text('tot\x1b[31mal\x07')], // ESC/BEL-laden widget text
    },
  });
  const W = 16;
  const H = 7; // header · body(×2) · aggregate row · widget row · hbar
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();

  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b'); // no raw ESC in any cell
      expect(ch).not.toBe('\x07'); // no raw BEL in any cell
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07'); // and none in the emitted frame
});
