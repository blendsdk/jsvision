/**
 * Pure, view-free geometry and navigation math for {@link ColorSwatch}. No reactivity, no drawing;
 * every index is bounds-checked. It lays a palette of colors out in a fixed number of columns, maps a
 * pointer position to a cell, and computes wrap-around arrow-key navigation.
 *
 * Each color occupies a 3-column cell, so the grid is `columns * 3` cells wide by
 * `ceil(colorCount / columns)` rows tall. Arrow navigation wraps around the ends of the palette.
 */
import { toRgb } from '@jsvision/core';
import type { Color } from '@jsvision/core';

/** The width in columns of one color cell. */
export const CELL_WIDTH = 3;

/**
 * Relative luminance below which a cell's `◘` marker needs the forced-contrast colour. The marker is a
 * knocked-out circle that shows the cell's own (black) background through it, so on a near-black cell
 * it would vanish — this threshold flags those cells so the marker is drawn in a contrasting colour.
 */
const NEAR_BLACK_LUMA = 24;

/** Grid dimensions for a palette of `n` colors laid out in `columns` columns (coerced to ≥ 1). */
export function gridDims(n: number, columns: number): { cols: number; rows: number; width: number } {
  const cols = Math.max(1, Math.floor(columns));
  const count = Math.max(0, Math.floor(n));
  const rows = Math.ceil(count / cols);
  return { cols, rows, width: cols * CELL_WIDTH };
}

/** True when a view-local point lies within the grid rect (`0 ≤ x < cols*3`, `0 ≤ y < rows`). */
export function insideGrid(localX: number, localY: number, n: number, columns: number): boolean {
  const { rows, width } = gridDims(n, columns);
  return localX >= 0 && localX < width && localY >= 0 && localY < rows;
}

/**
 * The cell under a view-local point. Returns a real cell index, or `'overshoot'` (inside the grid
 * rect but past the last cell of a partial final row → the caller clamps to `n-1`), or `'outside'`
 * (beyond the grid rect → the caller reverts to the pre-drag cell). The two miss cases are kept
 * distinct so the swatch's revert-vs-clamp handling cannot conflate them.
 */
export function hitCell(localX: number, localY: number, n: number, columns: number): number | 'overshoot' | 'outside' {
  if (!insideGrid(localX, localY, n, columns)) return 'outside';
  const { cols } = gridDims(n, columns);
  const idx = localY * cols + Math.floor(localX / CELL_WIDTH);
  return idx < n ? idx : 'overshoot';
}

/** Left column of cell `i`'s 3-wide block: `(i % cols) * 3`. */
export function cellX(i: number, columns: number): number {
  const { cols } = gridDims(1, columns);
  return (i % cols) * CELL_WIDTH;
}

/** Row of cell `i`: `floor(i / cols)`. */
export function cellRow(i: number, columns: number): number {
  const { cols } = gridDims(1, columns);
  return Math.floor(i / cols);
}

/**
 * Wrap-around navigation one cell left; a palette of `n ≤ 1` is a no-op (no infinite wrap).
 * `_columns` is unused (a ±1 step needs no row width) but kept so all four nav fns share one signature.
 */
export function navLeft(cur: number, n: number, _columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  return cur > 0 ? cur - 1 : maxCol;
}

/** Wrap-around navigation one cell right; `n ≤ 1` is a no-op. `_columns` unused (see navLeft). */
export function navRight(cur: number, n: number, _columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  return cur < maxCol ? cur + 1 : 0;
}

/** Wrap-around navigation one row up; `n ≤ 1` is a no-op. */
export function navUp(cur: number, n: number, columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  const width = Math.max(1, Math.floor(columns));
  if (cur > width - 1) return cur - width;
  if (cur === 0) return maxCol;
  return cur + maxCol - width;
}

/** Wrap-around navigation one row down; `n ≤ 1` is a no-op. */
export function navDown(cur: number, n: number, columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  const width = Math.max(1, Math.floor(columns));
  if (cur < maxCol - (width - 1)) return cur + width;
  if (cur === maxCol) return 0;
  return cur - (maxCol - width);
}

/**
 * Whether a cell's `◘` marker needs the forced-contrast colour. True when the color is `'default'`
 * (unknown, possibly dark background), when it can't be resolved to RGB (malformed — force contrast
 * rather than risk an invisible marker), or when its relative luminance is below
 * {@link NEAR_BLACK_LUMA}.
 *
 * @param color The cell's color.
 * @returns Whether the marker should use the forced-contrast colour.
 */
export function isNearBlack(color: Color): boolean {
  let rgb: { r: number; g: number; b: number } | null;
  try {
    rgb = toRgb(color);
  } catch {
    return true; // malformed → force contrast rather than risk an invisible marker
  }
  if (rgb === null) return true; // 'default' — unknown background, assume it could be dark
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance < NEAR_BLACK_LUMA;
}
