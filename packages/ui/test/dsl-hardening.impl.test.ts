/**
 * Implementation tests — internals and edge cases of the hardened layout builders that the spec
 * oracles do not pin: the `Flex.grow` object-vs-number resolution, explicit-size precedence, and the
 * falsy-child edges (empty results, a props object followed by falsy children).
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, createRenderRoot } from '../src/view/index.js';
import { col, row, grow, fixed, stack, place, topRight, at, cover, center } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — only layout props / child identity / solved bounds are under test here
  }
}

/** A render root over a deferred scheduler, so a test can drive the draw-time repositioning frames. */
function harness(width: number, height: number) {
  let pending: (() => void) | null = null;
  const render = createRenderRoot(
    { width, height },
    {
      caps,
      schedule: (f): void => {
        pending = f;
      },
    },
  );
  const drain = (): void => {
    let n = 0;
    while (pending !== null) {
      const run = pending;
      pending = null;
      run();
      if (++n > 50) throw new Error('layout did not converge');
    }
  };
  return { render, drain };
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
  v.setLayout({ direction: 'col', gap: 2 });
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

// --- at() overload dispatch: the numeric and rect forms are interchangeable ----------------------

test('at() numeric and rect forms produce an identical layout', () => {
  const p = new Leaf();
  const q = new Leaf();
  at(p, 5, 6, 7, 8);
  at(q, { x: 5, y: 6, width: 7, height: 8 });
  expect(p.layout).toEqual(q.layout);
  expect(p.layout).toEqual({ position: 'absolute', rect: { x: 5, y: 6, width: 7, height: 8 } });
});

test('at() merges over multiple prior layout props and overwrites a prior position', () => {
  const v = new Leaf();
  v.setLayout({ direction: 'row', gap: 2, position: 'fill' });
  at(v, 1, 1, 4, 4);
  expect(v.layout.direction).toBe('row'); // preserved
  expect(v.layout.gap).toBe(2); // preserved
  expect(v.layout.position).toBe('absolute'); // overwritten fill → absolute
  expect(v.layout.rect).toEqual({ x: 1, y: 1, width: 4, height: 4 });
});

// --- cover() / center() merge over prior props ---------------------------------------------------

test('cover() overwrites a prior absolute position with fill while preserving other props', () => {
  const v = new Leaf();
  v.setLayout({ direction: 'col', position: 'absolute', rect: { x: 1, y: 2, width: 3, height: 4 } });
  cover(v);
  expect(v.layout.position).toBe('fill');
  expect(v.layout.direction).toBe('col'); // preserved
});

test('center() preserves prior props and sets the centered flag alongside the absolute rect', () => {
  const v = new Leaf();
  v.setLayout({ direction: 'col', gap: 1 });
  center(v, 30, 10);
  expect(v.layout.direction).toBe('col'); // preserved
  expect(v.layout.gap).toBe(1); // preserved
  expect(v.layout.position).toBe('absolute');
  expect(v.layout.rect).toEqual({ x: 0, y: 0, width: 30, height: 10 });
  expect(v.centered).toBe(true);
});

// --- placement offsets & dev-warn edges ----------------------------------------------------------

test('an offset on a fill axis is ignored (the fill spans the whole extent)', () => {
  const v = new Leaf();
  // Vertical is fill (v omitted) with a vOffset that must be ignored; horizontal is a centered fixed 4.
  const s = stack(place(v, { h: 'center', width: 4, vOffset: 5 }));
  const { render, drain } = harness(20, 10);
  render.mount(s);
  drain();
  expect(v.bounds.y).toBe(0); // fill axis: the offset is ignored, the box spans from 0
  expect(v.bounds.height).toBe(10); // …and fills the whole content height
});

test('a positive start-anchored offset insets the layer toward the interior', () => {
  const v = new Leaf();
  const s = stack(place(v, { h: 'start', width: 4, hOffset: 3, v: 'start', height: 2, vOffset: 1 }));
  const { render, drain } = harness(20, 10);
  render.mount(s);
  drain();
  expect(v.bounds.x).toBe(3); // 0 + 3 (away from the left edge)
  expect(v.bounds.y).toBe(1); // 0 + 1 (away from the top edge)
});

test('a corner tagger wired into a stack() does not warn', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const badge = new Leaf();
    stack(topRight(badge, 4, 1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});
