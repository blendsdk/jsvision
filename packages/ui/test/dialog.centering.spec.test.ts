/**
 * Specification tests — Dialog auto-centering (the TV `ofCentered` port).
 *
 * Immutable oracles derived from the Turbo Vision contract, NOT the implementation:
 *   - `ofCentered = ofCenterX | ofCenterY = 0x300` (views.h:86-88).
 *   - `TGroup::insertBefore` centers a flagged view within its owner (tgroup.cpp:393-397):
 *       `origin.x = (size.x - p.size.x)/2; origin.y = (size.y - p.size.y)/2` (integer division).
 * A modern-default extension of TV: a `Dialog` given a size but no explicit `rect` position centers
 * by default (every TV system dialog — file/change-dir/help/color — sets `ofCentered`). An explicit
 * `rect` is honored verbatim; `centered` overrides either way. Real `View`/render root. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { Dialog } from '../src/dialog/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Mount `root` in a `w`×`h` viewport and flush one frame so bounds are laid out. */
function mountIn(root: View, w: number, h: number) {
  const rr = createRenderRoot({ width: w, height: h }, { caps });
  rr.mount(root);
  return rr;
}

/** A minimal absolute leaf that paints nothing — for the view-level centering oracle. */
class Blank extends View {
  override draw(_ctx: DrawContext): void {
    /* no-op */
  }
}

// The TV ofCentered formula (tgroup.cpp:395-397): a sized, unplaced Dialog centers in the viewport.
test('a Dialog given a size (no rect) centers by default: origin = (viewport - size)/2', () => {
  const dlg = new Dialog({ title: 'Centered', width: 10, height: 4 });
  const root = new Group();
  root.add(dlg);
  mountIn(root, 40, 12);
  // (40-10)/2 = 15 ; (12-4)/2 = 4
  expect(dlg.bounds.x).toBe(15);
  expect(dlg.bounds.y).toBe(4);
  expect(dlg.bounds.width).toBe(10);
  expect(dlg.bounds.height).toBe(4);
});

// An explicit rect is a manual placement — honored verbatim, NOT centered (back-compat default).
test('a Dialog given an explicit rect is honored verbatim (not centered by default)', () => {
  const dlg = new Dialog({ title: 'Placed', rect: { x: 2, y: 1, width: 10, height: 4 } });
  const root = new Group();
  root.add(dlg);
  mountIn(root, 40, 12);
  expect(dlg.bounds.x).toBe(2);
  expect(dlg.bounds.y).toBe(1);
});

// `centered: false` opts a sized dialog out of the default centering (stays at the origin).
test('centered:false keeps a sized dialog at the top-left origin (opt-out)', () => {
  const dlg = new Dialog({ title: 'TopLeft', width: 10, height: 4, centered: false });
  const root = new Group();
  root.add(dlg);
  mountIn(root, 40, 12);
  expect(dlg.bounds.x).toBe(0);
  expect(dlg.bounds.y).toBe(0);
});

// `centered: true` overrides an explicit rect's position (size kept, origin recomputed).
test('centered:true recomputes the origin even when an explicit rect is given', () => {
  const dlg = new Dialog({ title: 'Forced', rect: { x: 30, y: 8, width: 10, height: 4 }, centered: true });
  const root = new Group();
  root.add(dlg);
  mountIn(root, 40, 12);
  expect(dlg.bounds.x).toBe(15);
  expect(dlg.bounds.y).toBe(4);
});

// The underlying mechanism is a general View flag (the ofCentered port), not Dialog-specific: any
// absolute view with `centered = true` centers within its parent group.
test('the `centered` View flag centers any absolute view within its parent (ofCentered port)', () => {
  const v = new Blank();
  v.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 6, height: 2 } };
  v.centered = true;
  const root = new Group();
  root.add(v);
  mountIn(root, 20, 10);
  // (20-6)/2 = 7 ; (10-2)/2 = 4
  expect(v.bounds.x).toBe(7);
  expect(v.bounds.y).toBe(4);
});
