/**
 * Specification tests (immutable oracles) — Navigation router · Phase 1 params (ST-10, ST-11).
 *
 * Source: 07-testing-strategy.md ST-10/11 (R-2 / AR-8, AR-14). Per-route params flow through `build`
 * and `location()` unchanged and are typed by the `createRouter<Routes>` generic (wrong types are
 * compile errors); a structured `initial` can carry params. Expectations derive from the spec.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createRouter } from '../src/router/router.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

type Routes = { home: void; detail: { id: number }; settings: void };

class Screen extends View {
  override focusable = true;
  constructor(readonly label: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

// ST-10 — params reach build's ctx.params unchanged and location().params; wrong types are type errors.
test('ST-10: params flow to build + location() and are typed by the generic', () => {
  const seen: number[] = [];
  const router = createRouter<Routes>({
    initial: { name: 'home' },
    routes: {
      home: { build: () => ({ view: new Screen('home') }) },
      detail: {
        build: (ctx) => {
          seen.push(ctx.params.id);
          return { view: new Screen(`d${ctx.params.id}`) };
        },
      },
      settings: { build: () => ({ view: new Screen('s') }) },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);

  router.push('detail', { id: 7 });
  expect(seen).toEqual([7]);
  expect(router.location().params).toEqual({ id: 7 });

  // Compile-time type safety (these lines must NOT typecheck):
  // @ts-expect-error id must be a number, not a string
  router.push('detail', { id: 'nope' });
  // @ts-expect-error 'unknown' is not a declared route
  router.push('unknown');
});

// ST-11 — a structured initial route builds the initial screen with its params.
test('ST-11: a structured initial route carries params into the initial build', () => {
  let seenId = -1;
  const router = createRouter<Routes>({
    initial: { name: 'detail', params: { id: 99 } },
    routes: {
      home: { build: () => ({ view: new Screen('home') }) },
      detail: {
        build: (ctx) => {
          seenId = ctx.params.id;
          return { view: new Screen(`d${ctx.params.id}`) };
        },
      },
      settings: { build: () => ({ view: new Screen('s') }) },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);

  expect(seenId).toBe(99);
  expect(router.location()).toEqual({ name: 'detail', params: { id: 99 } });
});
