/**
 * Implementation tests — the `stack`/placement edge cases (written after the spec is green): a stack
 * of only non-fill layers still sizes by its own `fr` share, a corner layer larger than the stack
 * clamps to the box, and re-tagging a view with `place` uses the latest placement.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import { reflow, createRenderRoot } from '../src/view/index.js';
import { col, fixed, stack, centered, topLeft, topRight, place } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

class Leaf extends View {
  draw(): void {}
}

/** Render root over a deferred scheduler; `drain` runs pending frames to convergence. */
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

// A stack whose only layer is a centered (non-fill) box still takes its own fr:1 share in flow.
test('a stack of only non-fill layers sizes by its own fr:1 share', () => {
  const box = new Leaf();
  const s = stack(centered(box, 10, 2));
  const top = new Leaf();
  const root = col(fixed(top, 4), s);

  reflow(root, { width: 20, height: 20 });

  expect(s.bounds).toEqual({ x: 0, y: 4, width: 20, height: 16 }); // fr:1 fills below the fixed top
  expect(box.bounds.x).toBe(5); // centered horizontally in 20
  expect(box.bounds.y).toBe(7); // centered vertically in 16 → (16-2)/2
});

// A corner layer larger than the stack clamps its size to the box (never a negative origin).
test('a corner layer larger than the stack clamps to the box', () => {
  const badge = new Leaf();
  const s = stack(topRight(badge, 100, 100));
  const { render, drain } = harness(40, 12);
  render.mount(s);
  drain();
  // size clamped to the box, so end-alignment lands at the origin.
  expect(badge.bounds).toEqual({ x: 0, y: 0, width: 40, height: 12 });
});

// Re-tagging a view with `place` uses the latest placement (the WeakMap overwrites).
test('place re-tags a view — the latest placement wins', () => {
  const v = new Leaf();
  place(v, { h: 'center', v: 'center', width: 10, height: 2 }); // first: would be centered
  topLeft(v, 4, 1); // re-tag: now a top-left corner

  const s = stack(v);
  // The corner classification wins: absolute + tracked, not the centered path.
  expect(v.centered).toBe(false);
  expect(v.layout.position).toBe('absolute');

  const { render, drain } = harness(30, 10);
  render.mount(s);
  drain();
  expect(v.bounds).toEqual({ x: 0, y: 0, width: 4, height: 1 }); // pinned top-left
});
