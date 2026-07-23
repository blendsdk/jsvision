/**
 * Implementation tests — the base Dialog's construction-time `layout` DESCRIPTOR shape.
 *
 * `dialog.centering.spec` asserts the resolved *bounds* after a reflow; this pins the raw `layout`
 * object the constructor emits — specifically that `padding:1` survives and the `centered` flag
 * tracks the three branches (sized+unplaced, explicit rect, explicit override). It guards the
 * self-placement expressed through the layout DSL: the builders must reproduce the exact descriptor,
 * dropping no field (the `padding` is the easy one to lose). Real Dialog, no mount
 * (construction-time state). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { Dialog } from '../src/dialog/index.js';

test('a sized, unplaced Dialog emits {position:absolute, padding:1, rect:{0,0,w,h}} and centered=true', () => {
  const dlg = new Dialog({ title: 'Sized', width: 30, height: 10 });
  expect(dlg.layout).toEqual({ position: 'absolute', padding: 1, rect: { x: 0, y: 0, width: 30, height: 10 } });
  expect(dlg.centered).toBe(true);
});

test('an explicit-rect Dialog keeps padding:1, honors the rect, and is not centered', () => {
  const dlg = new Dialog({ title: 'Placed', rect: { x: 2, y: 1, width: 20, height: 8 } });
  expect(dlg.layout).toEqual({ position: 'absolute', padding: 1, rect: { x: 2, y: 1, width: 20, height: 8 } });
  expect(dlg.centered).toBe(false);
});

test('centered:false on a sized Dialog keeps padding:1 and clears the centering flag (opt-out)', () => {
  const dlg = new Dialog({ title: 'Opt-out', width: 30, height: 10, centered: false });
  expect(dlg.layout).toEqual({ position: 'absolute', padding: 1, rect: { x: 0, y: 0, width: 30, height: 10 } });
  expect(dlg.centered).toBe(false);
});

test('centered:true with an explicit rect keeps the rect in layout and sets the flag (override)', () => {
  const dlg = new Dialog({ title: 'Override', rect: { x: 30, y: 8, width: 20, height: 8 }, centered: true });
  expect(dlg.layout).toEqual({ position: 'absolute', padding: 1, rect: { x: 30, y: 8, width: 20, height: 8 } });
  expect(dlg.centered).toBe(true);
});
