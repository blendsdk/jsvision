/**
 * Pure geometry helpers for terminal-cell rectangles and points. Reuses the layout engine's
 * `Rect`/`Size2D` shapes and adds a `Point` plus the clip primitives a `DrawContext` needs. Every
 * function is pure (no mutation) and works in integer cell coordinates.
 */
import type { Rect } from '../layout/index.js';

/** A point in integer terminal cells (column `x`, row `y`). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Compute the overlapping region of two rects — the clip operation (a view rect ∩ its ancestor's
 * clip). When the two do not overlap, the result has `width`/`height` of `0` (never negative), which
 * downstream code treats as "draw nothing".
 *
 * @param a First rect.
 * @param b Second rect.
 * @returns The intersection rect; zero-size when the inputs do not overlap.
 * @example
 * import { intersect } from '@jsvision/ui';
 *
 * intersect({ x: 0, y: 0, width: 10, height: 4 }, { x: 5, y: 1, width: 10, height: 10 });
 * // → { x: 5, y: 1, width: 5, height: 3 }
 */
export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/**
 * Offset a rect by `(dx, dy)`, keeping its size — e.g. to convert view-local coordinates to absolute
 * screen coordinates.
 *
 * @param r The rect to move.
 * @param dx Horizontal offset in cells.
 * @param dy Vertical offset in cells.
 * @returns A new translated rect (the input is not mutated).
 * @example
 * import { translate } from '@jsvision/ui';
 *
 * translate({ x: 2, y: 3, width: 8, height: 2 }, 10, 0);
 * // → { x: 12, y: 3, width: 8, height: 2 }
 */
export function translate(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, width: r.width, height: r.height };
}

/**
 * Test whether a point lies inside a rect. Bounds are half-open (`x ≤ p.x < x + width`,
 * `y ≤ p.y < y + height`), so two edge-adjacent rects never both contain the same cell — handy for
 * hit-testing tiled regions.
 *
 * @param r The rect.
 * @param p The point to test.
 * @returns `true` when `p` is inside `r`.
 * @example
 * import { contains } from '@jsvision/ui';
 *
 * const rect = { x: 0, y: 0, width: 4, height: 4 };
 * contains(rect, { x: 3, y: 3 }); // true
 * contains(rect, { x: 4, y: 0 }); // false — right edge is exclusive
 */
export function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}
