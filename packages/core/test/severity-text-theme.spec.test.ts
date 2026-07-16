/**
 * Specification test (immutable oracle) — the two additive severity text roles `dangerText` /
 * `warningText` (ST-C1…C4).
 *
 * These are new severity-text roles (no Turbo Vision counterpart): a danger-red and an amber body-text
 * colour that `Text.severity` paints. They are promoted from the already-seeded `danger`/`warning`
 * aliases, so a `createTheme({ danger, warning })` override flows straight through to them. This oracle
 * pins their `defaultTheme` bytes, the total role count, the override-flow, and the monochrome
 * achromatic values. A failing case means the theme model (theme.ts / roles.ts / presets.ts) is wrong.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import { aliasesFromSeeds, createTheme, defaultTheme, monochromeTheme, PALETTE } from '../src/engine/color/index.js';

test('ST-C1: defaultTheme.dangerText / .warningText equal the pinned severity byte pair', () => {
  expect(defaultTheme.dangerText, 'dangerText = danger-red on the static-text field').toStrictEqual({
    fg: '#ef4444',
    bg: PALETTE.lightGray,
  });
  expect(defaultTheme.warningText, 'warningText = amber on the static-text field').toStrictEqual({
    fg: '#f59e0b',
    bg: PALETTE.lightGray,
  });
});

test('ST-C2: the theme has 70 roles including dangerText/warningText/inputPlaceholder, whose names are not aliases', () => {
  const keys = Object.keys(defaultTheme);
  // 70 = the severity-text era's role count (68) plus the two datagrid grid roles (gridCursor,
  // gridDirty), which are additive and pinned by their own grid-theme spec.
  expect(keys.length, 'total role count').toBe(70);
  expect(keys, 'dangerText role present').toContain('dangerText');
  expect(keys, 'warningText role present').toContain('warningText');
  expect(keys, 'inputPlaceholder role present').toContain('inputPlaceholder');

  // The role names deliberately differ from the `danger`/`warning` alias names, so neither role can be
  // mistaken for (or collide with) a ThemeColors alias key.
  const aliasKeys = Object.keys(aliasesFromSeeds({ mode: 'light', accent: '#3b82f6' }));
  expect(aliasKeys, 'dangerText is not an alias name').not.toContain('dangerText');
  expect(aliasKeys, 'warningText is not an alias name').not.toContain('warningText');
});

test('ST-C3: a createTheme danger/warning override flows through to the two text roles', () => {
  const overridden = createTheme({ mode: 'light', accent: '#3b82f6', danger: '#c00', warning: '#fa0' });
  expect(overridden.dangerText.fg, 'danger override reaches dangerText.fg').toBe('#c00');
  expect(overridden.warningText.fg, 'warning override reaches warningText.fg').toBe('#fa0');

  const noOverride = createTheme({ mode: 'light', accent: '#3b82f6' });
  expect(noOverride.dangerText.fg, 'default danger seed drives dangerText.fg').toBe('#ef4444');
});

test('ST-C4: monochromeTheme.dangerText / .warningText are achromatic (white on black, no attrs)', () => {
  expect(monochromeTheme.dangerText, 'dangerText achromatic at mono').toStrictEqual({ fg: '#ffffff', bg: '#000000' });
  expect(monochromeTheme.warningText, 'warningText achromatic at mono').toStrictEqual({ fg: '#ffffff', bg: '#000000' });
});
