/**
 * Implementation / edge tests — the loop-owned multi-click primitive (double-click-activation 03-01).
 *
 * Complements the immutable ST oracles in `event.multiclick.spec.test.ts` with the edge behavior:
 * unbounded count, non-`down` events carrying `undefined`, the capture path, and the `Date.now`
 * default. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent, WheelEvent, KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouse(kind: 'down' | 'up' | 'move' | 'drag', x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}
function wheel(x: number, y: number): WheelEvent {
  return { type: 'wheel', dir: 'down', x, y, shift: false, alt: false, ctrl: false };
}
function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
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

function hosted(clock?: () => number) {
  const leaf = new CountView();
  const root = new Group();
  root.add(leaf);
  const loop = createEventLoop({ width: 20, height: 10 }, clock ? { caps, now: clock } : { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 10 };
  leaf.bounds = { x: 0, y: 0, width: 20, height: 10 };
  return { leaf, loop };
}

// The count wraps naturally past 3 — a 4th same-cell down → clickCount === 4 (no cap; row widgets
// still only act on === 2).
test('clickCount is unbounded past 3', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);
  for (const t of [0, 100, 200, 300]) {
    now = t;
    loop.dispatch(mouse('down', 5, 5));
  }
  expect(leaf.counts).toEqual([1, 2, 3, 4]);
});

// A down between two same-cell downs but on a DIFFERENT cell resets the run (each side counts fresh).
test('a different-cell down resets the run between same-cell downs', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);
  now = 0;
  loop.dispatch(mouse('down', 5, 5)); // 1
  now = 50;
  loop.dispatch(mouse('down', 8, 8)); // 1 (different cell)
  now = 100;
  loop.dispatch(mouse('down', 5, 5)); // 1 (run to (5,5) was broken)
  expect(leaf.counts).toEqual([1, 1, 1]);
});

// Move / drag / up / wheel / key envelopes carry clickCount === undefined (only `down` is stamped),
// and a non-down event never perturbs the running count.
test('non-down events carry undefined and do not perturb the count', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);
  now = 0;
  loop.dispatch(mouse('down', 5, 5)); // 1
  loop.dispatch(mouse('move', 5, 5)); // undefined
  loop.dispatch(mouse('drag', 5, 5)); // undefined
  loop.dispatch(mouse('up', 5, 5)); // undefined
  loop.dispatch(wheel(5, 5)); // undefined
  loop.dispatch(key('a')); // undefined (key routes to focus; leaf isn't focused → not delivered)
  now = 100;
  loop.dispatch(mouse('down', 5, 5)); // 2 — the intervening non-downs didn't reset the run

  expect(leaf.counts[0]).toBe(1);
  expect(leaf.counts[1]).toBeUndefined(); // move
  expect(leaf.counts[2]).toBeUndefined(); // drag
  expect(leaf.counts[3]).toBeUndefined(); // up
  expect(leaf.counts[4]).toBeUndefined(); // wheel
  expect(leaf.counts.at(-1)).toBe(2); // the 2nd down still saw the run continue
});

// A captured target still receives clickCount on its down (the hit-test capture branch spreads it).
test('a captured target receives clickCount on its down', () => {
  let now = 0;
  const { leaf, loop } = hosted(() => now);
  loop.setCapture(leaf); // all mouse events now route straight to the captured leaf

  now = 0;
  loop.dispatch(mouse('down', 5, 5));
  now = 100;
  loop.dispatch(mouse('down', 5, 5));

  expect(leaf.counts).toEqual([1, 2]);
});

// `now` defaults to Date.now when unset — two fast real downs on the same cell read as a double-click.
test('now defaults to Date.now (two fast real same-cell downs → 2)', () => {
  const { leaf, loop } = hosted(); // no injected clock
  loop.dispatch(mouse('down', 4, 4));
  loop.dispatch(mouse('down', 4, 4)); // executes microseconds later — well within 500ms
  expect(leaf.counts).toEqual([1, 2]);
});
