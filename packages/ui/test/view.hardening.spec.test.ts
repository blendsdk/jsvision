/**
 * Specification tests (immutable oracles) — view / render-root hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-12 + PA-12, plan docs 03-05-view-render.md and
 * 07-testing-strategy.md (ST-3.c). `flush()` must snapshot-and-clear its pending-work flags BEFORE
 * doing the work, so an invalidation raised during reflow/compose (e.g. an `onMount` that adds a
 * child, or a `draw()` that invalidates a sibling) is scheduled for the NEXT tick instead of being
 * clobbered. Expectations derive from the RD/PA, never from the implementation.
 *
 * Later hardening phases append ST-6.d–h to this file.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A leaf that counts how many times it was painted. */
class PaintLeaf extends View {
  draws = 0;
  draw(_ctx: DrawContext): void {
    this.draws += 1;
  }
}

/** A synchronous scheduler seam: collects flush callbacks so the test can drain them deterministically. */
function scheduledRoot(
  width: number,
  height: number,
): {
  rr: ReturnType<typeof createRenderRoot>;
  drain: () => void;
} {
  const queue: Array<() => void> = [];
  const rr = createRenderRoot({ width, height }, { caps, schedule: (f) => queue.push(f) });
  const drain = (): void => {
    let guard = 0;
    while (queue.length > 0 && guard < 100) {
      const f = queue.shift();
      f?.();
      guard += 1;
    }
  };
  return { rr, drain };
}

// ST-3.c — a deferred-mount grandchild (added from an onMount during reflow) gets non-degenerate
// bounds and is painted after the flushes settle (HR-12/PA-12).
test('ST-3.c: an onMount-added grandchild lays out and paints after the flushes settle', () => {
  const grandchild = new PaintLeaf();
  grandchild.layout = { size: { kind: 'fixed', cells: 1 } };

  const child = new Group();
  child.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };
  child.onMount(() => child.add(grandchild)); // structural add mid-flush (the documented bind() site)

  const root = new Group();
  root.layout = { direction: 'col' };
  root.add(child);

  const { rr, drain } = scheduledRoot(10, 5);
  rr.mount(root); // first flush (internal); the onMount add schedules the next tick
  drain(); // settle the follow-up flush

  expect(grandchild.bounds.width).toBeGreaterThan(0); // laid out, not left at {0,0,0,0}
  expect(grandchild.bounds.height).toBeGreaterThan(0);
  expect(grandchild.draws).toBeGreaterThan(0); // painted
});

// ST-3.c — a draw() that invalidates a sibling causes the sibling to recompose on the next scheduled
// flush (the mid-compose invalidation is not dropped) (HR-12/PA-12).
test('ST-3.c: a mid-compose sibling invalidation recomposes on the next scheduled flush', () => {
  const sibling = new PaintLeaf();
  sibling.layout = { size: { kind: 'fr', weight: 1 } };

  let invalidatedOnce = false;
  class Invalidator extends PaintLeaf {
    override draw(ctx: DrawContext): void {
      super.draw(ctx);
      if (!invalidatedOnce) {
        invalidatedOnce = true;
        sibling.invalidate(); // invalidate a sibling DURING compose
      }
    }
  }
  const invalidator = new Invalidator();
  invalidator.layout = { size: { kind: 'fr', weight: 1 } };

  const root = new Group();
  root.layout = { direction: 'col' };
  root.add(invalidator);
  root.add(sibling);

  const { rr, drain } = scheduledRoot(10, 4);
  rr.mount(root); // full compose paints both once; the sibling invalidation schedules the next tick
  const siblingDrawsAfterMount = sibling.draws;
  drain(); // settle: the sibling recomposes on the scheduled flush

  expect(sibling.draws).toBeGreaterThan(siblingDrawsAfterMount); // not dropped — recomposed
});
