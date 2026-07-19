/**
 * Specification test (immutable oracle) — `col`/`row`/`stack` skip falsy children (S7), so the
 * standard `cond && child` conditional-render idiom composes without a manual `.add()` dance. Only
 * `null`/`undefined`/`false` are skipped; every other argument is a real child kept in order. If it
 * fails after implementation, the implementation is wrong.
 */
import { test, expect } from 'vitest';
import { View } from '../src/view/index.js';
import { col, row, grow, fixed, stack, place } from '../src/view/index.js';

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — only child identity/order is under test here
  }
}

// col/row drop null/undefined/false — even as the first argument — and keep the real children in order.
test('col/row skip null/undefined/false children and keep the real ones in order', () => {
  const a = new Leaf();
  const b = new Leaf();

  // A leading falsy arg is a skipped child, not mistaken for a Flex props object.
  const c = col(false, fixed(a, 1), undefined, grow(b), null);
  expect(c.children).toEqual([a, b]);

  const r = row(null, grow(a), false, fixed(b, 2));
  expect(r.children).toEqual([a, b]);
});

// stack drops the same falsy layers and keeps the real ones in order.
test('stack skips null/undefined/false layers and keeps the real ones in order', () => {
  const canvas = new Leaf();
  const badge = new Leaf();
  const s = stack(false, canvas, undefined, place(badge, { h: 'end', v: 'start', width: 4, height: 1 }), null);
  expect(s.children).toEqual([canvas, badge]);
});
