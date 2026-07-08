/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-21…ST-24).
 *
 * Source: RD-22 AC-10, AC-11, AC-7 → ST-21…ST-24 (plans/theming/07-testing-strategy.md;
 * 03-04-presets-and-governance.md; ambiguity registers AR-270, AR-272, PA-4). Covers the 7 shipped
 * presets, the canonical-hex pins, the `defaultTheme`-invariance reference, and the attr-driven
 * monochrome preset.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  turboVisionTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  defaultTheme,
  toRgb,
  type Theme,
  type ThemeRole,
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

/** Every color-valued field on a role (fg/bg + optional hotkey + structural color extras). */
function colorFields(role: ThemeRole): string[] {
  const r = role as Record<string, unknown>;
  const out: string[] = [role.fg, role.bg];
  for (const key of ['hotkey', 'border', 'title', 'icon']) {
    if (typeof r[key] === 'string') out.push(r[key] as string);
  }
  return out;
}

// ── ST-21: all 7 presets are valid themes; turboVision is the default ──────────────────────────────

test('ST-21: every preset is a full, resolvable Theme and turboVision is defaultTheme', () => {
  expect(Object.keys(PRESETS).length, '7 presets').toBe(7);
  expect(turboVisionTheme, 'turboVision === defaultTheme').toBe(defaultTheme);
  for (const [name, theme] of Object.entries(PRESETS)) {
    for (const key of Object.keys(defaultTheme)) {
      expect(key in theme, `${name}.${key} present`).toBe(true);
    }
    for (const role of Object.values(theme)) {
      for (const color of colorFields(role)) {
        expect(() => toRgb(color as Parameters<typeof toRgb>[0]), `${name} color ${color}`).not.toThrow();
      }
    }
  }
});

// ── ST-22: each curated preset pins its canonical background hex ────────────────────────────────────

test('ST-22: curated presets pin their canonical background hex', () => {
  expect(nordTheme.desktop.bg, 'Nord nord0').toBe('#2e3440');
  expect(draculaTheme.desktop.bg, 'Dracula background').toBe('#282a36');
  expect(solarizedDarkTheme.desktop.bg, 'Solarized base03').toBe('#002b36');
  expect(gruvboxDarkTheme.desktop.bg, 'Gruvbox bg0').toBe('#282828');
});

// ── ST-23: the defaultTheme-invariance reference (the real oracles are the *-theme.spec files) ──────

test('ST-23: defaultTheme is unchanged — turboVision aliases it and no role carries attrs', () => {
  expect(turboVisionTheme, 'turboVision is defaultTheme').toBe(defaultTheme);
  for (const [name, role] of Object.entries(defaultTheme)) {
    expect((role as ThemeRole).attrs, `defaultTheme.${name} has no attrs`).toBeUndefined();
  }
});

// ── ST-24: monochrome is achromatic and distinguishes state by attrs alone ─────────────────────────

test('ST-24: monochromeTheme uses no chromatic color', () => {
  for (const [name, role] of Object.entries(monochromeTheme)) {
    for (const color of colorFields(role)) {
      const rgb = toRgb(color as Parameters<typeof toRgb>[0]);
      if (rgb === null) continue; // 'default' — achromatic by definition
      expect(rgb.r === rgb.g && rgb.g === rgb.b, `${name} color ${color} is achromatic`).toBe(true);
    }
  }
});

test('ST-24: monochrome focused/selected states differ from normal only in attrs', () => {
  const pairs: [ThemeRole, ThemeRole][] = [
    [monochromeTheme.menuBar, monochromeTheme.menuSelected],
    [monochromeTheme.listNormal, monochromeTheme.listFocused],
    [monochromeTheme.clusterNormal, monochromeTheme.clusterSelected],
  ];
  for (const [normal, active] of pairs) {
    expect(active.fg, 'same fg').toBe(normal.fg);
    expect(active.bg, 'same bg').toBe(normal.bg);
    expect(active.attrs, 'attrs distinguishes the state').not.toBe(normal.attrs);
  }
});
