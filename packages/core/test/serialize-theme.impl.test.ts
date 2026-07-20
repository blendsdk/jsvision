/**
 * Implementation test — jsvision-ui RD-22 serialize/parse internals & edge cases.
 *
 * Complements serialize-theme.spec.test.ts (ST-13…ST-20) with key-order stability, `'default'`
 * colors, and generated-theme round-trips. `.js` import extension per NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { serializeTheme, parseTheme, createTheme, defaultTheme, Attr, type Theme } from '../src/engine/index.js';

test('serializeTheme is deterministic and stable across calls', () => {
  expect(serializeTheme(defaultTheme), 'same theme → same string').toBe(serializeTheme(defaultTheme));
});

test('a role serializes its keys in canonical order (fg, bg, hotkey, attrs, extras)', () => {
  const withAttrs: Theme = { ...defaultTheme, menuBar: { ...defaultTheme.menuBar, attrs: Attr.bold } };
  const parsed = JSON.parse(serializeTheme(withAttrs)) as { roles: Record<string, Record<string, unknown>> };
  expect(Object.keys(parsed.roles.menuBar), 'menuBar key order').toStrictEqual(['fg', 'bg', 'hotkey', 'attrs']);
  expect(Object.keys(parsed.roles.window), 'window key order (extras last)').toStrictEqual([
    'fg',
    'bg',
    'border',
    'title',
    'icon',
  ]);
});

test("a 'default' color round-trips as 'default'", () => {
  const mono: Theme = { ...defaultTheme, staticText: { fg: 'default', bg: 'default' } };
  const back = parseTheme(serializeTheme(mono));
  expect(back.staticText.fg, "fg stays 'default'").toBe('default');
  expect(back.staticText.bg, "bg stays 'default'").toBe('default');
});

test('a generated theme with a pattern override round-trips losslessly', () => {
  const base = createTheme({ mode: 'dark', accent: '#3b82f6' });
  // roleOverrides.desktop is typed as a full role (fg/bg required), not a per-field patch —
  // spread the base role so only `pattern` actually changes, matching the intended surgical override.
  const theme = createTheme({
    mode: 'dark',
    accent: '#3b82f6',
    roleOverrides: { desktop: { ...base.desktop, pattern: '▒' } },
  });
  const back = parseTheme(serializeTheme(theme));
  expect(back, 'deep-equal').toStrictEqual(theme);
  expect(back.desktop.pattern, 'single-cell pattern preserved').toBe('▒');
});
