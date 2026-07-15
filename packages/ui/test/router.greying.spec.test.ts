/**
 * Specification test (immutable oracle) — Navigation router · Phase 0 reactive greying (ST-5).
 *
 * Source: 07-testing-strategy.md ST-5 (R-8 / AR-11). Toggling a command's enablement must repaint the
 * bound status item on the next frame with no other trigger — the command registry bumps a version
 * signal and the StatusLine binds it, so a bare `enableCommand` greys/un-greys the item live.
 *
 * The test forces the frame the reactive bind scheduled via `renderRoot.flush()`; it is not an
 * independent trigger — without the bind nothing marks the item dirty, so `flush()` would compose
 * nothing and the greying would never appear. Expectations derive from the spec, never the impl.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { statusLine, statusItem } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// ST-5 — enableCommand(c,false) greys the bound item on the next frame; enableCommand(c,true) un-greys it.
test('ST-5: command enablement greys/un-greys a bound status item reactively', () => {
  const act = statusItem('~A~ct', 'act', 'Alt+A');
  const status = statusLine([act]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  const buf = app.loop.renderRoot.buffer();
  // Probe a plain (non-accent) text cell of the item: its span starts at the bar's left edge, the
  // label sits one pad column in, so the 'c' glyph of "Act" is at bar-local x=2.
  const probeX = status.bounds.x + 2;
  const probeY = status.bounds.y;
  const enabledFg = buf.get(probeX, probeY)?.fg;
  expect(enabledFg).toBeDefined();

  // Disable → the reactive bind repaints the item greyed (a different foreground) on the next frame.
  app.loop.enableCommand('act', false);
  app.loop.renderRoot.flush();
  const disabledFg = app.loop.renderRoot.buffer().get(probeX, probeY)?.fg;
  expect(disabledFg).not.toBe(enabledFg);

  // Re-enable → it returns to the enabled foreground, again with no manual invalidate.
  app.loop.enableCommand('act', true);
  app.loop.renderRoot.flush();
  const reEnabledFg = app.loop.renderRoot.buffer().get(probeX, probeY)?.fg;
  expect(reEnabledFg).toBe(enabledFg);
});
