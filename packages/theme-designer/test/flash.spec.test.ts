/**
 * Specification tests (immutable oracles) — the preview "flash the edited color" helpers.
 *
 * Selecting a role/alias briefly recolors every theme cell currently painted in that color so the
 * affected widgets in the live preview blink. `flashColor` is the pure recolor and `flashColorFor`
 * is the high-contrast substitute; both must be side-effect-free and leave non-color fields (a
 * desktop `pattern` glyph, an `attrs` mask) untouched. A failing case means the blink would recolor
 * the wrong cells (or corrupt the theme).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { turboVisionTheme, toRgb } from '@jsvision/core';
import type { Color } from '@jsvision/core';

import { flashColor, flashColorFor } from '../src/model/index.js';

test('flashColor replaces every fg/bg equal to `from` with `to`, and only those', () => {
  const from = turboVisionTheme.button.bg;
  const to: Color = '#ff00ff';
  const flashed = flashColor(turboVisionTheme, from, to);

  // Every role whose bg was `from` now shows `to`; a role whose bg was not `from` is unchanged.
  for (const key of Object.keys(turboVisionTheme) as (keyof typeof turboVisionTheme)[]) {
    const before = turboVisionTheme[key];
    const after = flashed[key];
    expect(after.bg).toBe(before.bg === from ? to : before.bg);
    expect(after.fg).toBe(before.fg === from ? to : before.fg);
  }
  // At least the button's bg actually changed (the color existed in the theme).
  expect(flashed.button.bg).toBe(to);
});

test('flashColor is pure — it does not mutate the input theme', () => {
  const from = turboVisionTheme.button.bg;
  const snapshot = JSON.stringify(turboVisionTheme);
  flashColor(turboVisionTheme, from, '#ff00ff');
  expect(JSON.stringify(turboVisionTheme)).toBe(snapshot);
});

test('flashColor leaves non-color fields (the desktop pattern glyph) intact', () => {
  const flashed = flashColor(turboVisionTheme, turboVisionTheme.desktop.bg, '#ff00ff');
  expect(flashed.desktop.pattern).toBe(turboVisionTheme.desktop.pattern);
});

test('flashColorFor returns a visibly different color (its photographic negative)', () => {
  const c: Color = '#101020';
  const flash = flashColorFor(c);
  expect(flash).not.toBe(c);
  const rgb = toRgb(c)!;
  const inv = toRgb(flash)!;
  expect(inv.r).toBe(255 - rgb.r);
  expect(inv.g).toBe(255 - rgb.g);
  expect(inv.b).toBe(255 - rgb.b);
});

test('flashColorFor falls back to white for a color with no RGB form', () => {
  expect(flashColorFor('default')).toBe('#ffffff');
});
