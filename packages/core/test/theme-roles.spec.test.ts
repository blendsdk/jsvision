/**
 * Specification test — RD-11 scrollbar/list theme roles (ST-13).
 *
 * Immutable oracle (jsvision-ui/RD-11 AC-12 → ST-13, containers-scrolling-lists/03-01-foundations §F1):
 * the six additive `defaultTheme` roles that RD-11's `ScrollBar`/`ListView` draw in must deep-equal
 * the Turbo Vision source decode, and `encode()` of each must not throw at any colour depth.
 *
 * The expectations are computed DIRECTLY from the TV source palettes (the AUTHORING RULE — never from
 * the implementation), reusing the shared `./theme-decode.helpers.ts` chain (cpGrayDialog → cpAppColor
 * → attribute byte → PALETTE). A hand-decode error in `theme.ts` fails this test (RED), not the oracle.
 *
 * Decode chain (PA-4/PA-10):
 *   • ScrollBar palette `cpScrollBar="\x04\x05\x05"` (`tscrlbar.cpp:37`) → gray-dialog slots 4/5 →
 *     `cpAppColor[35],[36]=0x13` → cyan-on-blue (page = controls = thumb share `0x13`; the glyph is
 *     the visual distinction).
 *   • ListViewer palette `cpListViewer="\x1A\x1A\x1B\x1C\x1D"` (`tlstview.cpp:30`) → gray-dialog slots
 *     26/27/28/29 → `cpAppColor[57..60]=0x30,0x2F,0x3E,0x31` → normal black-on-cyan, focused
 *     white-on-green, selected yellow-on-cyan, divider blue-on-cyan.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import type { ColorDepth } from '../src/engine/capability/index.js';
import { defaultTheme, encode } from '../src/engine/color/index.js';
import {
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
  createTheme,
  serializeTheme,
  parseTheme,
} from '../src/engine/color/index.js';
import type { Theme, ThemeRole } from '../src/engine/color/index.js';

import { decodeGrayDialogSlot } from './theme-decode.helpers.js';

/**
 * The six RD-11 theme roles → their `cpGrayDialog` slot. The slot is the value of the component's own
 * TV palette byte: `cpScrollBar[1]=0x04`→slot 4 (page/track), `[2]=0x05`→slot 5 (controls/arrows);
 * `cpListViewer[1]=0x1A`→slot 26 (normal), `[3]=0x1B`→slot 27 (focused), `[4]=0x1C`→slot 28
 * (selected), `[5]=0x1D`→slot 29 (divider).
 */
const RD11_ROLE_SLOTS = {
  scrollBarPage: 4,
  scrollBarControls: 5,
  listNormal: 26,
  listFocused: 27,
  listSelected: 28,
  listDivider: 29,
} as const;

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

test('ST-13: RD-11 theme roles deep-equal the app.h cpGrayDialog source decode', () => {
  for (const [role, slot] of Object.entries(RD11_ROLE_SLOTS)) {
    const expected = decodeGrayDialogSlot(slot);
    const actual = defaultTheme[role as keyof typeof RD11_ROLE_SLOTS];
    expect(actual, `${role} (cpGrayDialog slot ${slot})`).toStrictEqual(expected);
  }
});

test('ST-13: encode() of each RD-11 theme role does not throw at any colour depth', () => {
  for (const role of Object.keys(RD11_ROLE_SLOTS) as (keyof typeof RD11_ROLE_SLOTS)[]) {
    const { fg, bg } = defaultTheme[role];
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(fg, 'fg', depth), `${role}.fg @ ${depth}`).not.toThrow();
      expect(() => encode(bg, 'bg', depth), `${role}.bg @ ${depth}`).not.toThrow();
    }
  }
});

// --- Split-pane divider roles (split-panes feature) --------------------------
// Both roles must exist and be valid (defined fg + bg) across every theme surface:
// the two hand-authored themes (default + monochrome), every createTheme-generated
// preset, and the derived canonical role set that drives serialization. Roles are
// looked up by string so the case stays red (undefined) before implementation
// rather than becoming a compile error against the not-yet-extended Theme type.

const SPLIT_ROLES = ['splitter', 'splitterDragging'] as const;

/** The createTheme-generated presets — every one must inherit the pair via rolesFromAliases. */
const GENERATED_PRESETS: Record<string, Theme> = {
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

const roleOf = (theme: Theme, role: string): ThemeRole | undefined =>
  (theme as unknown as Record<string, ThemeRole | undefined>)[role];

test('ST-25 (split-panes): both splitter roles are present and valid across every theme surface', () => {
  const themes: Record<string, Theme> = {
    defaultTheme,
    monochromeTheme,
    ...GENERATED_PRESETS,
    // A fresh generation proves rolesFromAliases produces the pair for any seed, not just
    // the shipped presets.
    freshCreateTheme: createTheme({ mode: 'dark', accent: '#5b7a99', neutral: '#64748b' }),
  };
  for (const [name, theme] of Object.entries(themes)) {
    for (const role of SPLIT_ROLES) {
      const value = roleOf(theme, role);
      expect(value, `${name}.${role} present`).toBeDefined();
      expect(value?.fg, `${name}.${role}.fg defined`).toBeDefined();
      expect(value?.bg, `${name}.${role}.bg defined`).toBeDefined();
    }
  }
});

test('ST-25 (split-panes): both splitter roles are in the derived canonical set (serialize→parse safe)', () => {
  // CANONICAL_ROLES is Object.keys(defaultTheme); both roles must be members, and must survive
  // the canonical serializer that iterates it.
  const canonical = Object.keys(defaultTheme);
  for (const role of SPLIT_ROLES) expect(canonical).toContain(role);

  const restored = parseTheme(serializeTheme(defaultTheme));
  for (const role of SPLIT_ROLES) {
    const value = roleOf(restored, role);
    expect(value?.fg, `restored.${role}.fg`).toBeDefined();
    expect(value?.bg, `restored.${role}.bg`).toBeDefined();
  }
});
