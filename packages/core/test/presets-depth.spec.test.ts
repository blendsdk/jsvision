/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-25).
 *
 * Source: RD-22 AC-12 → ST-25 (plans/theming/07-testing-strategy.md; 03-04-presets-and-governance.md;
 * AR-270). Every preset must compose a representative widget set and paint non-empty output at all
 * four color depths (truecolor/256/16/mono) with no error — so the downsample chain and the
 * attribute-driven monochrome preset stay legible everywhere.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { ScreenBuffer, serialize, resolveCapabilities } from '../src/engine/index.js';
import type { ColorDepth, RenderOptions, Style, Theme, ThemeRole } from '../src/engine/index.js';
import {
  turboVisionTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
} from '../src/engine/index.js';

const PRESETS: Record<string, Theme> = {
  turboVisionTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
};

const DEPTHS: readonly ColorDepth[] = ['truecolor', '256', '16', 'mono'];

/** Render options pinned to a color depth. */
function optsFor(depth: ColorDepth): RenderOptions {
  return { caps: resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: depth } }).profile };
}

/** A paint style from a role (fg/bg + attrs when present). */
function styleOf(role: ThemeRole): Style {
  return role.attrs === undefined ? { fg: role.fg, bg: role.bg } : { fg: role.fg, bg: role.bg, attrs: role.attrs };
}

/** Paint a representative widget set (desktop, window, button, list, status, input) into a buffer. */
function paintWidgets(theme: Theme): ScreenBuffer {
  const roles: ThemeRole[] = [
    theme.desktop,
    theme.window,
    theme.button,
    theme.listFocused,
    theme.statusBar,
    theme.inputNormal,
  ];
  const buf = new ScreenBuffer(12, roles.length, { fg: 'default', bg: 'default' });
  roles.forEach((role, y) => {
    const style = styleOf(role);
    for (let x = 0; x < 6; x += 1) buf.set(x, y, 'Aa1#░▓'[x], style);
  });
  return buf;
}

for (const [name, theme] of Object.entries(PRESETS)) {
  for (const depth of DEPTHS) {
    test(`ST-25: ${name} paints non-empty at ${depth}`, () => {
      const buf = paintWidgets(theme);
      let out = '';
      expect(() => {
        out = serialize(buf, null, optsFor(depth));
      }, `${name} at ${depth} serializes without error`).not.toThrow();
      expect(out.length, `${name} at ${depth} is non-empty`).toBeGreaterThan(0);
    });
  }
}
