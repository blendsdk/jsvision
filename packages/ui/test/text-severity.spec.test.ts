/**
 * Specification test (immutable oracle) — `Text.severity` role mapping (ST-U1…U3).
 *
 * `Text` gains an optional `severity: 'error' | 'warning'` that repaints its content in a semantic
 * severity colour instead of the default `staticText` role: `'error'` → the `dangerText` role,
 * `'warning'` → the `warningText` role, unset → `staticText` (unchanged, back-compatible). Real `Text`
 * over a real `RenderRoot`; the painted cell fg is read back pre-serialize. Expectations derive from
 * RD-09 + the theme roles, never from the implementation.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { createRenderRoot } from '../src/view/index.js';
import { Text } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Mount a single-line Text and return the first glyph cell's fg/bg. */
function paintCell(text: Text): { fg: string | undefined; bg: string | undefined } {
  const rr = createRenderRoot({ width: 10, height: 1 }, { caps });
  rr.mount(text);
  const cell = rr.buffer().get(0, 0);
  return { fg: cell?.fg, bg: cell?.bg };
}

test('ST-U1: an unset severity paints the staticText role (unchanged)', () => {
  const { fg, bg } = paintCell(new Text('x'));
  expect(fg, 'default fg = staticText').toBe(defaultTheme.staticText.fg);
  expect(bg, 'default bg = staticText').toBe(defaultTheme.staticText.bg);
});

test("ST-U2: severity 'error' paints the dangerText role fg", () => {
  const { fg } = paintCell(new Text('x', { severity: 'error' }));
  expect(fg, "'error' fg = dangerText (#ef4444)").toBe(defaultTheme.dangerText.fg);
  expect(defaultTheme.dangerText.fg).toBe('#ef4444'); // the worked example
});

test("ST-U3: severity 'warning' paints the warningText role fg", () => {
  const { fg } = paintCell(new Text('x', { severity: 'warning' }));
  expect(fg, "'warning' fg = warningText (#f59e0b)").toBe(defaultTheme.warningText.fg);
  expect(defaultTheme.warningText.fg).toBe('#f59e0b'); // the worked example
});
