/**
 * Specification tests (immutable oracles) — Navigation router · Phase 1 stack ops (ST-7, ST-8, ST-9).
 *
 * Source: 07-testing-strategy.md ST-7/8/9 (R-2, R-4 / AR-3, AR-12). push/back/replace/reset over a
 * mounted router: `location()` reflects the top, `canGoBack()` tracks depth, `back()` at root is a
 * no-op. Expectations derive from the spec, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createRouter } from '../src/router/router.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

type Routes = { home: void; detail: { id: number }; settings: void };

/** A minimal focusable screen that records its label. */
class Screen extends View {
  override focusable = true;
  constructor(readonly label: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

/** Build + mount a router, capturing every screen instance each route built. */
function makeRouter() {
  const built: { home: Screen[]; detail: Screen[]; settings: Screen[] } = { home: [], detail: [], settings: [] };
  const router = createRouter<Routes>({
    initial: { name: 'home' },
    routes: {
      home: {
        build: () => {
          const v = new Screen('home');
          built.home.push(v);
          return { view: v };
        },
      },
      detail: {
        build: (ctx) => {
          const v = new Screen(`detail-${ctx.params.id}`);
          built.detail.push(v);
          return { view: v };
        },
      },
      settings: {
        build: () => {
          const v = new Screen('settings');
          built.settings.push(v);
          return { view: v };
        },
      },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);
  return { router, loop, built };
}

// ST-7 — push flows params into location() and swaps the router body to the new screen.
test('ST-7: push updates location() and shows the new screen (the old one disposed)', () => {
  const { router, built } = makeRouter();
  router.push('detail', { id: 42 });

  expect(router.location()).toEqual({ name: 'detail', params: { id: 42 } });
  const detailView = built.detail[built.detail.length - 1];
  expect(router.children).toContain(detailView); // the detail screen is the visible body
  expect(router.children).not.toContain(built.home[0]); // the initial home screen was disposed
});

// ST-8 — canGoBack + back semantics; back at root is a no-op.
test('ST-8: canGoBack tracks depth; back returns to the prior screen; back at root is a no-op', () => {
  const { router } = makeRouter();
  expect(router.canGoBack()).toBe(false); // at root

  router.push('detail', { id: 1 });
  expect(router.canGoBack()).toBe(true);

  expect(router.back()).toBe(true);
  expect(router.location()).toEqual({ name: 'home', params: undefined });
  expect(router.canGoBack()).toBe(false);

  // back at root: no-op — returns false, state unchanged, no throw.
  expect(router.back()).toBe(false);
  expect(router.location()).toEqual({ name: 'home', params: undefined });
});

// ST-9 — replace swaps the top without changing depth; reset collapses to a single frame.
test('ST-9: replace keeps depth; reset collapses to one frame', () => {
  const { router } = makeRouter();
  router.push('detail', { id: 1 }); // depth 2

  router.replace('settings'); // depth still 2, top is now settings
  expect(router.location()).toEqual({ name: 'settings', params: undefined });
  expect(router.canGoBack()).toBe(true); // home still below

  router.back();
  expect(router.location()).toEqual({ name: 'home', params: undefined });

  router.push('detail', { id: 2 });
  router.reset('home'); // collapse to a single frame
  expect(router.location()).toEqual({ name: 'home', params: undefined });
  expect(router.canGoBack()).toBe(false);
});
