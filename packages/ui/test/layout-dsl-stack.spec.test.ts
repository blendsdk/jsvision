/**
 * Specification tests (immutable oracles) — the `stack` z-overlay and its placement helpers.
 *
 * Layers share one box, painted back-to-front. An untagged layer (or an explicit both-axes `fill`)
 * fills the whole content box lag-free; a `centered` fixed box re-centers lag-free; a corner/edge
 * layer self-corrects on draw with a documented one-frame settle that must converge.
 *
 * Frames are driven explicitly through a deferred scheduler + `drain()` (which runs pending frames to
 * convergence and returns how many ran). One frame = the lag-free paths; two = a corner settle. The
 * drain iteration guard throws if a layer never converges, so a runaway reflow loop fails the test.
 * If one fails after implementation, the implementation is wrong.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import { createRenderRoot } from '../src/view/index.js';
import { stack, centered, topRight } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

class Leaf extends View {
  draw(): void {}
}

/** A render root over a deferred scheduler, so the test drives every frame. */
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
  /** Run pending frames until none remain; returns the number of frames run (throws if it never settles). */
  const drain = (): number => {
    let n = 0;
    while (pending !== null) {
      const run = pending;
      pending = null;
      run();
      if (++n > 50) throw new Error('layout did not converge');
    }
    return n;
  };
  return { render, drain, hasPending: (): boolean => pending !== null };
}

// ST-11 — an untagged stack layer fills the whole content box.
test('ST-11: stack(base) at 40×12 → base fills the content box {0,0,40,12}', () => {
  const base = new Leaf();
  const s = stack(base);
  const { render, drain } = harness(40, 12);
  render.mount(s);
  drain();
  expect(base.bounds).toEqual({ x: 0, y: 0, width: 40, height: 12 });
});

// ST-12 — a centered fixed box is centered, and re-centers on resize in a single (lag-free) frame.
test('ST-12: centered(box,20,6) is centered; resize re-centers in one frame (lag-free)', () => {
  const box = new Leaf();
  const s = stack(centered(box, 20, 6));
  const { render, drain } = harness(40, 12);
  render.mount(s);
  drain();
  expect(box.bounds.x).toBe(10); // (40-20)/2
  expect(box.bounds.y).toBe(3); // (12-6)/2

  render.resize({ width: 30, height: 10 });
  const frames = drain();
  expect(frames).toBe(1); // one frame — no settle loop
  expect(box.bounds.x).toBe(5); // (30-20)/2
  expect(box.bounds.y).toBe(2); // (10-6)/2
});

// ST-13 — a top-right corner badge pins to the top-right, re-pins on resize (settle permitted), and
// converges: once settled, no further reflow is scheduled.
test('ST-13: topRight(badge,4,1) pins top-right, re-pins on resize, and converges', () => {
  const badge = new Leaf();
  const s = stack(topRight(badge, 4, 1));
  const { render, drain, hasPending } = harness(40, 12);
  render.mount(s);
  drain();
  expect(badge.bounds.x).toBe(36); // 40 - 4
  expect(badge.bounds.y).toBe(0);
  expect(hasPending()).toBe(false); // settled — no frame left pending

  render.resize({ width: 30, height: 12 });
  const frames = drain();
  expect(badge.bounds.x).toBe(26); // 30 - 4
  expect(frames).toBe(2); // one reflow for the resize + one settle frame
  expect(hasPending()).toBe(false); // converged — the change-gated recompute stopped the loop
});

// ST-14 — a stack fill layer is correct after a single frame following a resize (distinguishes the
// lag-free fill path from the self-correcting corner path).
test('ST-14: a stack fill layer re-solves in a single frame on resize', () => {
  const base = new Leaf();
  const s = stack(base);
  const { render, drain } = harness(40, 12);
  render.mount(s);
  drain();

  render.resize({ width: 24, height: 8 });
  const frames = drain();
  expect(frames).toBe(1); // lag-free — one frame, no settle
  expect(base.bounds).toEqual({ x: 0, y: 0, width: 24, height: 8 });
});
