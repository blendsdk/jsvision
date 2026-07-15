/**
 * Implementation tests — Navigation router · Phase 1 internals & edges.
 *
 * Covers the pure stack reducers directly (empty/root edges) and router behaviors beyond the ST
 * oracles: replace at root, reset from a deep stack, sequential push/back consistency, fresh rebuild
 * on return (dispose-default), and re-entrant-nav safety (AR-16: discouraged, not guarded — must not
 * crash).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createRouter } from '../src/router/router.js';
import { pushEntry, backEntry, replaceEntry, resetEntry, canGoBack, topEntry } from '../src/router/stack.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

type Routes = { home: void; detail: { id: number }; settings: void };

class Screen extends View {
  override focusable = true;
  constructor(readonly label: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

// --- pure stack reducers ------------------------------------------------------------------------

test('stack: pushEntry/backEntry/replaceEntry/resetEntry are pure and depth-correct', () => {
  const s0 = resetEntry('home', undefined);
  expect(s0).toEqual([{ name: 'home', params: undefined }]);
  expect(canGoBack(s0)).toBe(false);

  const s1 = pushEntry(s0, 'detail', { id: 1 });
  expect(s1.length).toBe(2);
  expect(s0.length).toBe(1); // pushEntry did not mutate the input
  expect(canGoBack(s1)).toBe(true);
  expect(topEntry(s1)).toEqual({ name: 'detail', params: { id: 1 } });

  const s2 = replaceEntry(s1, 'settings', undefined);
  expect(s2.length).toBe(2); // depth unchanged
  expect(topEntry(s2)).toEqual({ name: 'settings', params: undefined });

  const s3 = backEntry(s2);
  expect(s3.length).toBe(1);
  expect(topEntry(s3)).toEqual({ name: 'home', params: undefined });
});

test('stack: backEntry at the root returns a copy (no pop); topEntry on empty throws', () => {
  const root = resetEntry('home', undefined);
  const backed = backEntry(root);
  expect(backed).toEqual(root);
  expect(backed).not.toBe(root); // a fresh copy, not the same reference
  expect(() => topEntry([])).toThrow();
});

// --- router edges -------------------------------------------------------------------------------

function makeRouter() {
  const built: Screen[] = [];
  const router = createRouter<Routes>({
    initial: { name: 'home' },
    routes: {
      home: { build: () => ({ view: new Screen('home') }) },
      detail: {
        build: (ctx) => {
          const v = new Screen(`detail-${ctx.params.id}`);
          built.push(v);
          return { view: v };
        },
      },
      settings: { build: () => ({ view: new Screen('settings') }) },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);
  return { router, built };
}

test('router: replace at the root keeps depth 1 (still cannot go back)', () => {
  const { router } = makeRouter();
  router.replace('settings');
  expect(router.location()).toEqual({ name: 'settings', params: undefined });
  expect(router.canGoBack()).toBe(false);
});

test('router: reset from a deep stack collapses to one frame', () => {
  const { router } = makeRouter();
  router.push('detail', { id: 1 });
  router.push('detail', { id: 2 });
  router.push('settings');
  expect(router.canGoBack()).toBe(true);
  router.reset('home');
  expect(router.location()).toEqual({ name: 'home', params: undefined });
  expect(router.canGoBack()).toBe(false);
});

test('router: sequential push/back lands on the right screen and rebuilds fresh on return', () => {
  const { router, built } = makeRouter();
  router.push('detail', { id: 1 });
  const firstDetail = built[built.length - 1];
  router.back(); // dispose the detail screen (default)
  expect(router.location()).toEqual({ name: 'home', params: undefined });

  router.push('detail', { id: 1 }); // same params → a fresh instance (dispose-default)
  const secondDetail = built[built.length - 1];
  expect(secondDetail).not.toBe(firstDetail); // rebuilt, not reused
  expect(router.children).toContain(secondDetail);
  expect(router.children).not.toContain(firstDetail);
});

test('router: a re-entrant push from a screen onMount does not crash (AR-16 unguarded)', () => {
  let reentered = false;
  type R2 = { a: void; b: void };
  const router = createRouter<R2>({
    initial: { name: 'a' },
    routes: {
      a: {
        build: () => {
          const v = new Screen('a');
          // Navigate again from within the screen's mount — discouraged, but must not throw.
          v.onMount(() => {
            if (!reentered) {
              reentered = true;
              router.push('b');
            }
          });
          return { view: v };
        },
      },
      b: { build: () => ({ view: new Screen('b') }) },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  expect(() => loop.mount(router)).not.toThrow();
  expect(reentered).toBe(true);
});
