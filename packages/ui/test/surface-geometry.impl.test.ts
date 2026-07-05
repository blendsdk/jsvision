/**
 * Implementation tests — jsvision-ui RD-19 `surface-geometry.ts` edge cases (delta signs/magnitudes,
 * `marginRects` order + degenerate cases, `clampDelta` per-axis edges). Complements the ST oracles in
 * `surface-geometry.spec`. `.js` specifiers required by NodeNext.
 */
import { test, expect } from 'vitest';
import { computeClip, marginRects, clampDelta } from '../src/surface/surface-geometry.js';

const P = (x: number, y: number) => ({ x, y });

test('computeClip — the exact-fit corner: surface == view yields the whole extent', () => {
  expect(computeClip(P(4, 4), P(0, 0), P(4, 4))).toEqual({ x: 0, y: 0, width: 4, height: 4 });
});

test('computeClip — large positive delta short of the edge keeps a partial window', () => {
  // surface {10,10}, delta {8,8}, view {5,5}: only 2×2 remains at the top-left.
  expect(computeClip(P(10, 10), P(8, 8), P(5, 5))).toEqual({ x: 0, y: 0, width: 2, height: 2 });
});

test('computeClip — delta exactly at the far edge → empty', () => {
  // surface {5,5}, delta {5,0}: nothing of the surface remains horizontally.
  const clip = computeClip(P(5, 5), P(5, 0), P(4, 4));
  expect(clip.width <= 0 || clip.height <= 0).toBe(true);
});

test('computeClip — mixed-sign delta (negative x, positive y)', () => {
  // surface {4,10}, delta {-1, 3}, view {6,4}: x inset by 1, y scrolled by 3.
  // x: ax=1, bx=min(4+1,6)=5 → w=4 ; y: ay=0, by=min(10-3,4)=4 → h=4
  expect(computeClip(P(4, 10), P(-1, 3), P(6, 4))).toEqual({ x: 1, y: 0, width: 4, height: 4 });
});

test('marginRects — top + bottom only (surface full width, shorter than view)', () => {
  // clip {0,1,5,2} in view {5,4}: top row 0, bottom rows [3,4); no side bands.
  expect(marginRects({ x: 0, y: 1, width: 5, height: 2 }, P(5, 4))).toEqual([
    { x: 0, y: 0, width: 5, height: 1 }, // top
    { x: 0, y: 3, width: 5, height: 1 }, // bottom
  ]);
});

test('marginRects — empty when clip fills the view (no bands)', () => {
  expect(marginRects({ x: 0, y: 0, width: 7, height: 3 }, P(7, 3))).toEqual([]);
});

test('marginRects — a 1×1 surface centred in a 3×3 view produces all four bands', () => {
  const m = marginRects({ x: 1, y: 1, width: 1, height: 1 }, P(3, 3));
  expect(m).toEqual([
    { x: 0, y: 0, width: 3, height: 1 }, // top
    { x: 0, y: 2, width: 3, height: 1 }, // bottom
    { x: 0, y: 1, width: 1, height: 1 }, // left
    { x: 2, y: 1, width: 1, height: 1 }, // right
  ]);
});

test('clampDelta — clamps each axis independently', () => {
  // x over-range, y in-range: surface {20,10}, view {5,3} → maxX=15, maxY=7.
  expect(clampDelta(P(99, 4), P(20, 10), P(5, 3))).toEqual({ x: 15, y: 4 });
});

test('clampDelta — surface smaller than the view on one axis pins that axis to 0', () => {
  // surface {2,10}, view {5,3}: x pinned to 0 (2<5), y clamps to 7.
  expect(clampDelta(P(3, 99), P(2, 10), P(5, 3))).toEqual({ x: 0, y: 7 });
});

test('clampDelta — a delta already at the far edge is unchanged', () => {
  expect(clampDelta(P(15, 7), P(20, 10), P(5, 3))).toEqual({ x: 15, y: 7 });
});
