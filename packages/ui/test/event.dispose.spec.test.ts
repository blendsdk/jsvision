/**
 * Specification tests (immutable oracles) — loop/render-root teardown for a detached host.
 *
 * `run()` restores the terminal and exits the process, so it never needs to unmount the view tree.
 * A long-lived host (the browser `mountApp`) mounts and unmounts many apps in one process, so it
 * must be able to tear an app down without leaking it. These oracles pin that contract:
 *
 *  - `EventLoop.dispose()` unmounts the tree, so every view's `onCleanup` runs (releasing the timers
 *    and subscriptions a view acquired in `onMount`).
 *  - `dispose()` / `RenderRoot.unmount()` are idempotent and safe with nothing mounted.
 *
 * Real `View`s + a real loop-built `RenderRoot` over fixed `caps` — no mocks.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import type { Size2D } from '../src/layout/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/**
 * A leaf that acquires a resource on mount and releases it on cleanup — the shape of an animation
 * driver. It fills its container so the first layout gives it bounds and fires `onMount`.
 */
class ResourceLeaf extends View {
  started = 0;
  cleaned = 0;
  constructor() {
    super();
    this.onMount(() => {
      this.started += 1;
      this.onCleanup(() => {
        this.cleaned += 1;
      });
    });
  }
  override measure(available: Size2D): Size2D {
    return available;
  }
  draw(_ctx: DrawContext): void {}
}

test('ST: loop.dispose() unmounts the tree and fires every view onCleanup', () => {
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  const leaf = new ResourceLeaf();
  loop.mount(leaf);
  expect(leaf.started).toBe(1); // onMount fired after the first layout gave it bounds
  expect(leaf.cleaned).toBe(0);

  loop.dispose();
  expect(leaf.cleaned).toBe(1); // dispose unmounted the tree, firing onCleanup
});

test('ST: loop.dispose() is idempotent — onCleanup fires exactly once', () => {
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  const leaf = new ResourceLeaf();
  loop.mount(leaf);

  loop.dispose();
  expect(() => loop.dispose()).not.toThrow();
  expect(leaf.cleaned).toBe(1); // not fired a second time
});

test('ST: renderRoot.unmount() with nothing mounted is a safe no-op', () => {
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  expect(() => loop.renderRoot.unmount()).not.toThrow();
});
