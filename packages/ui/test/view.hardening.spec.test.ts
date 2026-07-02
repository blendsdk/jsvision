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
import { resolveCapabilities, ScreenBuffer, defaultTheme } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { makeDrawContext } from '../src/view/draw-context.js';
import { naturalSize } from '../src/layout/measure.js';
import type { LayoutBox } from '../src/layout/index.js';
import { signal, effect, runWithOwner, getOwner, createRoot } from '../src/reactive/index.js';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';

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

// ---------------------------------------------------------------------------
// ST-6.d–h — view/render-root minors (HR-30/31/32/33/34)
// ---------------------------------------------------------------------------

const capsU = resolveCapabilities({ env: {}, platform: 'linux', override: { unicode: { utf8: true } } }).profile;

// ST-6.d — the draw-context centers a CJK box title by display width and composes combining marks (HR-30).
test('ST-6.d: draw-context box centers CJK by width; text composes combining marks', () => {
  const buf = new ScreenBuffer(12, 3, { fg: 'default', bg: 'default' });
  const rect = { x: 0, y: 0, width: 12, height: 3 };
  const ctx = makeDrawContext(buf, rect, rect, defaultTheme);
  ctx.box(0, 0, 12, 3, undefined, '世界'); // interior 10, label " 世界 " width 6 → tx = 3
  expect(buf.get(4, 0)?.char).toBe('世');
  expect(buf.get(6, 0)?.char).toBe('界');

  ctx.text(0, 1, 'éx'); // e + U+0301 + x
  expect(buf.get(0, 1)?.char).toBe('é'); // mark composed, not dropped
  expect(buf.get(1, 1)?.char).toBe('x'); // x in the next cell (no column drift)
});

// ST-6.e — flipping state.visible with only invalidate() makes the view disappear then reappear (HR-31/PA-8).
test('ST-6.e: a visibility flip via invalidate() repaints both directions', () => {
  class FillLeaf extends View {
    draw(ctx: DrawContext): void {
      ctx.fill('x');
    }
  }
  const queue: Array<() => void> = [];
  const rr = createRenderRoot({ width: 6, height: 3 }, { caps: capsU, schedule: (f) => queue.push(f) });
  const drain = (): void => {
    let guard = 0;
    while (queue.length > 0 && guard < 100) {
      queue.shift()?.();
      guard += 1;
    }
  };

  const leaf = new FillLeaf();
  leaf.layout = { size: { kind: 'fr', weight: 1 } };
  const group = new Group();
  group.background = 'window'; // fills its rect so a hidden leaf's cells clear to spaces
  group.layout = { direction: 'col' };
  group.add(leaf);
  rr.mount(group);
  drain();
  expect(rr.buffer().get(0, 0)?.char).toBe('x'); // visible

  leaf.state.visible = false;
  leaf.invalidate();
  drain();
  expect(rr.buffer().get(0, 0)?.char).toBe(' '); // disappeared

  leaf.state.visible = true;
  leaf.invalidate();
  drain();
  expect(rr.buffer().get(0, 0)?.char).toBe('x'); // reappeared
});

// ST-6.f — view.onCleanup registered inside a reactive body fires exactly once, at unmount (HR-32).
test('ST-6.f: view.onCleanup binds to the view scope, firing once at unmount', () => {
  class Leaf extends View {
    draw(_ctx: DrawContext): void {}
  }
  const leaf = new Leaf();
  createRoot(() => leaf.mount(null, getOwner()));

  const sig = signal(0);
  let fires = 0;
  let registered = false;
  runWithOwner(leaf.scope, () =>
    effect(() => {
      sig(); // subscribe so the body re-runs on set
      if (!registered) {
        registered = true;
        leaf.onCleanup(() => {
          fires += 1;
        });
      }
    }),
  );
  sig.set(1);
  sig.set(2);
  sig.set(3); // three re-runs of the reactive body
  expect(fires).toBe(0); // HR-32: did NOT fire on any re-run (bound to the view scope, not the effect)

  leaf.unmount();
  expect(fires).toBe(1); // fires exactly once, at unmount
});

// ST-6.g — an `auto` container's naturalSize ignores absolute children (HR-33).
test('ST-6.g: naturalSize excludes absolute children', () => {
  const flowChild: LayoutBox = { props: { size: { kind: 'fixed', cells: 3 } }, children: [] };
  const absChild: LayoutBox = {
    props: { position: 'absolute', rect: { x: 0, y: 0, width: 100, height: 100 }, size: { kind: 'fixed', cells: 100 } },
    children: [],
  };
  const container: LayoutBox = { props: { direction: 'row' }, children: [flowChild, absChild] };
  const size = naturalSize(container, { width: 200, height: 200 });
  expect(size.width).toBe(3); // only the flow child contributes (not 3 + 100)
});

// ST-6.h — invalidating a back window preserves a front window's drop-shadow overhang (HR-34/PA-16).
test('ST-6.h: a partial recompose preserves an overlapping shadow', () => {
  const app = createApplication({ caps: capsU, viewport: { width: 24, height: 8 } });
  const back = new Window('Back');
  back.layout.rect = { x: 10, y: 1, width: 12, height: 5 };
  app.desktop.addWindow(back); // added first → lower z
  const front = new Window('Front');
  front.layout.rect = { x: 2, y: 1, width: 8, height: 5 };
  app.desktop.addWindow(front); // added last → raised; its right shadow (cols 10–11) falls on `back`
  app.loop.renderRoot.flush();

  const snapshot = (): string => {
    const buf = app.loop.renderRoot.buffer();
    const cells: string[] = [];
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 24; x += 1) {
        const c = buf.get(x, y);
        cells.push(`${c?.char ?? ''}|${c?.fg ?? ''}|${c?.bg ?? ''}`);
      }
    }
    return cells.join(',');
  };

  const before = snapshot();
  back.invalidate(); // partial recompose of the back subtree only
  app.loop.renderRoot.flush();
  const after = snapshot();
  expect(after).toBe(before); // the front's shadow on the back survives (HR-34 escalates to full recompose)
});
