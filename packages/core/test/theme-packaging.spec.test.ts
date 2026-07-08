/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming packaging (ST-27, P-AC-3).
 *
 * Source: RD-22 AC-17 → ST-27 (plans/theming/07-testing-strategy.md; 03-04-presets-and-governance.md, PA-6).
 * The additive-surface guard: every new theming symbol is importable from the public entry, every
 * pre-existing color export still resolves (additive-only), and every new color source file is ≤ 500
 * lines.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as core from '../src/engine/index.js';
import {
  ramp,
  lighten,
  darken,
  mix,
  contrastRatio,
  createTheme,
  rolesFromAliases,
  serializeTheme,
  parseTheme,
  InvalidThemeError,
  turboVisionTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  PALETTE,
  defaultTheme,
  toRgb,
  Attr,
} from '../src/engine/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const COLOR_DIR = resolve(HERE, '../src/engine/color');

// New source files this feature adds under color/.
const NEW_FILES = ['aliases.ts', 'ramp.ts', 'contrast.ts', 'create-theme.ts', 'roles.ts', 'serialize.ts', 'presets.ts'];

test('ST-27: every new theming function/class is importable from @jsvision/core', () => {
  for (const fn of [
    ramp,
    lighten,
    darken,
    mix,
    contrastRatio,
    createTheme,
    rolesFromAliases,
    serializeTheme,
    parseTheme,
  ]) {
    expect(typeof fn, 'function export').toBe('function');
  }
  expect(typeof InvalidThemeError, 'InvalidThemeError is a class').toBe('function');
});

test('ST-27: all 7 presets are importable objects', () => {
  for (const preset of [
    turboVisionTheme,
    monochromeTheme,
    slateTheme,
    nordTheme,
    draculaTheme,
    solarizedDarkTheme,
    gruvboxDarkTheme,
  ]) {
    expect(typeof preset, 'preset is an object').toBe('object');
    expect(preset.desktop, 'preset has roles').toBeTruthy();
  }
});

test('ST-27: no pre-existing @jsvision/core color export changed (additive-only)', () => {
  expect(typeof PALETTE.black, 'PALETTE still exported').toBe('string');
  expect(defaultTheme.window, 'defaultTheme still exported').toBeTruthy();
  expect(toRgb('default'), 'toRgb still exported').toBeNull();
  expect(Attr.bold, 'Attr still exported').toBe(1);
  expect(typeof core.encode, 'encode still exported').toBe('function');
  expect(typeof core.nearest16, 'nearest16 still exported').toBe('function');
});

test('ST-27: every new color source file is ≤ 500 lines', () => {
  for (const f of NEW_FILES) {
    const lines = readFileSync(resolve(COLOR_DIR, f), 'utf8').split('\n').length;
    expect(lines, `${f} ≤ 500 lines`).toBeLessThanOrEqual(500);
  }
});
