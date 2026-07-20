/**
 * Specification test (immutable oracle) — the `at()` absolute-placement builder
 * as consumed from the `@jsvision/ui` package barrel.
 *
 * Pins the three-part contract the docs-site examples rely on when they place a
 * view absolutely:
 *
 *  - **Placement + identity** — `at(v, x, y, w, h)` writes
 *    `{ position: 'absolute', rect: { x, y, width, height } }` onto `v.layout`
 *    and returns the very same view, so calls chain fluently.
 *  - **Merge, not replace** — layout props the view already carries (direction,
 *    padding, …) survive the call. `at()` layers absolute placement on top of
 *    the existing props; it never wipes them.
 *  - **One reflow** — a single `at()` call notifies the view's host of exactly
 *    one relayout, no more. Counted on the host seam directly, because a frame
 *    counter cannot tell a reflow apart from a mere repaint.
 */
import { test, expect } from 'vitest';
import { at, Group } from '@jsvision/ui';

test('ST-9: at() writes absolute placement onto a bare view and returns it', () => {
  const v = new Group();

  const returned = at(v, 1, 2, 3, 4);

  // Exact equality: a bare Group starts with an empty layout, so the result
  // must be precisely the absolute-placement props and nothing else.
  expect(v.layout).toEqual({
    position: 'absolute',
    rect: { x: 1, y: 2, width: 3, height: 4 },
  });
  // Fluent identity: the builder hands back the same view instance.
  expect(returned).toBe(v);
});

test('ST-10: at() merges with existing layout props instead of replacing them', () => {
  const v = new Group();
  v.layout = { direction: 'col', padding: 1 };

  at(v, 0, 0, 10, 5);

  // The pre-existing props survive alongside the new absolute placement —
  // the builder merges, it does not swap in a fresh object.
  expect(v.layout).toEqual({
    direction: 'col',
    padding: 1,
    position: 'absolute',
    rect: { x: 0, y: 0, width: 10, height: 5 },
  });
});

test('ST-11: at() marks the host for relayout exactly once', () => {
  const v = new Group();
  let relayouts = 0;
  // Minimal host double on the public host seam: only the two mark methods,
  // counting reflow requests (repaint requests are irrelevant here).
  v.host = {
    markRepaint(): void {},
    markRelayout(): void {
      relayouts += 1;
    },
  };

  at(v, 0, 0, 4, 1);

  expect(relayouts).toBe(1);
});
