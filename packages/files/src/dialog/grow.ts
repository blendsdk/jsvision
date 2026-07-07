/**
 * `growRect` — the edge-anchoring math that keeps a child in place as its container is resized. Each
 * child declares a {@link GrowMode} (which of its four edges should follow the container's growth);
 * this function returns the child's new rectangle after the container changed size. The resizable file
 * dialogs use it to reflow their fields, list, and buttons on a drag-resize.
 *
 * Each flagged edge moves by the container's per-axis size change, then the resulting width/height is
 * clamped into `[0, container size]` so a child can never bleed past the frame. In practice the
 * dialogs only ever grow (they floor their minimum at the design size), but negative deltas work too.
 *
 * Pure — no view, DOM, or reactive access.
 */
import type { Rect } from '@jsvision/ui';

/** Bit flags selecting which edges of a child follow its container's size change. Combine with `|`. */
export const GrowMode = {
  /** The left edge follows the container's width change. */
  LoX: 0x01,
  /** The top edge follows the container's height change. */
  LoY: 0x02,
  /** The right edge follows the container's width change. */
  HiX: 0x04,
  /** The bottom edge follows the container's height change. */
  HiY: 0x08,
  /** All four edges follow. */
  All: 0x0f,
} as const;

/** Clamp `n` to `[lo, hi]`. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Reposition `base` for a container that grew by `(deltaW, deltaH)` cells, moving each edge selected
 * by `growMode`. Grow-only in practice, but negative deltas are handled by the same math and clamp.
 *
 * @param base     The child's design-size rect, relative to the container origin.
 * @param growMode The OR of {@link GrowMode} flags choosing which edges follow.
 * @param deltaW   The container's width change (current − design), in cells.
 * @param deltaH   The container's height change, in cells.
 * @param ownerW   The container's current width (the width clamp ceiling).
 * @param ownerH   The container's current height (the height clamp ceiling).
 * @returns A fresh repositioned rect; `base` is never mutated.
 */
export function growRect(
  base: Rect,
  growMode: number,
  deltaW: number,
  deltaH: number,
  ownerW: number,
  ownerH: number,
): Rect {
  // Work in edge space: track each edge's coordinate (right/bottom are exclusive).
  let ax = base.x;
  let bx = base.x + base.width;
  let ay = base.y;
  let by = base.y + base.height;

  // Move each flagged edge by the container's per-axis size change.
  if (growMode & GrowMode.LoX) ax += deltaW;
  if (growMode & GrowMode.HiX) bx += deltaW;
  if (growMode & GrowMode.LoY) ay += deltaH;
  if (growMode & GrowMode.HiY) by += deltaH;

  // Clamp the resulting extent into [0, container size] so the child never overflows the frame.
  const width = clamp(bx - ax, 0, ownerW);
  const height = clamp(by - ay, 0, ownerH);
  return { x: ax, y: ay, width, height };
}
