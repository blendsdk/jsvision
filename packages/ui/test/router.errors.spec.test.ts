/**
 * Specification test (immutable oracle) — Navigation router · Phase 1 error isolation (ST-12).
 *
 * Source: 07-testing-strategy.md ST-12 (AR-13). A route's `build` throwing must not throw out of a
 * navigation call — the current screen stays and the error reaches the logger. Mirrors the render
 * root's per-view draw-error isolation. Expectations derive from the spec, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, createLogger } from '@jsvision/core';
import type { Logger } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createRouter } from '../src/router/router.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

type Routes = { home: void; boom: void };

class Screen extends View {
  constructor(readonly label: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

// ST-12 — a throwing build is isolated: the nav call does not throw, the current screen stays, logged.
test('ST-12: a throwing route build is isolated — nav does not throw, current screen stays, logger sees it', () => {
  const errors: string[] = [];
  const logger: Logger = { ...createLogger(), error: (_component, msg) => errors.push(msg) };

  const router = createRouter<Routes>({
    initial: { name: 'home' },
    logger,
    routes: {
      home: { build: () => ({ view: new Screen('home') }) },
      boom: {
        build: () => {
          throw new Error('build failed');
        },
      },
    },
  });
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(router);

  const before = router.location();
  expect(() => router.push('boom')).not.toThrow();

  // The navigation aborted: the current screen (home) is unchanged, and the error was logged.
  expect(router.location()).toEqual(before);
  expect(errors.length).toBeGreaterThan(0);
});
