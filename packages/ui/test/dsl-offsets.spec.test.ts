/**
 * Specification tests (immutable oracles) — stack placement offsets (S5) and the orphaned-tagger
 * dev-warning (S3).
 *
 * A `Placement` may carry `hOffset`/`vOffset`: a positive offset insets the layer *away from its
 * anchored edge* (down/right for `start`/`center`, up/left for `end`), then the box is clamped to
 * stay within the content box. The corner/edge draw-time repositioning is driven through a deferred
 * scheduler + `drain()` (one frame = lag-free paths; two = a corner settle). And a placement tagger
 * whose view is never adopted by a `stack()` emits a development warning. If one fails after
 * implementation, the implementation is wrong.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import { createRenderRoot } from '../src/view/index.js';
import { stack, place } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — only solved bounds are under test here
  }
}

/** A render root over a deferred scheduler, so the test drives every frame to convergence. */
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
  return { render, drain };
}

// A vOffset insets a bottom-anchored layer up by the offset (one cell above the bottom edge).
test('a vOffset shifts a bottom-anchored layer up by the offset', () => {
  const v = new Leaf();
  const s = stack(place(v, { v: 'end', vOffset: 1, height: 2 }));
  const { render, drain } = harness(20, 10);
  render.mount(s);
  drain();
  expect(v.bounds.y).toBe(7); // 10 - 2 - 1 — one cell above the bottom
});

// An offset that would push the box out of the content box is clamped to stay inside it.
test('a vOffset that would overflow is clamped within the content box', () => {
  const v = new Leaf();
  const s = stack(place(v, { v: 'end', vOffset: 99, height: 2 }));
  const { render, drain } = harness(20, 10);
  render.mount(s);
  drain();
  expect(v.bounds.y).toBeGreaterThanOrEqual(0);
  expect(v.bounds.y).toBeLessThanOrEqual(8); // never below 0, never past extent - size (10 - 2)
});

// A placement tagger whose view is never added to a stack() warns; the same tag inside a stack() does not.
test('an orphaned placement tagger warns; the same tag inside a stack() does not', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // Orphan: place() on a view never added to a stack.
    const orphan = new Leaf();
    place(orphan, { h: 'center', width: 4 });

    // Adopted: the same kind of tag, but wired into a stack().
    const adopted = new Leaf();
    stack(place(adopted, { h: 'center', width: 4 }));

    // Let the queued one-shot checks run (they are scheduled on the microtask queue).
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Exactly the orphan warned — the adopted one did not.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('stack()');
  } finally {
    warn.mockRestore();
  }
});
