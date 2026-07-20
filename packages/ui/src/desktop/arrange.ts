/**
 * Arranging and switching the windows on a desktop.
 *
 * These are pure helpers over a desktop's window list (list order is z-order, first = back):
 * `cascade` and `tile` reposition every window by setting its `layout.rect`, and
 * `nextWindow`/`prevWindow`/`windowByNumber` pick which window to switch to (the desktop then raises
 * it). Both arrangers un-maximize a window before moving it, and both do nothing when the desktop is
 * too small to fit the arrangement.
 *
 * The desktop area spans `(0,0)` to `(deskW,deskH)` with an exclusive bottom-right edge.
 */
import type { Window } from '../window/index.js';
import { MIN_WIDTH, MIN_HEIGHT } from './gestures.js';

/** Un-maximize a window, set its rect, re-pin its children, and schedule a repaint. */
function place(w: Window, x: number, y: number, width: number, height: number): void {
  w.resetZoom();
  w.setLayout({ rect: { x, y, width, height } });
  w.onResized(); // re-pin children to the new size before the repaint reads them
  // Not redundant with `setLayout`'s own reflow request: that one fires before `onResized()`
  // re-pins, so this is the one that schedules a pass seeing the re-pinned children.
  w.invalidateLayout();
}

/**
 * Cascade the windows from the top-left: window `i` (back to front) lands at `(i, i)` with its
 * bottom-right pinned to the desktop corner, so the back window fills the desktop and each window in
 * front is offset one cell down-right and one cell smaller. Does nothing with no windows, or when the
 * front-most window would end up smaller than the minimum size.
 *
 * @param windows The desktop's windows in z-order (first = back).
 * @param deskW   Desktop width in cells.
 * @param deskH   Desktop height in cells.
 */
export function cascade(windows: readonly Window[], deskW: number, deskH: number): void {
  const n = windows.length;
  if (n === 0) return;
  // The front window has the largest offset (n−1); refuse if that would shrink it below the minimum.
  if (MIN_WIDTH > deskW - (n - 1) || MIN_HEIGHT > deskH - (n - 1)) return;
  windows.forEach((w, i) => place(w, i, i, deskW - i, deskH - i));
}

/** Integer square root: the largest `r` with `r*r ≤ i`, via integer Newton iteration. */
function iSqr(i: number): number {
  let r1 = 2;
  let r2 = Math.floor(i / r1);
  while (Math.abs(r1 - r2) > 1) {
    r1 = Math.floor((r1 + r2) / 2);
    r2 = Math.floor(i / r1);
  }
  return r1 < r2 ? r1 : r2;
}

/**
 * Split `n` into the most-equal pair of divisors, favoring more rows than columns, so e.g. two
 * windows stack (1 column × 2 rows) rather than sit side by side.
 *
 * @param n The window count.
 * @returns `{ cols, rows }` with `cols·rows ≥ n` and the two as close to equal as possible.
 */
function mostEqualDivisors(n: number): { cols: number; rows: number } {
  let i = iSqr(n);
  if (n % i !== 0 && n % (i + 1) === 0) i++;
  if (i < Math.floor(n / i)) i = Math.floor(n / i);
  return { cols: Math.floor(n / i), rows: i };
}

/** The `pos`-th of `num` even divider positions across `[lo, hi)`. */
function dividerLoc(lo: number, hi: number, num: number, pos: number): number {
  return Math.trunc(((hi - lo) * pos) / num) + lo;
}

/** The tile rect for the window in grid slot `pos`. */
function calcTileRect(
  pos: number,
  deskW: number,
  deskH: number,
  cols: number,
  rows: number,
  leftOver: number,
): { x: number; y: number; width: number; height: number } {
  // The first `cols−leftOver` columns hold `rows` cells; the trailing `leftOver` columns hold `rows+1`.
  const d = (cols - leftOver) * rows;
  let cx: number;
  let cy: number;
  if (pos < d) {
    cx = Math.floor(pos / rows);
    cy = pos % rows;
  } else {
    cx = Math.floor((pos - d) / (rows + 1)) + (cols - leftOver);
    cy = (pos - d) % (rows + 1);
  }
  const aX = dividerLoc(0, deskW, cols, cx);
  const bX = dividerLoc(0, deskW, cols, cx + 1);
  const rowsHere = pos < d ? rows : rows + 1;
  const aY = dividerLoc(0, deskH, rowsHere, cy);
  const bY = dividerLoc(0, deskH, rowsHere, cy + 1);
  return { x: aX, y: aY, width: bX - aX, height: bY - aY };
}

/**
 * Tile the windows into a grid that divides the desktop with no leftover gaps: `mostEqualDivisors(n)`
 * columns × rows, with the trailing `leftOver` columns each taking one extra row. Two windows stack;
 * one window fills the desktop. Does nothing with no windows, or when the desktop is too small to
 * give every cell at least one cell of width and height.
 *
 * @param windows The desktop's windows in z-order (first = back, taking tile slot 0).
 * @param deskW   Desktop width in cells.
 * @param deskH   Desktop height in cells.
 */
export function tile(windows: readonly Window[], deskW: number, deskH: number): void {
  const n = windows.length;
  if (n === 0) return;
  const { cols, rows } = mostEqualDivisors(n);
  // Refuse when the desktop is too small for even one cell per column or row.
  if (Math.floor(deskW / cols) === 0 || Math.floor(deskH / rows) === 0) return;
  const leftOver = n % cols;
  windows.forEach((w, i) => {
    const r = calcTileRect(i, deskW, deskH, cols, rows, leftOver);
    place(w, r.x, r.y, r.width, r.height);
  });
}

/** The next window after `active` in z-order, wrapping; `null` if there are no windows. */
export function nextWindow(windows: readonly Window[], active: Window | null): Window | null {
  return cycle(windows, active, +1);
}

/** The previous window before `active` in z-order, wrapping; `null` if there are no windows. */
export function prevWindow(windows: readonly Window[], active: Window | null): Window | null {
  return cycle(windows, active, -1);
}

/** The window whose `number === n`, or `null` if there is no such window. */
export function windowByNumber(windows: readonly Window[], n: number): Window | null {
  return windows.find((w) => w.number === n) ?? null;
}

/** Step `delta` from `active` in z-order with wrap; falls back to the first window. */
function cycle(windows: readonly Window[], active: Window | null, delta: number): Window | null {
  const n = windows.length;
  if (n === 0) return null;
  const current = active === null ? -1 : windows.indexOf(active);
  const base = current === -1 ? 0 : current;
  return windows[(base + delta + n) % n] ?? null;
}
