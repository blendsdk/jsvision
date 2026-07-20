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
import { naturalSize } from '../src/layout/measure.js';
import type { LayoutBox } from '../src/layout/index.js';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';

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
  greatGrand.setLayout({ size: { kind: 'fixed', cells: 1 } });

  const grand = new Group();
  grand.setLayout({ direction: 'col', size: { kind: 'fr', weight: 1 } });
  grand.onMount(() => grand.add(greatGrand));

  const child = new Group();
  child.setLayout({ direction: 'col', size: { kind: 'fr', weight: 1 } });
  child.onMount(() => child.add(grand));

  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(child);

  const { rr, drain } = scheduledRoot(10, 6);
  rr.mount(root);
  drain();

  expect(grand.bounds.height).toBeGreaterThan(0);
  expect(greatGrand.bounds.height).toBeGreaterThan(0);
  expect(greatGrand.draws).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Phase-6 impl edges: nested naturalSize flow/absolute, shadow at buffer edge (HR-33/34)
// ---------------------------------------------------------------------------

// HR-33: absolute children are excluded from naturalSize at every nesting depth.
test('naturalSize excludes absolute children in a nested container', () => {
  const inner: LayoutBox = {
    props: { direction: 'row' },
    children: [
      { props: { size: { kind: 'fixed', cells: 4 } }, children: [] }, // flow
      {
        props: {
          position: 'absolute',
          rect: { x: 0, y: 0, width: 50, height: 50 },
          size: { kind: 'fixed', cells: 50 },
        },
        children: [],
      }, // absolute
    ],
  };
  const outer: LayoutBox = { props: { direction: 'row' }, children: [inner] };
  const size = naturalSize(outer, { width: 200, height: 200 });
  expect(size.width).toBe(4); // only the inner flow child contributes
});

// HR-34: a shadow-caster flush at the buffer edge (shadow margin clipped) recomposes without crashing.
test('a shadow-margin occlusion check at the viewport edge does not crash', () => {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { unicode: { utf8: true } } }).profile;
  const app = createApplication({ caps, viewport: { width: 12, height: 6 } });
  const w = new Window('Edge');
  w.setLayout({ rect: { x: 10, y: 4, width: 2, height: 2 } }); // flush against the right/bottom edges
  app.desktop.addWindow(w);
  app.loop.renderRoot.flush();
  expect(() => {
    w.invalidate();
    app.loop.renderRoot.flush();
  }).not.toThrow();
});
