/**
 * Specification tests (immutable oracles) — Navigation router · Phase 2 keep-alive (ST-14, ST-15).
 *
 * Source: 07-testing-strategy.md ST-14/15 (R-5 / AR-7). By default a screen is disposed when
 * navigated away from and rebuilt fresh on return; `keepAlive: true` keeps it mounted-hidden so its
 * state survives a round-trip (same view instance, not re-built). Expectations derive from the spec.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createRouter } from '../src/router/router.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

type Routes = { list: void; item: { id: number } };

class Screen extends View {
  override focusable = true;
  scroll = 0;
  constructor(readonly label: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

// ST-14 — dispose-on-navigate-away by default: the popped screen is disposed and rebuilt fresh.
test('ST-14: dispose default — navigating away disposes the screen; returning rebuilds it fresh', () => {
  const cleanups: string[] = [];
  const built: Screen[] = [];
  const router = createRouter<Routes>({
    initial: { name: 'list' },
    routes: {
      list: {
        build: () => {
          const v = new Screen('list');
          built.push(v);
          v.onMount(() => v.onCleanup(() => cleanups.push('list')));
          return { view: v };
        },
      },
      item: { build: (ctx) => ({ view: new Screen(`item-${ctx.params.id}`) }) },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);

  const firstList = built[0];
  router.push('item', { id: 1 }); // navigate away from list → disposed (default)
  loop.renderRoot.flush();
  expect(cleanups).toContain('list'); // list's onCleanup fired

  router.back(); // back to list → a fresh rebuild
  const secondList = built[built.length - 1];
  expect(secondList).not.toBe(firstList);
});

// ST-15 — keepAlive keeps a screen warm: its state survives a round-trip (same instance, not rebuilt).
test('ST-15: keepAlive keeps a screen warm — local state survives a push/back round-trip', () => {
  const built: Screen[] = [];
  const router = createRouter<Routes>({
    initial: { name: 'list' },
    routes: {
      list: {
        keepAlive: true,
        build: () => {
          const v = new Screen('list');
          built.push(v);
          return { view: v };
        },
      },
      item: { build: (ctx) => ({ view: new Screen(`item-${ctx.params.id}`) }) },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);

  const list = built[0];
  list.scroll = 5; // mutate local state
  router.push('item', { id: 1 }); // navigate away — kept warm
  loop.renderRoot.flush();
  router.back(); // return to list

  expect(built.length).toBe(1); // build ran once — NOT rebuilt
  expect(built[built.length - 1]).toBe(list); // the same instance
  expect(list.scroll).toBe(5); // state survived
});
