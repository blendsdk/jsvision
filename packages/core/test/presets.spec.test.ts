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
  classicTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  janusTheme,
  warpTheme,
  solsticeTheme,
  platinumTheme,
  workbenchTheme,
  horizonTheme,
  defaultTheme,
  toRgb,
  PRESET_SEEDS,
  type Theme,
  type ThemeRole,
} from '../src/engine/index.js';

const PRESETS: Record<string, Theme> = {
  classicTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  janusTheme,
  warpTheme,
  solsticeTheme,
  platinumTheme,
  workbenchTheme,
  horizonTheme,
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
  expect(Object.keys(PRESETS).length, '13 presets').toBe(13);
  expect(classicTheme, 'turboVision === defaultTheme').toBe(defaultTheme);
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

test('ST-22: retro presets pin their signature backdrop and accent', () => {
  // The era backdrop (desktop) and the signature accent (the primary button face) are the fixed points.
  expect(janusTheme.desktop.bg, 'teal PC desktop').toBe('#008080');
  expect(janusTheme.button.bg, 'navy highlight').toBe('#000080');
  expect(warpTheme.desktop.bg, 'steel field').toBe('#567089');
  expect(solsticeTheme.button.bg, 'CDE teal').toBe('#2a7d7d');
  expect(platinumTheme.button.bg, 'Platinum highlight blue').toBe('#3355bb');
  expect(workbenchTheme.desktop.bg, 'Workbench blue').toBe('#0055aa');
  expect(workbenchTheme.button.bg, 'Workbench orange').toBe('#ff8800');
  expect(horizonTheme.desktop.bg, 'enterprise shell blue').toBe('#354a5f');
  expect(horizonTheme.button.bg, 'corporate blue').toBe('#0a6ed1');
});

// ── ST-6: curated-preset hotkey parity — data-driven over every curated preset ──────────────────────
// Each curated preset must render byte-identical hotkeys after the accelerator decouple: its
// accelerator-fed roles equal its historical `warning`, its menuAccelerator-fed roles equal its
// historical `danger`. A forgotten/transposed pin is type-valid (overrides is Partial<ThemeColors>)
// and silently regresses to the generic default — this loop is the guard the round-trip cannot be.

/** The generated theme built from each entry of `PRESET_SEEDS` (the two literal presets have no seeds). */
const SEEDED_THEMES: Record<string, Theme> = {
  slate: slateTheme,
  nord: nordTheme,
  dracula: draculaTheme,
  'solarized-dark': solarizedDarkTheme,
  'gruvbox-dark': gruvboxDarkTheme,
  janus: janusTheme,
  warp: warpTheme,
  solstice: solsticeTheme,
  platinum: platinumTheme,
  workbench: workbenchTheme,
  horizon: horizonTheme,
};

/** Roles whose hotkey/shortcut color must equal the preset's historical `warning`. */
const ACCELERATOR_ROLE_COLORS = (t: Theme): string[] => [
  t.buttonFocused.hotkey as string,
  t.tabActive.hotkey as string,
  t.tabInactive.hotkey as string,
  t.labelShortcut.fg,
  t.buttonShortcut.fg,
  t.clusterShortcut.fg,
];

/** Roles whose hotkey color must equal the preset's historical `danger`. */
const MENU_ACCELERATOR_ROLE_COLORS = (t: Theme): string[] => [
  t.menuBar.hotkey as string,
  t.menuSelected.hotkey as string,
  t.statusBar.hotkey as string,
  t.statusSelected.hotkey as string,
];

test('ST-6: every curated preset pins its hotkeys to its historical warning/danger', () => {
  let checked = 0;
  for (const [name, seeds] of Object.entries(PRESET_SEEDS)) {
    if (!seeds.overrides) continue; // slate rides the defaults — no override block to mirror
    const theme = SEEDED_THEMES[name];
    for (const color of ACCELERATOR_ROLE_COLORS(theme)) {
      expect(color, `${name}: accelerator-fed role === historical warning`).toBe(seeds.overrides.warning);
    }
    for (const color of MENU_ACCELERATOR_ROLE_COLORS(theme)) {
      expect(color, `${name}: menuAccelerator-fed role === historical danger`).toBe(seeds.overrides.danger);
    }
    checked++;
  }
  expect(checked, 'all 10 curated presets checked').toBe(10);
});

test('ST-6: spot-anchored hotkey parity for nord and dracula', () => {
  expect(nordTheme.labelShortcut.fg, 'nord accelerator = its warning').toBe('#ebcb8b');
  expect(nordTheme.menuBar.hotkey, 'nord menuAccelerator = its danger').toBe('#bf616a');
  expect(draculaTheme.labelShortcut.fg, 'dracula accelerator = its warning').toBe('#f1fa8c');
  expect(draculaTheme.menuBar.hotkey, 'dracula menuAccelerator = its danger').toBe('#ff5555');
});

// ── ST-23: the defaultTheme-invariance reference (the real oracles are the *-theme.spec files) ──────

test('ST-23: defaultTheme is unchanged — turboVision aliases it and no role carries attrs', () => {
  expect(classicTheme, 'turboVision is defaultTheme').toBe(defaultTheme);
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
