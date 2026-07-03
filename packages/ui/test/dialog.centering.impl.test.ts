/**
 * Implementation tests — Dialog / `centered` reflow edges.
 *
 * Covers integer-division truncation on odd gaps, an oversized (larger-than-viewport) view, nested
 * centering (a centered view inside a centered parent), re-centering on viewport resize, and the
 * `width`/`height` size path vs. an explicit `rect`. Real `View`/render root. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { Dialog } from '../src/dialog/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

class Blank extends View {
  override draw(_ctx: DrawContext): void {
    /* no-op */
  }
}

function abs(v: View, x: number, y: number, width: number, height: number): void {
  v.layout = { position: 'absolute', rect: { x, y, width, height } };
}

// Odd gap ⇒ integer division truncates toward zero (matches C++ `(size - p.size)/2`).
test('odd gap truncates: a 9-wide view in a 20-wide parent centers at x=5 (trunc(11/2))', () => {
  const v = new Blank();
  abs(v, 0, 0, 9, 3);
  v.centered = true;
  const root = new Group();
  root.add(v);
  createRenderRoot({ width: 20, height: 11 }, { caps }).mount(root);
  expect(v.bounds.x).toBe(5); // trunc((20-9)/2) = trunc(5.5) = 5
  expect(v.bounds.y).toBe(4); // trunc((11-3)/2) = 4
});

// An oversized dialog is not clamped (TV does not clamp) — the origin goes negative, overflowing
// equally on both sides. trunc matches C++ for this pathological case too.
test('an oversized centered view overflows symmetrically (no clamp, TV-faithful)', () => {
  const v = new Blank();
  abs(v, 0, 0, 44, 3);
  v.centered = true;
  const root = new Group();
  root.add(v);
  createRenderRoot({ width: 40, height: 11 }, { caps }).mount(root);
  expect(v.bounds.x).toBe(-2); // trunc((40-44)/2) = -2
});

// A centered view inside a centered parent: only origins move (never sizes), so the child centers
// within the parent's (unchanged) size regardless of the parent's own recentring.
test('nested centering is consistent (child centers within its centered parent)', () => {
  const parent = new Group();
  parent.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 10 } };
  parent.centered = true;
  const child = new Blank();
  abs(child, 0, 0, 6, 2);
  child.centered = true;
  parent.add(child);
  const root = new Group();
  root.add(parent);
  createRenderRoot({ width: 40, height: 20 }, { caps }).mount(root);
  // Parent centers in the 40x20 root: (40-20)/2=10, (20-10)/2=5.
  expect(parent.bounds.x).toBe(10);
  expect(parent.bounds.y).toBe(5);
  // Child centers within the parent's 20x10 (bounds are parent-relative): (20-6)/2=7, (10-2)/2=4.
  expect(child.bounds.x).toBe(7);
  expect(child.bounds.y).toBe(4);
});

// A resize re-runs reflow, so a centered dialog re-centers to the new viewport.
test('a centered dialog re-centers on viewport resize', () => {
  const dlg = new Dialog({ title: 'R', width: 10, height: 4 });
  const root = new Group();
  root.add(dlg);
  const rr = createRenderRoot({ width: 40, height: 12 }, { caps });
  rr.mount(root);
  expect(dlg.bounds.x).toBe(15);
  rr.resize({ width: 60, height: 20 });
  rr.flush(); // resize only schedules a flush; force the reflow so bounds update synchronously
  expect(dlg.bounds.x).toBe(25); // (60-10)/2
  expect(dlg.bounds.y).toBe(8); //  (20-4)/2
});

// The `width`/`height` size path produces the same rect a full rect would (size-wise), just centered.
test('width/height size path sets an absolute rect and centers by default', () => {
  const dlg = new Dialog({ title: 'S', width: 24, height: 8 });
  expect(dlg.centered).toBe(true);
  expect(dlg.layout.rect).toEqual({ x: 0, y: 0, width: 24, height: 8 });
  expect(dlg.layout.position).toBe('absolute');
});
