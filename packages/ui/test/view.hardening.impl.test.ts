/**
 * Implementation tests — view / render-root hardening (RD-13, HR-12).
 *
 * Edge coverage beyond ST-3.c: a chain of nested onMount adds (child → grandchild →
 * great-grandchild) all lay out and paint once the flushes settle.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

class PaintLeaf extends View {
  draws = 0;
  draw(_ctx: DrawContext): void {
    this.draws += 1;
  }
}

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
      queue.shift()?.();
      guard += 1;
    }
  };
  return { rr, drain };
}

test('a chain of nested onMount adds all lay out and paint', () => {
  const greatGrand = new PaintLeaf();
  greatGrand.layout = { size: { kind: 'fixed', cells: 1 } };

  const grand = new Group();
  grand.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };
  grand.onMount(() => grand.add(greatGrand));

  const child = new Group();
  child.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };
  child.onMount(() => child.add(grand));

  const root = new Group();
  root.layout = { direction: 'col' };
  root.add(child);

  const { rr, drain } = scheduledRoot(10, 6);
  rr.mount(root);
  drain();

  expect(grand.bounds.height).toBeGreaterThan(0);
  expect(greatGrand.bounds.height).toBeGreaterThan(0);
  expect(greatGrand.draws).toBeGreaterThan(0);
});
