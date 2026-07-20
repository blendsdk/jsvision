/**
 * Implementation test — jsvision-ui RD-22 createTheme internals & edge cases.
 *
 * Complements create-theme.spec.test.ts (ST-7…ST-11) with the neutral-omitted default, the
 * alias-step override merge, and roleOverride merge depth. `.js` import extension per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { createTheme } from '../src/engine/index.js';

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

test('an omitted neutral seed yields a near-gray surface', () => {
  const theme = createTheme({ mode: 'dark', accent: '#3b82f6' });
  const [r, g, b] = channels(theme.desktop.bg);
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  expect(spread, 'default neutral background is low-chroma').toBeLessThanOrEqual(8);
});

test('an alias override re-drives every role using that alias', () => {
  const theme = createTheme({ mode: 'dark', accent: '#3b82f6', overrides: { foreground: '#123456' } });
  expect(theme.menuBar.fg, 'menuBar.fg follows foreground').toBe('#123456');
  expect(theme.window.fg, 'window.fg follows foreground').toBe('#123456');
  expect(theme.staticText.fg, 'staticText.fg follows foreground').toBe('#123456');
});

test('a roleOverride merges fields rather than replacing the whole role', () => {
  const base = createTheme({ mode: 'dark', accent: '#3b82f6' });
  const tweaked = createTheme({
    mode: 'dark',
    accent: '#3b82f6',
    roleOverrides: { window: { border: '#abcdef' } },
  });
  expect(tweaked.window.border, 'border patched').toBe('#abcdef');
  expect(tweaked.window.fg, 'window.fg preserved').toBe(base.window.fg);
  expect(tweaked.window.title, 'window.title preserved').toBe(base.window.title);
  expect(tweaked.window.icon, 'window.icon preserved').toBe(base.window.icon);
});

test('light and dark modes both produce resolvable, distinct backgrounds', () => {
  const light = createTheme({ mode: 'light', accent: '#3b82f6' });
  const dark = createTheme({ mode: 'dark', accent: '#3b82f6' });
  expect(light.desktop.bg, 'modes differ').not.toBe(dark.desktop.bg);
});
