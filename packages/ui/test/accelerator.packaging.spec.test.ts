/**
 * Specification test (immutable oracle) — accelerator-overlay packaging (ST-11).
 *
 * Source: accelerator-overlay/07-testing-strategy.md ST-11 (NFR-1/NFR-2, AR-15/AR-16/AR-17). Two
 * halves: (a) the additive UI seams exist — `DrawContext.revealAccelerators`,
 * `RenderRoot.setRevealAccelerators`, `EventLoopOptions.revealKey`, `EventLoop.setAcceleratorMode`;
 * (b) **no** new `@jsvision/core` export was added — the underline uses the pre-existing
 * `Attr.underline`, and the UI-owned names never leaked into core.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, Attr, ScreenBuffer, defaultTheme } from '@jsvision/core';
import * as core from '@jsvision/core';
import { createRenderRoot } from '../src/index.js';
import { makeDrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// ── (a) additive UI seams exist ─────────────────────────────────────────────────────────────────

test('ST-11: DrawContext carries revealAccelerators (default false; settable true)', () => {
  const buf = new ScreenBuffer(4, 2, { fg: 'default', bg: 'default' });
  const rect = { x: 0, y: 0, width: 4, height: 2 };
  const off = makeDrawContext(buf, rect, rect, defaultTheme, caps);
  expect(off.revealAccelerators, 'defaults false').toBe(false);
  const on = makeDrawContext(buf, rect, rect, defaultTheme, caps, true);
  expect(on.revealAccelerators, 'settable true').toBe(true);
});

test('ST-11: RenderRoot exposes setRevealAccelerators', () => {
  const rr = createRenderRoot({ width: 4, height: 2 }, { caps });
  expect(typeof rr.setRevealAccelerators, 'setRevealAccelerators is a function').toBe('function');
});

test('ST-11: EventLoop accepts revealKey and exposes setAcceleratorMode', () => {
  const loop = createEventLoop({ width: 4, height: 2 }, { caps, revealKey: 'f9' });
  expect(typeof loop.setAcceleratorMode, 'setAcceleratorMode is a function').toBe('function');
  // `revealKey: null` disables — the option is accepted either way.
  const disabled = createEventLoop({ width: 4, height: 2 }, { caps, revealKey: null });
  expect(typeof disabled.setAcceleratorMode).toBe('function');
});

// ── (b) no new @jsvision/core export (AR-15) ────────────────────────────────────────────────────

test('ST-11: the underline uses the pre-existing core Attr.underline (no new core symbol)', () => {
  expect(typeof Attr.underline, 'Attr.underline is the existing SGR-4 bit').toBe('number');
  expect(Attr.underline, 'value unchanged (1 << 3)').toBe(1 << 3);
});

test('ST-11: the accelerator-overlay names are UI-owned — none leaked into @jsvision/core', () => {
  const surface = core as Record<string, unknown>;
  for (const name of [
    'revealAccelerators',
    'setRevealAccelerators',
    'revealKey',
    'setAcceleratorMode',
    'accentStyle',
  ]) {
    expect(surface[name], `@jsvision/core must not export ${name}`).toBeUndefined();
  }
  // A representative sample of the existing core surface is still intact (additive-only).
  expect(typeof core.serialize, 'serialize still exported').toBe('function');
  expect(typeof core.ScreenBuffer, 'ScreenBuffer still exported').toBe('function');
});
