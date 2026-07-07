/**
 * Specification tests (immutable oracles) — the loop-owned multi-click primitive (double-click-
 * activation FR-1/FR-2, AR-1/AR-2/AR-3/AR-4/AR-13).
 *
 * The UI event loop computes a consecutive same-cell click-count on each mouse-`down` and stamps it
 * on the dispatch envelope as `DispatchEvent.clickCount`, over an injectable clock
 * (`EventLoopOptions.now`, default `Date.now`). A leaf records `ev.clickCount` in `onEvent`, so the
 * assertions observe exactly what a view receives — proving both the compute (ST-1/ST-3/ST-4) and the
 * `route()`/`hit-test` spread propagation (ST-2). Expectations derive from the FR/AR, never from the
 * implementation. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A 1-based SGR mouse-down at (x, y). */
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

/** Records the `clickCount` of every envelope it receives. */
class CountView extends View {
  readonly counts: Array<number | undefined> = [];
  draw(ctx: DrawContext): void {
    ctx.fill('x');
  }
  override onEvent(ev: DispatchEvent): void {
    this.counts.push(ev.clickCount);
  }
}

/** Mount a full-viewport CountView under a root and return the leaf + a clock-controllable loop. */
function hosted(clock: () => number) {
  const leaf = new CountView();
  const root = new Group();
  root.add(leaf);
  const loop = createEventLoop({ width: 20, height: 10 }, { caps, now: clock });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 10 };
  leaf.bounds = { x: 0, y: 0, width: 20, height: 10 };
  return { leaf, loop };
}

// ST-1 / FR-1+FR-2 — same-cell downs within 500ms increment the count: t=0 → 1, t=100 → 2, t=150 → 3.
test('ST-1: consecutive same-cell downs within the window increment clickCount', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);

  now = 0;
  loop.dispatch(mouseDown(5, 5));
  now = 100;
  loop.dispatch(mouseDown(5, 5));
  now = 150;
  loop.dispatch(mouseDown(5, 5));

  expect(leaf.counts).toEqual([1, 2, 3]);
});

// ST-2 / FR-1+AR-13 — the stamped clickCount PROPAGATES to the delivered envelope through the
// route()/hit-test spread chain (the leaf's onEvent sees 2 on the 2nd same-cell down).
test('ST-2: clickCount propagates through the spread chain to the view', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);

  now = 0;
  loop.dispatch(mouseDown(3, 3));
  now = 200;
  loop.dispatch(mouseDown(3, 3));

  expect(leaf.counts[1]).toBe(2); // the view actually received clickCount === 2
});

// ST-3 / FR-2 (reset by time) — a same-cell down after the 500ms window resets to 1.
test('ST-3: a same-cell down after the window resets clickCount to 1', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);

  now = 0;
  loop.dispatch(mouseDown(5, 5));
  now = 600; // > 500ms
  loop.dispatch(mouseDown(5, 5));

  expect(leaf.counts).toEqual([1, 1]);
});

// ST-4 / FR-2 (reset by cell) — a down on a different cell within the window resets to 1.
test('ST-4: a down on a different cell resets clickCount to 1', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);

  now = 0;
  loop.dispatch(mouseDown(5, 5));
  now = 100;
  loop.dispatch(mouseDown(5, 6)); // same window, different cell

  expect(leaf.counts).toEqual([1, 1]);
});
