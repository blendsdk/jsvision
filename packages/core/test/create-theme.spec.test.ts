/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-7…ST-11).
 *
 * Source: RD-22 AC-1…AC-4 → ST-7…ST-11 (plans/theming/07-testing-strategy.md; 03-02-create-theme-and-roles.md;
 * ambiguity registers AR-267, AR-269, AR-280, PA-2). Covers the semantic alias tier, the `createTheme`
 * builder, and the 63-role `rolesFromAliases` semantic-collapse mapping.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  createTheme,
  rolesFromAliases,
  defaultTheme,
  toRgb,
  contrastRatio,
  type ThemeColors,
  type Theme,
} from '../src/engine/index.js';

/** A fully-populated 16-token alias set for the mapping tests. */
const SAMPLE: ThemeColors = {
  foreground: '#e0e0e0',
  foregroundMuted: '#a0a0a0',
  foregroundDisabled: '#707070',
  foregroundOnAccent: '#ffffff',
  background: '#101010',
  backgroundRaised: '#202020',
  backgroundSunken: '#0a0a0a',
  backgroundSelected: '#303030',
  accent: '#3b82f6',
  accentMuted: '#2563eb',
  border: '#404040',
  borderMuted: '#303030',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#0ea5e9',
};

// ── ST-7: the alias tier is exactly 16 tokens, with no accentForeground ────────────────────────────

test('ST-7: ThemeColors is exactly 16 tokens and has no accentForeground', () => {
  const keys = Object.keys(SAMPLE);
  expect(keys.length, 'exactly 16 alias tokens').toBe(16);
  expect(keys, 'no dropped accentForeground synonym').not.toContain('accentForeground');
});

// ── ST-8: rolesFromAliases covers every role and is a Theme ─────────────────────────────────────────

test('ST-8: rolesFromAliases returns a full Theme with every defaultTheme role present', () => {
  const roles: Theme = rolesFromAliases(SAMPLE); // must be assignable to Theme (compile-time completeness)
  for (const key of Object.keys(defaultTheme)) {
    expect(key in roles, `role ${key} present`).toBe(true);
  }
  // Structural extras survive the mapping.
  expect(typeof roles.desktop.pattern, 'desktop keeps a pattern glyph').toBe('string');
  expect('title' in roles.window, 'window keeps a title color').toBe(true);
  expect('title' in roles.historyWindow, 'historyWindow has no title').toBe(false);
});

// ── ST-9: createTheme produces only resolvable colors ──────────────────────────────────────────────

test('ST-9: every role in a createTheme output parses via toRgb without throwing', () => {
  const theme = createTheme({ mode: 'dark', accent: '#3b82f6' });
  for (const [name, role] of Object.entries(theme) as [keyof Theme, Theme[keyof Theme]][]) {
    expect(() => toRgb(role.fg), `${name}.fg resolvable`).not.toThrow();
    expect(() => toRgb(role.bg), `${name}.bg resolvable`).not.toThrow();
    for (const extra of ['border', 'title', 'icon', 'hotkey'] as const) {
      if (extra in role) {
        expect(() => toRgb((role as Record<string, string>)[extra]), `${name}.${extra} resolvable`).not.toThrow();
      }
    }
  }
});

// ── ST-10: overrides re-drive derived roles; roleOverrides are surgical ─────────────────────────────

test('ST-10: an accent override re-drives accent-derived roles', () => {
  const red = createTheme({ mode: 'light', accent: '#3b82f6', overrides: { accent: '#ff0000' } });
  expect(red.button.bg, 'button.bg follows the accent alias').toBe('#ff0000');
  expect(red.listFocused.bg, 'listFocused.bg follows the accent alias').toBe('#ff0000');
});

test('ST-10: a roleOverride changes only the targeted key', () => {
  const base = createTheme({ mode: 'dark', accent: '#3b82f6' });
  const tweaked = createTheme({ mode: 'dark', accent: '#3b82f6', roleOverrides: { desktop: { pattern: '▒' } } });
  expect(tweaked.desktop.pattern, 'pattern overridden').toBe('▒');
  expect(base.desktop.pattern, 'base pattern differs').not.toBe('▒');
  expect(tweaked.desktop.fg, 'desktop.fg unchanged').toBe(base.desktop.fg);
  expect(tweaked.desktop.bg, 'desktop.bg unchanged').toBe(base.desktop.bg);
  expect(tweaked.button, 'an unrelated role is untouched').toStrictEqual(base.button);
});

// ── ST-11: light mode yields a lighter background than dark mode ────────────────────────────────────

test('ST-11: light-mode background is lighter than dark-mode background', () => {
  const light = createTheme({ mode: 'light', accent: '#3b82f6' });
  const dark = createTheme({ mode: 'dark', accent: '#3b82f6' });
  // Contrast against black rises with luminance, so the lighter background contrasts more.
  expect(
    contrastRatio(light.desktop.bg, '#000000'),
    'light background contrasts black more than dark does',
  ).toBeGreaterThan(contrastRatio(dark.desktop.bg, '#000000'));
});
