/**
 * Geometry helpers for the view spine (RD-03, AR-37). Reuses RD-02's public `Rect`/`Size2D`
 * interfaces and adds a `Point` plus the pure clip primitives the `DrawContext` needs. All
 * functions are pure (no mutation), integer-in / integer-out.
 */
import type { Rect } from '../layout/index.js';

/** A point in integer terminal cells. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The overlap of two rects — the clip primitive (a view rect ∩ its ancestor clip). A
 * non-overlapping pair yields a zero-size rect (`width`/`height` clamped to 0), which downstream
 * resolves to clipped no-op draws (AC-17). Never returns negative dimensions.
 *
 * @returns The intersection rect; zero-size when the inputs do not overlap.
 */
export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/**
 * Offset a rect by `(dx, dy)`, keeping its size (e.g. view-local → absolute coordinates).
 *
 * @returns A new translated rect.
 */
export function translate(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, width: r.width, height: r.height };
}

/**
 * Whether a point lies inside a rect, using half-open bounds
 * (`x ≤ p.x < x + width`, `y ≤ p.y < y + height`) so adjacent rects never both contain a cell.
 *
 * @returns `true` when `p` is inside `r`.
 */
export function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}
