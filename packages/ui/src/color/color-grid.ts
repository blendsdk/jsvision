/**
 * `color-grid.ts` — pure, view-free geometry + navigation math for the RD-21 `ColorSwatch` (PA-4).
 * Split out of `color-swatch.ts` (mirroring `calendar-grid.ts`) so the hit/nav math is unit-testable
 * in isolation and the view stays lean. No reactivity, no drawing; every index is bounds-checked.
 *
 * ## TV decode (GATE-1 — `TColorSelector`, `colorsel.cpp:120-237`, `tvtext1.cpp:88`)
 *   • **Cell geometry** — `moveChar(j*3, icon, c, 3)` (`:131`): each color is a **3-column** block of
 *     `icon = '\xDB'` (`█` U+2588) at view column `j*3`. Generalized grid width = `columns * 3`.
 *   • **Grid shape** — TV is a fixed 4×4 (16 colors / 4 cols); generalized `cols = max(1, columns)`,
 *     `rows = ceil(n / cols)`.
 *   • **Mouse hit** — `color = mouse.y*4 + mouse.x/3` (`:170`): the cell under a view-local point is
 *     `localY*cols + floor(localX/3)`. A pointer **outside the view** reverts to the pre-drag cell
 *     (`else color = oldColor`, `:172-173`) — encoded here as the discriminated `'outside'` result;
 *     an in-rect point past the last cell of a partial final row (a generic-palette case TV's fixed
 *     grid never hits) is `'overshoot'` → the caller clamps to `n-1` (PA-10).
 *   • **Wrap-around nav** — `handleEvent` `:196-217`, `width = 4`, `maxCol = 15` (fg). Generalized
 *     `width = columns`, `maxCol = n-1`:
 *       kbLeft:  `c>0 ? c-1 : maxCol`
 *       kbRight: `c<maxCol ? c+1 : 0`
 *       kbUp:    `c>width-1 ? c-width : (c==0 ? maxCol : c + maxCol-width)`
 *       kbDown:  `c<maxCol-(width-1) ? c+width : (c==maxCol ? 0 : c - (maxCol-width))`
 *   • **`0x70` line pre-fill / marker** — see `color-swatch.ts` (draw-time facts); the near-black
 *     predicate {@link isNearBlack} decides when the `◘` marker needs the forced-contrast role (PA-2,
 *     the generic extension of TV's exact `c==0` rule).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { toRgb } from '@jsvision/core';
import type { Color } from '@jsvision/core';

/** The width in columns of one color cell (`moveChar(j*3, icon, c, 3)`, `colorsel.cpp:131`). */
export const CELL_WIDTH = 3;

/**
 * Relative luminance below which a cell's `◘` marker needs the forced-contrast role (PA-2). A knocked-
 * out `◘` shows the black cell background through its circle, so a near-black cell hides it. `~24/255`
 * subsumes TV's exact `c==0` (black) case and covers any very-dark truecolor cell.
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
 * The cell under a view-local point (PA-10): a real cell index, or `'overshoot'` (inside the grid rect
 * but past the last cell of a partial row → the caller clamps to `n-1`), or `'outside'` (beyond the
 * grid rect → the caller reverts to the pre-drag cell). The two null-like cases are DISCRIMINATED so
 * the swatch's revert-vs-clamp branch (AC-5) cannot conflate them.
 */
export function hitCell(localX: number, localY: number, n: number, columns: number): number | 'overshoot' | 'outside' {
  if (!insideGrid(localX, localY, n, columns)) return 'outside';
  const { cols } = gridDims(n, columns);
  const idx = localY * cols + Math.floor(localX / CELL_WIDTH); // colorsel.cpp:170  color = y*4 + x/3
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
 * Wrap-around nav left (`colorsel.cpp:182-187`); `n ≤ 1` is a no-op (no infinite wrap, AC-14).
 * `_columns` is unused (±1 needs no row width) but kept so all four nav fns share one signature.
 */
export function navLeft(cur: number, n: number, _columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  return cur > 0 ? cur - 1 : maxCol;
}

/** Wrap-around nav right (`colorsel.cpp:189-194`); `n ≤ 1` is a no-op. `_columns` unused (see navLeft). */
export function navRight(cur: number, n: number, _columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  return cur < maxCol ? cur + 1 : 0;
}

/** Wrap-around nav up (`colorsel.cpp:196-203`); `n ≤ 1` is a no-op. */
export function navUp(cur: number, n: number, columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  const width = Math.max(1, Math.floor(columns));
  if (cur > width - 1) return cur - width;
  if (cur === 0) return maxCol;
  return cur + maxCol - width;
}

/** Wrap-around nav down (`colorsel.cpp:205-212`); `n ≤ 1` is a no-op. */
export function navDown(cur: number, n: number, columns: number): number {
  if (n <= 1) return cur;
  const maxCol = n - 1;
  const width = Math.max(1, Math.floor(columns));
  if (cur < maxCol - (width - 1)) return cur + width;
  if (cur === maxCol) return 0;
  return cur - (maxCol - width);
}

/**
 * Near-black predicate (PA-2): true when a cell's `◘` marker needs the forced-contrast `colorMarker`
 * role. `toRgb(color)` is `null` (`'default'`) — treat as near-black — or throws (malformed) — treat
 * as near-black too (safe default; the marker is drawn on a validated cell, so this is belt-and-braces)
 * — or its relative luminance is below {@link NEAR_BLACK_LUMA}.
 *
 * @param color The cell's color.
 * @returns Whether the marker should use the forced-contrast role.
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
