/**
 * `growRect` — the Turbo Vision `growMode` edge-anchoring math, a faithful port of
 * `TView::calcBounds` (`source/tvision/tview.cpp:134-158`) and its `grow`/`fitToLimits` helpers
 * (`:117-132`). Used by the resizable file dialogs to reposition each child when the dialog grows.
 *
 * TV decode (GATE-1):
 *   • `growMode` flags (`include/tvision/views.h:93-98`): `gfGrowLoX=0x01` (left edge follows),
 *     `gfGrowLoY=0x02` (top), `gfGrowHiX=0x04` (right), `gfGrowHiY=0x08` (bottom), `gfGrowAll=0x0f`.
 *     `gfGrowRel=0x10` (proportional, for zoom) is NOT modelled — no file-dialog child uses it.
 *   • `calcBounds` moves each flagged edge by the owner's per-axis size delta `d`
 *     (`grow(i){ i += d }`, `:130`), then `fitToLimits` clamps the extent to `[0, owner.size]`
 *     (`sizeLimits` → `min=0`, `max=owner.size` for a non-`gfFixed` view, `:829-836`).
 *   • TV rects are `TRect{a, b}` half-open (`b` exclusive); our {@link Rect} is
 *     `{x, y, width, height}`, so `a.x = x`, `b.x = x + width`.
 *
 * Pure: no view/DOM/reactive access. `.js` per NodeNext.
 */
import type { Rect } from '@jsvision/ui';

/** Turbo Vision `growMode` bit flags (`views.h:93-98`). */
export const GrowMode = {
  /** The left edge follows the owner's width change (`gfGrowLoX`). */
  LoX: 0x01,
  /** The top edge follows the owner's height change (`gfGrowLoY`). */
  LoY: 0x02,
  /** The right edge follows the owner's width change (`gfGrowHiX`). */
  HiX: 0x04,
  /** The bottom edge follows the owner's height change (`gfGrowHiY`). */
  HiY: 0x08,
  /** All four edges follow (`gfGrowAll`). */
  All: 0x0f,
} as const;

/** Clamp `n` to `[lo, hi]`. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Reposition `base` for an owner that grew by `(deltaW, deltaH)` cells, moving each edge selected by
 * `growMode` (TV `TView::calcBounds`). Grow-only in practice (the file dialogs pin their minimum to
 * the design size), but negative deltas are handled by the same edge math + extent clamp.
 *
 * @param base     The child's design-size rect (owner-relative, `padding:0`).
 * @param growMode The OR of {@link GrowMode} flags governing which edges follow.
 * @param deltaW   The owner's width change (new − design), in cells.
 * @param deltaH   The owner's height change, in cells.
 * @param ownerW   The owner's current width (the extent clamp ceiling, TV `sizeLimits` max).
 * @param ownerH   The owner's current height.
 * @returns A fresh repositioned `Rect` (never mutates `base`).
 */
export function growRect(
  base: Rect,
  growMode: number,
  deltaW: number,
  deltaH: number,
  ownerW: number,
  ownerH: number,
): Rect {
  // Work in half-open {a, b} edge space (TV), b exclusive.
  let ax = base.x;
  let bx = base.x + base.width;
  let ay = base.y;
  let by = base.y + base.height;

  // grow(): each flagged edge moves by the owner's per-axis delta (non-gfGrowRel ⇒ `i += d`).
  if (growMode & GrowMode.LoX) ax += deltaW;
  if (growMode & GrowMode.HiX) bx += deltaW;
  if (growMode & GrowMode.LoY) ay += deltaH;
  if (growMode & GrowMode.HiY) by += deltaH;

  // fitToLimits: clamp the extent to [0, owner.size] (min=0, max=owner.size); the origin is preserved.
  const width = clamp(bx - ax, 0, ownerW);
  const height = clamp(by - ay, 0, ownerH);
  return { x: ax, y: ay, width, height };
}
