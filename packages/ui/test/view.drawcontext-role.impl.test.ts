/**
 * Implementation tests — DrawContext.role() internals (RD-05 Phase 0).
 *
 * Beyond the FX-05 spec oracle: `role(name)` resolves to the exact raw `Theme[name]` object for
 * every `ThemeRoleName`, and `color(name)` remains the {fg,bg}-only projection of the same role.
 *
 * Trace: RD-05 03-00 §B · PA-16.
 */
import { test, expect } from 'vitest';
import { ScreenBuffer, defaultTheme, resolveCapabilities } from '@jsvision/core';
import type { Theme } from '@jsvision/core';
import type { Rect } from '../src/layout/index.js';
import { makeDrawContext } from '../src/view/index.js';

// RD-18 PA-1: makeDrawContext now requires a resolved CapabilityProfile (surfaced as ctx.caps).
const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function ctxOver(theme: Theme = defaultTheme) {
  const buf = new ScreenBuffer(4, 1, { fg: 'default', bg: 'default' });
  const rect: Rect = { x: 0, y: 0, width: 4, height: 1 };
  return makeDrawContext(buf, rect, rect, theme, caps);
}

test('role(name) resolves to the exact raw role object for every ThemeRoleName', () => {
  const ctx = ctxOver();
  for (const name of Object.keys(defaultTheme) as (keyof Theme)[]) {
    // Reference-equal to the theme's own role — no copy, no projection.
    expect(ctx.role(name)).toBe(defaultTheme[name]);
  }
});

test('role() exposes the role-only extras (pattern/border/title) that color() drops', () => {
  const ctx = ctxOver();
  expect(ctx.role('desktop').pattern).toBe(defaultTheme.desktop.pattern);
  expect(ctx.role('window').border).toBe(defaultTheme.window.border);
  expect(ctx.role('window').title).toBe(defaultTheme.window.title);
  expect(ctx.role('dialog').border).toBe(defaultTheme.dialog.border);

  // color() stays the {fg,bg}-only projection of the same role.
  expect(ctx.color('window')).toEqual({ fg: defaultTheme.window.fg, bg: defaultTheme.window.bg });
});

test('role() reflects a custom theme passed to makeDrawContext', () => {
  const custom: Theme = {
    ...defaultTheme,
    desktop: { ...defaultTheme.desktop, pattern: '▒' },
  };
  const ctx = ctxOver(custom);
  expect(ctx.role('desktop').pattern).toBe('▒');
});
