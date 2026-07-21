/**
 * Specification test (immutable oracle) — Navigation router · Phase 2 chrome contributions (ST-16).
 *
 * Source: 07-testing-strategy.md ST-16 (R-3 / AR-4). A screen's `status` replaces the shared bar on
 * activation; a screen without `status` shows the app base; the `withBase` helper composes a base +
 * extras list. Expectations derive from the spec, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { statusLine, statusItem, StatusItemView } from '../src/status/index.js';
import { createRouter } from '../src/router/router.js';
import { withBase } from '../src/router/chrome.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

class Screen extends View {
  override focusable = true;
  constructor(readonly label: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

/** Whether the status bar currently holds a command item with this name. */
function hasCommand(bar: { children: readonly View[] }, command: string): boolean {
  return bar.children.some((c) => c instanceof StatusItemView && c.command === command);
}

// ST-16 — replace-when-present + base fallback on activation; withBase composes base + extras.
test('ST-16: a screen replaces the status bar on activation; no-status shows the base', () => {
  type R = { plain: void; fancy: void };
  const router = createRouter<R>({
    initial: { name: 'plain' },
    routes: {
      plain: { build: () => ({ view: new Screen('plain') }) }, // no status → base
      fancy: {
        build: () => ({ view: new Screen('fancy'), status: [statusItem('~B~ Back', 'back', 'Escape')] }),
      },
    },
  });
  const baseBar = statusLine([statusItem('~H~ Help', 'help', 'Alt+H')]);
  const app = createApplication({ caps, content: router, statusLine: baseBar, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  // initial 'plain' has no status → the app base is shown
  expect(hasCommand(baseBar, 'help')).toBe(true);

  router.push('fancy'); // 'fancy' replaces the bar with its own items
  app.loop.renderRoot.flush();
  expect(hasCommand(baseBar, 'back')).toBe(true);
  expect(hasCommand(baseBar, 'help')).toBe(false);

  router.back(); // back to 'plain' → the base returns
  app.loop.renderRoot.flush();
  expect(hasCommand(baseBar, 'help')).toBe(true);
  expect(hasCommand(baseBar, 'back')).toBe(false);
});

// ST-16 (cont.) — withBase composes a base list plus per-screen extras.
test('ST-16: withBase(base, extra) yields [...base, ...extra]', () => {
  const base = [statusItem('~Q~ Quit', 'quit', 'Alt+X')];
  const extra = [statusItem('~E~ Edit', 'edit')];
  expect(withBase(base, extra)).toEqual([...base, ...extra]);
});
