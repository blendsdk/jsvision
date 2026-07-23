/**
 * Specification tests (immutable oracles) — the size-`min` floor on the flex builders (S1).
 *
 * Construct real views, assert the `layout.size` token that `grow()` / the `col`/`row` `grow`
 * shorthand set, and lay out with `reflow` to assert the floor reaches the solved bounds. If one
 * fails after implementation, the implementation is wrong.
 */
import { test, expect } from 'vitest';
import { View, reflow } from '../src/view/index.js';
import { row, grow } from '../src/view/index.js';

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — reflow writes bounds; drawing is not under test here
  }
}

// grow() with an explicit min floor carries the min on its fr size token, and returns the view.
test('grow(v, 2, { min: 12 }) sets an fr size of weight 2 with min 12, and returns v', () => {
  const v = new Leaf();
  expect(grow(v, 2, { min: 12 })).toBe(v);
  expect(v.layout.size).toEqual({ kind: 'fr', weight: 2, min: 12 });
});

// The 2-arg grow() is unchanged — an fr token with no min key at all.
test('grow(v, 2) with no options sets fr weight 2 and no min key', () => {
  const v = new Leaf();
  expect(grow(v, 2)).toBe(v);
  expect(v.layout.size).toEqual({ kind: 'fr', weight: 2 });
  expect('min' in (v.layout.size as object)).toBe(false);
});

// The container `grow` shorthand accepts the object form and forwards `min` onto the size token; and
// the floor genuinely binds in the solver, forcing a child above its fair share.
test('the container grow shorthand forwards min, and the floor binds in the solver', () => {
  // Forwarding: { grow: { weight, min } } sets the container's own fr size, carrying the floor.
  expect(row({ grow: { weight: 1, min: 12 } }).layout.size).toEqual({ kind: 'fr', weight: 1, min: 12 });

  // Binding: a's fair share of a 40-cell row is 10 (weights 1:3); its min:20 floor forces it to 20.
  const a = new Leaf();
  const b = new Leaf();
  reflow(row(grow(a, 1, { min: 20 }), grow(b, 3)), { width: 40, height: 1 });
  expect(a.bounds.width).toBe(20); // floored above the fair share of 10
  expect(b.bounds.width).toBe(20); // takes the remainder
  expect(a.bounds.width + b.bounds.width).toBe(40);
});

// Two competing floors that both fit: the min does not bind because the fair share already clears it,
// yet a stays at or above its floor and the row fills exactly.
test('two grow children with a satisfiable floor split the row and honour the floor', () => {
  const a = new Leaf();
  const b = new Leaf();
  reflow(row(grow(a, 1, { min: 12 }), grow(b, 1)), { width: 30, height: 1 });
  expect(a.bounds.width).toBeGreaterThanOrEqual(12);
  expect(a.bounds.width + b.bounds.width).toBe(30);
});

// A negative min is forwarded verbatim (no double-clamp in the DSL); the engine normalizes it to 0
// at solve time without throwing.
test('grow(v, 1, { min: -5 }) forwards the raw min and solves without throwing', () => {
  const v = new Leaf();
  expect(grow(v, 1, { min: -5 }).layout.size).toEqual({ kind: 'fr', weight: 1, min: -5 });
  expect(() => reflow(row(v), { width: 10, height: 1 })).not.toThrow();
});
