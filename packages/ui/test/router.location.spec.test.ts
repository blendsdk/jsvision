/**
 * Specification tests (immutable oracles) — Navigation router · Phase 1 location + codec (ST-13, ST-18).
 *
 * Source: 07-testing-strategy.md ST-13/ST-18 (R-4 / AR-9). A route's `serialize`/`parse` codec
 * round-trips its params (designed now; `restore()` deferred), and `location()`/`canGoBack()` are
 * reactive accessors — an effect reading them re-runs on navigation. Expectations derive from the spec.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createRoot, effect } from '../src/reactive/index.js';
import { createRouter } from '../src/router/router.js';
import type { Route } from '../src/router/types.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

type Routes = { home: void; detail: { id: number } };

class Screen extends View {
  constructor(readonly label: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

function makeRouter() {
  const router = createRouter<Routes>({
    initial: { name: 'home' },
    routes: {
      home: { build: () => ({ view: new Screen('home') }) },
      detail: { build: (ctx) => ({ view: new Screen(`d${ctx.params.id}`) }) },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);
  return router;
}

// ST-13 — a route's serialize/parse codec round-trips its params (no restore() asserted).
test('ST-13: a route serialize/parse codec round-trips its params', () => {
  const detail: Route<{ id: number }> = {
    build: (ctx) => ({ view: new Screen(`d${ctx.params.id}`) }),
    serialize: (p) => `id=${p.id}`,
    parse: (s) => ({ id: Number(new URLSearchParams(s).get('id')) }),
  };
  const params = { id: 42 };
  expect(detail.parse!(detail.serialize!(params))).toEqual(params);
});

// ST-18 — location()/canGoBack() are reactive: an effect re-runs on push/back.
test('ST-18: location() and canGoBack() are reactive accessors, not snapshots', () => {
  const router = makeRouter();
  const names: string[] = [];
  const backable: boolean[] = [];
  let dispose = (): void => {};
  createRoot((d) => {
    dispose = d;
    effect(() => names.push(String(router.location().name)));
    effect(() => backable.push(router.canGoBack()));
  });

  expect(names).toEqual(['home']); // effects run once on creation
  expect(backable).toEqual([false]);

  router.push('detail', { id: 1 });
  expect(names).toEqual(['home', 'detail']); // re-ran on push
  expect(backable).toEqual([false, true]); // depth crossed 1

  router.back();
  expect(names).toEqual(['home', 'detail', 'home']); // re-ran on back
  expect(backable).toEqual([false, true, false]);

  dispose();
});
