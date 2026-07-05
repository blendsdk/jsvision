/**
 * Specification tests (immutable oracles) — jsvision-ui RD-19 `surface-geometry.ts` pure clip/margin/
 * clamp math (ST-3 geometry core, feeding ST-3/ST-4/ST-9/AC-3/4/9).
 *
 * Source: RD-19 AC-3/AC-4/AC-9 + the `TSurfaceView::draw()` decode (`source/tvision/tsurface.cpp:
 * 93-141`, GATE-1). `computeClip` is the faithful `TRect(0,0,surface.size).move(-delta).intersect(
 * viewExtent)` (`:105-107`) expressed as `{x,y,width,height}`; an empty result (`width≤0||height≤0`)
 * is TV's non-empty-clip guard failing (`:108-109`) → the caller fills the whole view (PA-3).
 * `marginRects` reproduces the top/bottom `writeLine` bands + the left/right side bands (`:118-132`)
 * in TV fill order. `clampDelta` is the Should-Have scroll clamp `[0, max(0, surface−view)]` (PA-9).
 *
 * Per the immutable-oracle + TV-fidelity rules a failing oracle means the CODE is wrong (and for the
 * clip/margin geometry, wrong vs `tsurface.cpp`). These helpers are pure — no render root needed.
 * The `.js` specifier is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { computeClip, marginRects, clampDelta } from '../src/surface/surface-geometry.js';

const P = (x: number, y: number) => ({ x, y });

// ── computeClip — the faithful move(-delta) ∩ extent (tsurface.cpp:105-107) ─────────────────────

test('ST-3: computeClip — surface exactly fills the view (clip == extent, direct-copy case)', () => {
  // surface {5,3}, delta 0, view {5,3}: clip covers the whole extent → no margins (:112).
  expect(computeClip(P(5, 3), P(0, 0), P(5, 3))).toEqual({ x: 0, y: 0, width: 5, height: 3 });
});

test('ST-3: computeClip — surface larger than the view fills the extent (top-left window)', () => {
  // surface {10,10}, delta 0, view {5,3}: only the top-left 5×3 shows → clip == extent.
  expect(computeClip(P(10, 10), P(0, 0), P(5, 3))).toEqual({ x: 0, y: 0, width: 5, height: 3 });
});

test('ST-3: computeClip — surface smaller than the view (partial: right + bottom margins)', () => {
  // surface {3,2}, delta 0, view {5,3}: surface occupies the top-left 3×2, margins to the right/below.
  expect(computeClip(P(3, 2), P(0, 0), P(5, 3))).toEqual({ x: 0, y: 0, width: 3, height: 2 });
});

test('ST-3: computeClip — positive delta scrolls into the surface interior (clip == extent)', () => {
  // surface {10,10}, delta {2,1}, view {5,3}: first visible cell is surface (2,1); clip fills the view.
  expect(computeClip(P(10, 10), P(2, 1), P(5, 3))).toEqual({ x: 0, y: 0, width: 5, height: 3 });
});

test('ST-3: computeClip — negative delta insets the surface into the view interior', () => {
  // surface {3,2}, delta {-2,-1}, view {8,5}: surface drawn at view (2,1), size 3×2 → top/left/right/bottom margins.
  expect(computeClip(P(3, 2), P(-2, -1), P(8, 5))).toEqual({ x: 2, y: 1, width: 3, height: 2 });
});

test('ST-3: computeClip — negative delta on one axis only (left + right side bands)', () => {
  // surface {3,3}, delta {-1,0}, view {5,3}: surface at view col 1, full height → left/right side bands.
  expect(computeClip(P(3, 3), P(-1, 0), P(5, 3))).toEqual({ x: 1, y: 0, width: 3, height: 3 });
});

test('ST-9: computeClip — surface scrolled fully outside → empty (width ≤ 0), PA-3', () => {
  // delta pushes the whole surface past the right edge: the non-empty guard fails (:108-109).
  const clip = computeClip(P(3, 3), P(5, 0), P(4, 4));
  expect(clip.width <= 0 || clip.height <= 0).toBe(true);
});

test('ST-9: computeClip — surface scrolled fully outside to the left → empty', () => {
  const clip = computeClip(P(3, 3), P(-10, 0), P(5, 3));
  expect(clip.width <= 0 || clip.height <= 0).toBe(true);
});

test('ST-9: computeClip — a zero/degenerate surface yields an empty clip', () => {
  const clip = computeClip(P(0, 0), P(0, 0), P(5, 3));
  expect(clip.width <= 0 || clip.height <= 0).toBe(true);
});

// ── marginRects — the empty-area bands NOT covered by clip (tsurface.cpp:118-132) ────────────────

test('ST-4: marginRects — clip fills the view → no margins ([])', () => {
  expect(marginRects({ x: 0, y: 0, width: 5, height: 3 }, P(5, 3))).toEqual([]);
});

test('ST-4: marginRects — right + bottom bands for a small top-left surface', () => {
  // clip {0,0,3,2} in view {5,3}: bottom band rows [2,3) full width, right band cols [3,5) rows [0,2).
  const m = marginRects({ x: 0, y: 0, width: 3, height: 2 }, P(5, 3));
  expect(m).toEqual([
    { x: 0, y: 2, width: 5, height: 1 }, // bottom band (full width)
    { x: 3, y: 0, width: 2, height: 2 }, // right side band (within surface rows)
  ]);
});

test('ST-4: marginRects — all four bands (TV order: top, bottom, left, right)', () => {
  // clip {2,1,3,2} in view {8,5}: top rows [0,1), bottom rows [3,5), left cols [0,2), right cols [5,8).
  const m = marginRects({ x: 2, y: 1, width: 3, height: 2 }, P(8, 5));
  expect(m).toEqual([
    { x: 0, y: 0, width: 8, height: 1 }, // top band
    { x: 0, y: 3, width: 8, height: 2 }, // bottom band
    { x: 0, y: 1, width: 2, height: 2 }, // left side band
    { x: 5, y: 1, width: 3, height: 2 }, // right side band
  ]);
});

test('ST-4: marginRects — left + right side bands only (surface full height)', () => {
  const m = marginRects({ x: 1, y: 0, width: 3, height: 3 }, P(5, 3));
  expect(m).toEqual([
    { x: 0, y: 0, width: 1, height: 3 }, // left band
    { x: 4, y: 0, width: 1, height: 3 }, // right band
  ]);
});

// ── clampDelta — the Should-Have scroll clamp [0, max(0, surface−view)] (PA-9) ───────────────────

test('ST-3: clampDelta — an in-range delta is unchanged', () => {
  expect(clampDelta(P(3, 2), P(10, 10), P(5, 3))).toEqual({ x: 3, y: 2 });
});

test('ST-3: clampDelta — an over-range delta clamps to (surface − view) per axis', () => {
  expect(clampDelta(P(99, 99), P(10, 10), P(5, 3))).toEqual({ x: 5, y: 7 });
});

test('ST-3: clampDelta — a negative delta clamps up to 0 per axis', () => {
  expect(clampDelta(P(-3, -1), P(10, 10), P(5, 3))).toEqual({ x: 0, y: 0 });
});

test('ST-3: clampDelta — surface ≤ view on both axes → always (0,0)', () => {
  expect(clampDelta(P(2, 1), P(3, 2), P(5, 3))).toEqual({ x: 0, y: 0 });
});
