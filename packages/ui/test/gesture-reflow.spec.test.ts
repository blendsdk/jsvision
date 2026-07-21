/**
 * Specification test (immutable oracle) — a window drag writes its rect and requests **one** reflow.
 *
 * The write path behind a move gesture is being rewritten: the raw `layout.rect = …` assignment plus
 * its paired `invalidateLayout()` collapse into a single `setLayout({ rect })`. That is meant to be a
 * pure refactor, and this test is what makes "pure" checkable — it pins the two observable effects a
 * caller depends on, independently of how the write is spelled:
 *
 *   1. the window ends up at the dragged rect, and
 *   2. exactly one reflow is requested for one pointer movement.
 *
 * The reflow count is the load-bearing half. A conversion that left the old `invalidateLayout()`
 * behind next to the new `setLayout()` would still move the window correctly and would still pass
 * every existing drag test — it would just quietly ask for two reflows per pointer sample, on the
 * hottest path the window manager has. Counting is the only way that shows up.
 *
 * **Scope, deliberately narrow.** This pins the *move* gesture only. The resize gestures are not the
 * same shape: they run `onResized()` between the write and the reflow to re-pin absolutely-placed
 * children against the new size, and there the second reflow request is required rather than
 * redundant. Do not generalize "exactly one" to them.
 *
 * Reflows are counted by wrapping the window's own `host` seam, which is the public interface a view
 * schedules through (`View.host`, `ViewHost.markRelayout`). A render root's frame counter would not
 * do: it coalesces, and it cannot tell a reflow request from a repaint request.
 *
 * Expectations derive from the documented gesture contract, never from the implementation. `.js` per
 * NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import type { ViewHost, View } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A 1-based SGR mouse event of the given kind at absolute 0-based (x, y). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/**
 * Wrap a view's host so reflow requests can be counted, delegating everything else untouched.
 *
 * The view keeps a real host, so the app behaves exactly as it would unwrapped — this observes the
 * seam rather than replacing it.
 */
function countRelayouts(view: View): { count: () => number; reset: () => void } {
  const real = view.host;
  if (real === null) throw new Error('the view is not mounted, so it has no host to observe');
  let n = 0;
  const counting: ViewHost = {
    markRepaint: (v) => real.markRepaint(v),
    markRelayout: () => {
      n += 1;
      real.markRelayout();
    },
    ...(real.healFocus !== undefined ? { healFocus: (g: View): void => real.healFocus?.(g) } : {}),
  };
  view.host = counting;
  return { count: () => n, reset: () => (n = 0) };
}

// ST-9 — one pointer sample during a title drag moves the window and asks for one reflow.
test('ST-9: a move gesture writes the dragged rect and requests exactly one reflow', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const w = new Window('W');
  w.setLayout({ rect: { x: 5, y: 2, width: 12, height: 5 } });
  app.desktop.addWindow(w);
  app.loop.renderRoot.flush();

  const relayouts = countRelayouts(w);

  // Grab the title at window-local (6,0) → abs (11,2). The grab itself may legitimately reflow (a
  // centered window commits its placement here), so only the drag sample is counted.
  app.loop.dispatch(mouse('down', 11, 2));
  relayouts.reset();

  app.loop.dispatch(mouse('drag', 15, 5)); // Δ(4,3)

  expect(w.layout.rect).toEqual({ x: 9, y: 5, width: 12, height: 5 });
  expect(relayouts.count()).toBe(1);

  app.loop.dispatch(mouse('up', 15, 5));
});

// ST-9 — the count is per sample, not per gesture: a drag is many samples and each asks once.
test('ST-9: each pointer sample of a drag requests one reflow, not an accumulating batch', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const w = new Window('W');
  w.setLayout({ rect: { x: 5, y: 2, width: 12, height: 5 } });
  app.desktop.addWindow(w);
  app.loop.renderRoot.flush();

  const relayouts = countRelayouts(w);
  app.loop.dispatch(mouse('down', 11, 2));
  relayouts.reset();

  for (const [x, y] of [
    [12, 3],
    [13, 4],
    [14, 4],
  ] as const) {
    app.loop.dispatch(mouse('drag', x, y));
  }

  expect(relayouts.count()).toBe(3);
  expect(w.layout.rect).toEqual({ x: 8, y: 4, width: 12, height: 5 }); // grab offset (6,0) preserved
  app.loop.dispatch(mouse('up', 14, 4));
});
