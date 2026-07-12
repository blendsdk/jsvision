/**
 * Specification test (immutable oracle) — `mountCellOverlay`. It mounts a view at a cell rect
 * translated to absolute coordinates, focuses it through the loop seam, and returns a disposer that
 * removes the view and tears down its reactive scope (so no editor effects leak after the overlay
 * closes).
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, View, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { mountCellOverlay } from '../src/overlay.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A trivial view that records when its reactive scope is torn down. */
class Probe extends View {
  cleaned = false;
  constructor() {
    super();
    this.onMount(() => {
      this.onCleanup(() => {
        this.cleaned = true;
      });
    });
  }
  draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('staticText'));
  }
}

// ST-9 — mount at the translated rect, focus once, and dispose removes + disposes the reactive scope.
test('should mount a view at the translated rect, focus it, and dispose it on dispose()', () => {
  const host = new Group();
  const render = createRenderRoot({ width: 20, height: 6 }, { caps });
  render.mount(host); // host is now live, so an added child mounts under its scope

  const focusedViews: View[] = [];
  const loop = { focusView: (v: View) => focusedViews.push(v) };

  const view = new Probe();
  const dispose = mountCellOverlay({
    host,
    loop,
    rect: { x: 2, y: 1, width: 6, height: 1 },
    origin: { x: 0, y: 0 },
    view,
  });
  render.flush(); // run the pending layout so the view's onMount (and its onCleanup) registers

  expect(host.children).toContain(view);
  expect(view.layout).toEqual({ position: 'absolute', rect: { x: 2, y: 1, width: 6, height: 1 } });
  expect(focusedViews).toEqual([view]); // focused exactly once
  expect(view.mounted).toBe(true);

  dispose();
  expect(host.children).not.toContain(view); // removed from the host
  expect(view.cleaned).toBe(true); // its reactive scope was disposed (onCleanup fired)
  expect(view.mounted).toBe(false);
});

// ST-9 — the translation adds the body origin to the body-local cell rect.
test('should translate the body-local rect by the body origin', () => {
  const host = new Group();
  const render = createRenderRoot({ width: 20, height: 6 }, { caps });
  render.mount(host);
  const loop = { focusView: () => undefined };

  const view = new Probe();
  mountCellOverlay({ host, loop, rect: { x: 3, y: 2, width: 4, height: 1 }, origin: { x: 10, y: 1 }, view });
  expect(view.layout).toEqual({ position: 'absolute', rect: { x: 13, y: 3, width: 4, height: 1 } });
});
