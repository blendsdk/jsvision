/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-12).
 *
 * Source: RD-22 AC-6 → ST-12 (plans/theming/07-testing-strategy.md; 03-03-attrs-and-serialize.md; PA-4).
 * `themeRoleToStyle` gains an optional attribute axis: it copies `attrs` through only when the role
 * carries one, so an attr-free role still returns exactly `{ fg, bg }` — the invariance the
 * `defaultTheme`-unchanged guarantee depends on.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { Attr } from '@jsvision/core';
import { themeRoleToStyle } from '../src/view/theme-style.js';

test('ST-12: themeRoleToStyle copies attrs through when the role carries one', () => {
  const style = themeRoleToStyle({ fg: '#ffffff', bg: '#000000', attrs: Attr.bold });
  expect(style.attrs, 'attrs preserved').toBe(Attr.bold);
  expect(style.fg, 'fg preserved').toBe('#ffffff');
  expect(style.bg, 'bg preserved').toBe('#000000');
});

test('ST-12: an attr-free role yields exactly { fg, bg } with no attrs key', () => {
  const style = themeRoleToStyle({ fg: '#ffffff', bg: '#000000' });
  expect(Object.keys(style).sort(), 'only fg + bg keys').toStrictEqual(['bg', 'fg']);
  expect('attrs' in style, 'no attrs key present').toBe(false);
});
