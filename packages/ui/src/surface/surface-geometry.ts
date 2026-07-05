/**
 * `surface-geometry.ts` — pure, view-free clip / margin / clamp math for the RD-19 `SurfaceView`
 * (PA-7). Split out of `surface-view.ts` (mirroring `color-grid.ts`/`calendar-grid.ts`) so the
 * `delta`-viewport geometry is unit-testable against the `tsurface.cpp` decode without a render root.
 * No reactivity, no drawing; every value is integer and bounds-clamped — no array indexing here.
 *
 * ## TV decode (GATE-1 — `TSurfaceView::draw()`, `source/tvision/tsurface.cpp:93-141`)
 *   • **Clip rect** (`:105-107`): `TRect(TPoint(), surface->size).move(-delta.x, -delta.y).intersect(
 *     TRect(TPoint(), size))` — the view-local rectangle the surface is drawn into. {@link computeClip}
 *     expresses it as `{x,y,width,height}`.
 *   • **Non-empty guard** (`:108-109`): `0 <= clip.a.x < clip.b.x && 0 <= clip.a.y < clip.b.y`. When it
 *     fails the surface is fully outside the viewport → TV draws nothing (stale cells). jsvision maps an
 *     empty clip (`width≤0||height≤0`) to the null-surface case: the caller fills the whole view with the
 *     empty-area colour (PA-3, a safe deterministic extension).
 *   • **Margin bands** (`:118-132`): `writeLine` top rows `[0, clip.a.y)` + bottom rows `[clip.b.y,
 *     size.y)` full width, then per surface row the left `[0, clip.a.x)` + right `[clip.b.x, size.x)`
 *     side bands, all filled with spaces in `mapColor(1)`. {@link marginRects} returns them in that fill
 *     order, omitting zero-area bands (so `clip == extent` → `[]`, the direct-copy case).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Point } from '../view/geometry.js';
import type { Rect } from '../layout/index.js';

// `Point` (`{x,y}`) and `Rect` (`{x,y,width,height}`) are reused from the view/layout public types —
// they are already re-exported from the `@jsvision/ui` barrel, so no duplicate is defined here (PA-13).

/** A canonical empty clip — returned when the surface is fully outside the viewport (PA-3). */
const EMPTY_CLIP: Rect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * The view-local clip rectangle where the surface is drawn — the faithful
 * `TRect(0,0,surface.size).move(-delta).intersect(viewExtent)` (`tsurface.cpp:105-107`), expressed as
 * `{x,y,width,height}`. An **empty** result (`width ≤ 0 || height ≤ 0`, returned canonically as
 * `{0,0,0,0}`) means the surface is fully outside the viewport (TV's non-empty guard failing,
 * `:108-109`): the caller fills the whole view with the empty-area colour (PA-3).
 *
 * @param surface The surface size `{x: width, y: height}`.
 * @param delta   The scroll offset `{x, y}` (may be negative → surface inset into the view interior).
 * @param view    The viewport size `{x: width, y: height}`.
 * @returns The view-local clip rect, or the canonical empty rect when nothing is visible.
 */
export function computeClip(surface: Point, delta: Point, view: Point): Rect {
  // move(-delta): a = (-delta.x, -delta.y), b = (surface - delta); ∩ extent (0,0)..(view):
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
 * The empty-area margin rects (view-local) NOT covered by `clip`, in TV fill order
 * (`tsurface.cpp:118-132`): top band, bottom band, then the left & right side bands within the
 * surface rows. Zero-area bands are omitted, so a `clip` that fills the whole view returns `[]`
 * (the direct-copy case, no margins). The caller fills each rect with a space in `windowInactive`.
 *
 * @param clip The surface clip rect (from {@link computeClip}); assumed non-empty.
 * @param view The viewport size `{x: width, y: height}`.
 * @returns The margin rects to blank, in fill order; `[]` when the surface fills the view.
 */
export function marginRects(clip: Rect, view: Point): Rect[] {
  const out: Rect[] = [];
  const clipBottom = clip.y + clip.height;
  const clipRight = clip.x + clip.width;
  // Top band — full-width rows above the surface (:120).
  if (clip.y > 0) out.push({ x: 0, y: 0, width: view.x, height: clip.y });
  // Bottom band — full-width rows below the surface (:121).
  if (view.y - clipBottom > 0) out.push({ x: 0, y: clipBottom, width: view.x, height: view.y - clipBottom });
  // Left side band — within the surface rows (:127-132).
  if (clip.x > 0) out.push({ x: 0, y: clip.y, width: clip.x, height: clip.height });
  // Right side band — within the surface rows (:127-132).
  if (view.x - clipRight > 0) out.push({ x: clipRight, y: clip.y, width: view.x - clipRight, height: clip.height });
  return out;
}

/**
 * Clamp a scroll `delta` to `[0, max(0, surface − view)]` per axis (the Should-Have `scrollTo`/`panBy`
 * clamp, PA-9): a negative delta clamps up to 0, an over-range delta clamps down so the surface's far
 * edge stops at the viewport edge. A surface smaller than the view on an axis pins that axis to 0. The
 * raw (unclamped, TV-faithful) `delta.set` stays available for callers that want the full range.
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
