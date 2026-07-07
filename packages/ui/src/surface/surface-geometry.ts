/**
 * Pure, view-free clip / margin / clamp math for {@link SurfaceView}. No reactivity, no drawing; every
 * value is integer and bounds-clamped. Given the surface size, the scroll offset, and the viewport
 * size, it computes where the surface lands in the view, which empty-area bands surround it, and how to
 * clamp a scroll offset so the surface stays in view.
 */
import type { Point } from '../view/geometry.js';
import type { Rect } from '../layout/index.js';

// `Point` (`{x,y}`) and `Rect` (`{x,y,width,height}`) are reused from the view/layout public types,
// which are already re-exported from the `@jsvision/ui` barrel, so no duplicate is defined here.

/** A canonical empty clip — returned when the surface is fully outside the viewport. */
const EMPTY_CLIP: Rect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * The view-local clip rectangle where the visible part of the surface is drawn: the surface rect,
 * shifted by the negated scroll offset, intersected with the viewport. An **empty** result
 * (`width ≤ 0 || height ≤ 0`, returned canonically as `{0,0,0,0}`) means the surface is fully outside
 * the viewport; the caller then fills the whole view with the empty-area colour.
 *
 * @param surface The surface size `{x: width, y: height}`.
 * @param delta   The scroll offset `{x, y}` (may be negative → surface inset into the view interior).
 * @param view    The viewport size `{x: width, y: height}`.
 * @returns The view-local clip rect, or the canonical empty rect when nothing is visible.
 */
export function computeClip(surface: Point, delta: Point, view: Point): Rect {
  // Shift the surface rect by -delta, then intersect with the viewport (0,0)..(view):
  const ax = Math.max(0, -delta.x);
  const ay = Math.max(0, -delta.y);
  const bx = Math.min(surface.x - delta.x, view.x);
  const by = Math.min(surface.y - delta.y, view.y);
  const width = bx - ax;
  const height = by - ay;
  if (width <= 0 || height <= 0) return { ...EMPTY_CLIP };
  return { x: ax, y: ay, width, height };
}

/**
 * The empty-area margin rects (view-local) NOT covered by `clip`, in fill order: top band, bottom
 * band, then the left and right side bands within the surface rows. Zero-area bands are omitted, so a
 * `clip` that fills the whole view returns `[]` (nothing to blank). The caller fills each rect with a
 * space in the empty-area colour.
 *
 * @param clip The surface clip rect (from {@link computeClip}); assumed non-empty.
 * @param view The viewport size `{x: width, y: height}`.
 * @returns The margin rects to blank, in fill order; `[]` when the surface fills the view.
 */
export function marginRects(clip: Rect, view: Point): Rect[] {
  const out: Rect[] = [];
  const clipBottom = clip.y + clip.height;
  const clipRight = clip.x + clip.width;
  // Top band — full-width rows above the surface.
  if (clip.y > 0) out.push({ x: 0, y: 0, width: view.x, height: clip.y });
  // Bottom band — full-width rows below the surface.
  if (view.y - clipBottom > 0) out.push({ x: 0, y: clipBottom, width: view.x, height: view.y - clipBottom });
  // Left side band — within the surface rows only (so it never overlaps the top/bottom bands).
  if (clip.x > 0) out.push({ x: 0, y: clip.y, width: clip.x, height: clip.height });
  // Right side band — within the surface rows only.
  if (view.x - clipRight > 0) out.push({ x: clipRight, y: clip.y, width: view.x - clipRight, height: clip.height });
  return out;
}

/**
 * Clamp a scroll `delta` to `[0, max(0, surface − view)]` per axis: a negative delta clamps up to 0,
 * an over-range delta clamps down so the surface's far edge stops at the viewport edge. A surface
 * smaller than the view on an axis pins that axis to 0. (Writing the `delta` signal directly bypasses
 * this clamp if a caller wants the surface to scroll past the edge.)
 *
 * @param delta   The desired scroll offset `{x, y}`.
 * @param surface The surface size `{x: width, y: height}`.
 * @param view    The viewport size `{x: width, y: height}`.
 * @returns The clamped offset.
 */
export function clampDelta(delta: Point, surface: Point, view: Point): Point {
  const maxX = Math.max(0, surface.x - view.x);
  const maxY = Math.max(0, surface.y - view.y);
  return {
    x: Math.min(Math.max(delta.x, 0), maxX),
    y: Math.min(Math.max(delta.y, 0), maxY),
  };
}
