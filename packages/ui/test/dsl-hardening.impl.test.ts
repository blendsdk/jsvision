/**
 * Implementation tests — internals and edge cases of the hardened layout builders that the spec
 * oracles do not pin: the `Flex.grow` object-vs-number resolution, explicit-size precedence, and the
 * falsy-child edges (empty results, a props object followed by falsy children).
 */
import { test, expect } from 'vitest';
import { View } from '../src/view/index.js';
import { col, row, grow, fixed, stack } from '../src/view/index.js';

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — only layout props / child identity are under test here
  }
}

// --- Flex.grow shorthand: number vs { weight, min } ----------------------------------------------

test('the container grow shorthand resolves the bare-number form to a min-less fr size', () => {
  expect(col({ grow: 3 }).layout.size).toEqual({ kind: 'fr', weight: 3 });
  expect('min' in (col({ grow: 3 }).layout.size as object)).toBe(false);
});

test('the container grow shorthand resolves the object form, carrying min when present', () => {
  expect(row({ grow: { weight: 2, min: 4 } }).layout.size).toEqual({ kind: 'fr', weight: 2, min: 4 });
  // Object form without a min → no min key (identical to the bare-number form).
  expect(col({ grow: { weight: 5 } }).layout.size).toEqual({ kind: 'fr', weight: 5 });
  expect('min' in (col({ grow: { weight: 5 } }).layout.size as object)).toBe(false);
});

test('an explicit size still wins over the object grow shorthand', () => {
  expect(col({ size: { kind: 'fixed', cells: 9 }, grow: { weight: 5, min: 3 } }).layout.size).toEqual({
    kind: 'fixed',
    cells: 9,
  });
});

// --- grow() options edges ------------------------------------------------------------------------

test('grow() with an explicit options object omits the min key when min is undefined', () => {
  const v = new Leaf();
  grow(v, 2, {});
  expect(v.layout.size).toEqual({ kind: 'fr', weight: 2 });
  expect('min' in (v.layout.size as object)).toBe(false);
});

test('grow() merges the size over prior layout props rather than replacing them', () => {
  const v = new Leaf();
  v.layout = { direction: 'col', gap: 2 };
  grow(v, 1, { min: 3 });
  expect(v.layout.direction).toBe('col'); // preserved
  expect(v.layout.gap).toBe(2); // preserved
  expect(v.layout.size).toEqual({ kind: 'fr', weight: 1, min: 3 });
});

// --- falsy-child edges ---------------------------------------------------------------------------

test('col/row/stack produce an empty group when every child is falsy', () => {
  expect(col(false, null, undefined).children).toEqual([]);
  expect(row(null).children).toEqual([]);
  expect(stack(false, undefined).children).toEqual([]);
});

test('a props object is still honoured when the children after it are falsy', () => {
  const a = new Leaf();
  const g = col({ gap: 3, background: 'desktop' }, false, fixed(a, 1), null);
  expect(g.children).toEqual([a]);
  expect(g.layout.gap).toBe(3);
  expect(g.background).toBe('desktop');
});

test('a leading falsy value is a skipped child, never consumed as the props object', () => {
  const a = new Leaf();
  // If `false` were mistaken for props, `a` would be the only "real" arg AND the gap would be unset;
  // here we assert `false` is dropped as a child and `a` is kept with the default (no-props) layout.
  const g = row(false, grow(a));
  expect(g.children).toEqual([a]);
  expect(g.layout.direction).toBe('row');
  expect(g.background).toBeUndefined();
});
