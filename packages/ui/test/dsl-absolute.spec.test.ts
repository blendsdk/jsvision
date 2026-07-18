/**
 * Specification tests (immutable oracles) — the absolute-placement builder `at()` (+ its out-of-flow
 * behavior as a container child) and the standalone overlay builders `cover()` / `center()`
 * (S2/S4/S3). Construct real views, assert the merge-preserving `layout` props each builder sets, and
 * lay out with `reflow` to assert the out-of-flow guarantee. If one fails after implementation, the
 * implementation is wrong.
 */
import { test, expect } from 'vitest';
import { View, reflow } from '../src/view/index.js';
import { col, fixed, grow, at, cover, center } from '../src/view/index.js';

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — only layout props / solved bounds are under test here
  }
}

// at() positional form sets position:'absolute' + rect, MERGE-preserving prior layout props.
test('at(v, x, y, w, h) sets absolute + rect, preserving prior layout props', () => {
  const v = new Leaf();
  v.layout = { direction: 'col' };
  at(v, 3, 4, 20, 2);
  expect(v.layout).toEqual({ direction: 'col', position: 'absolute', rect: { x: 3, y: 4, width: 20, height: 2 } });
});

// at() rect-overload form is identical to the positional form.
test('at(v, rect) is identical to the positional form', () => {
  const v = new Leaf();
  v.layout = { direction: 'col' };
  at(v, { x: 3, y: 4, width: 20, height: 2 });
  expect(v.layout).toEqual({ direction: 'col', position: 'absolute', rect: { x: 3, y: 4, width: 20, height: 2 } });
});

// An at()-placed child of a col is out of flow: it reserves no flow space, and the flow children
// fill the whole column.
test('an at() child inside a col is out of flow (reserves no flow space)', () => {
  const a = new Leaf();
  const b = new Leaf();
  const c = new Leaf();
  const screen = col(fixed(a, 1), grow(b), at(c, 0, 0, 10, 10));
  reflow(screen, { width: 40, height: 20 });
  expect(a.bounds.height).toBe(1);
  expect(b.bounds.height).toBe(19); // fills the rest of the 20-tall column — c reserves nothing
  expect(a.bounds.height + b.bounds.height).toBe(20);
  expect(c.bounds).toEqual({ x: 0, y: 0, width: 10, height: 10 });
});

// at() returns the same view instance (chainable).
test('at(v, ...) returns the same view', () => {
  const v = new Leaf();
  expect(at(v, 0, 0, 1, 1)).toBe(v);
});

// cover() sets position:'fill', MERGE-preserving prior props, and returns v.
test('cover(v) sets position fill, preserving prior props, and returns v', () => {
  const v = new Leaf();
  v.layout = { direction: 'row', gap: 2 };
  expect(cover(v)).toBe(v);
  expect(v.layout.position).toBe('fill');
  expect(v.layout.direction).toBe('row'); // preserved
  expect(v.layout.gap).toBe(2); // preserved
});

// center() sets an absolute origin rect + View.centered, and returns v.
test('center(v, 40, 12) sets an absolute origin rect and the centered flag', () => {
  const v = new Leaf();
  expect(center(v, 40, 12)).toBe(v);
  expect(v.layout.position).toBe('absolute');
  expect(v.layout.rect).toEqual({ x: 0, y: 0, width: 40, height: 12 });
  expect(v.centered).toBe(true);
});
