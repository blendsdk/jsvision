/**
 * Specification tests (immutable oracles) — what `mountCellOverlay` does to a caller's own layout.
 *
 * `mountCellOverlay` is part of the public surface and is reachable indirectly through the grid's
 * `filterPopup` customization seam, so the view it mounts is routinely one the caller built and
 * configured. Its handling of that view's pre-set layout is a two-sided contract, and only half of
 * it had coverage before this file:
 *
 * - The layout is **replaced**, never merged. Padding, a stacking direction, a flow size — anything
 *   the caller set is gone after the mount.
 * - The caller's chosen **size** is nonetheless honored, but only when the pre-set layout is a
 *   complete absolute placement (`position: 'absolute'` *and* a `rect`). A partial or non-absolute
 *   layout falls back to the passed cell rect's size.
 *
 * The position is always recomputed from the host origin with viewport clamping, so a caller's
 * `x`/`y` never survives — these tests assert the host-local origin, not the caller's.
 */
import { test, expect } from 'vitest';
import { Group, View, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { mountCellOverlay } from '../src/overlay.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A trivial mountable view. */
class Probe extends View {
  draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('staticText'));
  }
}

/** A live host at the screen origin, so the translation subtracts zero and rects stay readable. */
function liveHost(): { host: Group; render: ReturnType<typeof createRenderRoot> } {
  const host = new Group();
  const render = createRenderRoot({ width: 40, height: 10 }, { caps });
  render.mount(host);
  return { host, render };
}

const loop = { focusView: (): void => undefined };

// ST-W7 (leg 1) — a complete absolute pre-layout: extras discarded, the caller's size carried over.
test('ST-W7: a caller absolute layout keeps its size but loses every other property', () => {
  const { host, render } = liveHost();
  const view = new Probe();
  view.layout = {
    padding: 1,
    direction: 'col',
    position: 'absolute',
    rect: { x: 99, y: 99, width: 30, height: 5 },
  };

  mountCellOverlay({
    host,
    loop,
    rect: { x: 2, y: 1, width: 6, height: 1 },
    origin: { x: 0, y: 0 },
    view,
  });
  render.flush();

  // Exactly the two properties the mount writes — `padding` and `direction` are both gone.
  expect(view.layout).toEqual({ position: 'absolute', rect: { x: 2, y: 1, width: 30, height: 5 } });
  // Non-vacuity: the view really mounted, so the descriptor above belongs to a live child.
  expect(host.children).toContain(view);
});

// ST-W7 (leg 2) — no absolute placement: the caller's size is NOT honored; the passed rect wins.
test('ST-W7: a caller layout without an absolute placement loses its size too', () => {
  const { host, render } = liveHost();
  const view = new Probe();
  view.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };

  mountCellOverlay({
    host,
    loop,
    rect: { x: 3, y: 2, width: 6, height: 1 },
    origin: { x: 0, y: 0 },
    view,
  });
  render.flush();

  expect(view.layout).toEqual({ position: 'absolute', rect: { x: 3, y: 2, width: 6, height: 1 } });
  expect(host.children).toContain(view);
});
