/**
 * Specification test (immutable oracle) — jsvision-ui RD-21 packaging (ST-12).
 *
 * Source: RD-21 AC-11 → ST-12 (plans/color-family/03-03-theme-packaging.md, PA-3/PA-4). Two halves:
 *   • **Core re-export half** (Phase 1, below): `ANSI16_ORDER` + `toRgb` are on the public
 *     `@jsvision/core` entry (they were defined but not surfaced, PF-002); no existing core export
 *     changed.
 *   • **UI re-export + line-budget half** (Phase 6, added when `color/` lands): `@jsvision/ui`
 *     re-exports `ColorSwatch`/`ColorPicker` + option types; every `color/` file ≤ 500 lines;
 *     `check:deps` clean.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import * as core from '@jsvision/core';
import { ANSI16_ORDER, toRgb, PALETTE, defaultTheme, InvalidColorError } from '@jsvision/core';

// ── Core re-export half (Phase 1) ─────────────────────────────────────────────────────────────────

test('ST-12: ANSI16_ORDER is public on @jsvision/core (16 named colors in palette-index order)', () => {
  expect(Array.isArray(ANSI16_ORDER), 'ANSI16_ORDER is an array').toBe(true);
  expect(ANSI16_ORDER.length, '16 ANSI names').toBe(16);
  expect(ANSI16_ORDER[0], 'index 0 is black').toBe('black');
  expect(ANSI16_ORDER[15], 'index 15 is brightWhite').toBe('brightWhite');
});

test('ST-12: toRgb is public on @jsvision/core (the single validation boundary)', () => {
  expect(typeof toRgb, 'toRgb is a function').toBe('function');
  expect(toRgb('#ffffff'), 'parses a hex color').toStrictEqual({ r: 255, g: 255, b: 255 });
  expect(toRgb('default'), 'default → null').toBeNull();
  expect(() => toRgb('#zzzzzz'), 'malformed hex throws').toThrow(InvalidColorError);
});

test('ST-12: no existing @jsvision/core color export changed (additive-only, AC-11)', () => {
  // The pre-RD-21 color exports are still importable and intact.
  expect(typeof PALETTE.black, 'PALETTE still exported').toBe('string');
  expect(defaultTheme.window, 'defaultTheme still exported').toBeTruthy();
  expect(typeof core.encode, 'encode still exported').toBe('function');
  expect(typeof core.nearest16, 'nearest16 still exported').toBe('function');
});
