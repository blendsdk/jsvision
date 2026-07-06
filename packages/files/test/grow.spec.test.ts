/**
 * Specification tests (immutable oracle) — the `growRect` edge-anchoring helper (`src/dialog/grow.js`).
 *
 * Derived from the Turbo Vision contract, NOT the implementation — a faithful port of
 * `TView::calcBounds` + the `grow`/`fitToLimits` helpers (`source/tvision/tview.cpp:123-158`):
 *   • `growMode` flags (`views.h:93-98`): `gfGrowLoX=0x01`, `gfGrowLoY=0x02`, `gfGrowHiX=0x04`,
 *     `gfGrowHiY=0x08`, `gfGrowAll=0x0f`.
 *   • For a non-`gfGrowRel` view, `grow(i) => i += d` where `d` is the owner's per-axis size delta;
 *     each flagged edge (`bounds.a`/`bounds.b`) moves by `d` (`:123-132`).
 *   • `fitToLimits` clamps the resulting extent to `[0, owner.size]` (`sizeLimits` gives
 *     `min=0`, `max=owner.size` for a non-`gfFixed` view; `:157-158`, `:829-836`).
 * TV rects are `{a, b}` half-open (`b` exclusive); our `Rect` is `{x, y, width, height}`, so a right
 * edge `b.x = x + width`. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import type { Rect } from '@jsvision/ui';
import { GrowMode, growRect } from '../src/dialog/grow.js';

// A 100×100 owner so the clamp never bites in the grow-only cases below (extents stay < owner).
const OWNER = { width: 100, height: 100 };
const grow = (base: Rect, mode: number, dW: number, dH: number): Rect =>
  growRect(base, mode, dW, dH, OWNER.width, OWNER.height);

// —— The flag constants match TV `views.h:93-98`. ——
test('GrowMode flags mirror the Turbo Vision bit values (views.h:93-98)', () => {
  expect(GrowMode.LoX).toBe(0x01);
  expect(GrowMode.LoY).toBe(0x02);
  expect(GrowMode.HiX).toBe(0x04);
  expect(GrowMode.HiY).toBe(0x08);
  expect(GrowMode.All).toBe(0x0f);
});

// —— growMode 0 ⇒ fixed (a label): no edge moves regardless of delta. ——
test('growMode 0 leaves the rect unchanged (a fixed TLabel)', () => {
  const base = { x: 2, y: 2, width: 6, height: 1 };
  expect(grow(base, 0, 12, 8)).toEqual(base);
});

// —— gfGrowHiX ⇒ only the right edge follows: the rect WIDENS by dW (a TInputLine, tfildlg.cpp:68). ——
test('gfGrowHiX widens the rect by the width delta (fileName input)', () => {
  const base = { x: 3, y: 3, width: 28, height: 1 }; // (3,3)→(31,4)
  expect(grow(base, GrowMode.HiX, 12, 8)).toEqual({ x: 3, y: 3, width: 40, height: 1 });
});

// —— gfGrowLoX|gfGrowHiX ⇒ both x-edges move ⇒ the rect TRANSLATES right, width unchanged
//    (the History icon riding the input's right edge, tfildlg.cpp:76). ——
test('gfGrowLoX|gfGrowHiX translates the rect right by dW, keeping its width (History)', () => {
  const base = { x: 31, y: 3, width: 3, height: 1 }; // (31,3)→(34,4)
  expect(grow(base, GrowMode.LoX | GrowMode.HiX, 12, 8)).toEqual({ x: 43, y: 3, width: 3, height: 1 });
});

// —— gfGrowHiX|gfGrowHiY ⇒ right + bottom edges follow ⇒ grows both ways (the file list, tfildlg.cpp:80). ——
test('gfGrowHiX|gfGrowHiY grows width and height (fileList)', () => {
  const base = { x: 3, y: 6, width: 31, height: 8 }; // (3,6)→(34,14)
  expect(grow(base, GrowMode.HiX | GrowMode.HiY, 12, 8)).toEqual({ x: 3, y: 6, width: 43, height: 16 });
});

// —— buttons: gfGrowLoX|gfGrowHiX ⇒ translate right, pinned to the right edge, width kept
//    (tfildlg.cpp:89). ——
test('gfGrowLoX|gfGrowHiX pins the buttons to the right edge (translate, keep width)', () => {
  const base = { x: 35, y: 3, width: 11, height: 2 };
  expect(grow(base, GrowMode.LoX | GrowMode.HiX, 12, 8)).toEqual({ x: 47, y: 3, width: 11, height: 2 });
});

// —— the info pane: gfGrowAll & ~gfGrowLoX = LoY|HiX|HiY ⇒ left pinned, top follows down, right + bottom
//    grow ⇒ stays flush to the bottom, full inner width (tfildlg.cpp:137). ——
test('gfGrowAll & ~gfGrowLoX keeps the info pane flush at the bottom, full width', () => {
  const base = { x: 1, y: 16, width: 47, height: 2 }; // (1,16)→(48,18)
  const mode = GrowMode.All & ~GrowMode.LoX; // LoY|HiX|HiY = 0x0e
  // dW=12,dH=8: x fixed 1; top 16→24; right 48→60 ⇒ width 59; bottom 18→26 ⇒ height 2.
  expect(grow(base, mode, 12, 8)).toEqual({ x: 1, y: 24, width: 59, height: 2 });
});

// —— the horizontal list scrollbar: gfGrowLoY|gfGrowHiX|gfGrowHiY (tscrlbar.cpp:54) ⇒ translates
//    down with the list bottom, widens with the list. ——
test('gfGrowLoY|gfGrowHiX|gfGrowHiY tracks the list bottom + widens (horizontal scrollbar)', () => {
  const base = { x: 3, y: 14, width: 31, height: 1 }; // (3,14)→(34,15)
  const mode = GrowMode.LoY | GrowMode.HiX | GrowMode.HiY;
  // dW=12,dH=8: x fixed 3; top 14→22; right 34→46 ⇒ width 43; bottom 15→23 ⇒ height 1.
  expect(grow(base, mode, 12, 8)).toEqual({ x: 3, y: 22, width: 43, height: 1 });
});

// —— fitToLimits: an extent is clamped to the owner size (TV sizeLimits max = owner.size). ——
test('fitToLimits clamps a grown extent to the owner size', () => {
  const base = { x: 0, y: 0, width: 40, height: 4 };
  // Widen by 80 ⇒ raw width 120, clamped to owner width 100. Height untouched.
  expect(growRect(base, GrowMode.HiX, 80, 0, 100, 100)).toEqual({ x: 0, y: 0, width: 100, height: 4 });
});
