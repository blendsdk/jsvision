/**
 * Specification tests — DOS-16 palette & semantic theme (RD-05).
 *
 * Immutable oracle: expectations derive from RD-05 Must-Have (DOS-16 palette +
 * semantic theme) and AR-9 via ST-15/ST-16 in plan doc 07-testing-strategy —
 * never from reading the implementation. Hex values are the documented Borland
 * palette (03-02), including the `brightMagenta` the prototype omitted.
 */
import { test, expect } from 'vitest';

import { PALETTE, defaultTheme, encode } from '../src/engine/color/index.js';
import { decodeGrayDialogSlot } from './theme-decode.helpers.js';

// ST-15 — the full DOS-16 palette at the documented hex; every value is a valid color.
test('ST-15: PALETTE holds the 16 DOS colors at the documented hex', () => {
  expect(PALETTE).toStrictEqual({
    black: '#000000',
    blue: '#0000aa',
    green: '#00aa00',
    cyan: '#00aaaa',
    red: '#aa0000',
    magenta: '#aa00aa',
    brown: '#aa5500',
    lightGray: '#aaaaaa',
    darkGray: '#555555',
    brightBlue: '#5555ff',
    brightGreen: '#55ff55',
    brightCyan: '#55ffff',
    brightRed: '#ff5555',
    brightMagenta: '#ff55ff',
    yellow: '#ffff55',
    white: '#ffffff',
  });
  expect(Object.keys(PALETTE).length).toBe(16);
  // Every palette value is a valid color (encodes without throwing).
  for (const value of Object.values(PALETTE)) {
    expect(() => encode(value, 'fg', 'truecolor')).not.toThrow();
  }
});

// ST-16 — the default theme exposes the migrated semantic roles wired to colors.
test('ST-16: defaultTheme exposes the semantic roles', () => {
  for (const role of [
    'desktop',
    'menuBar',
    'menuSelected',
    'window',
    'dialog',
    'button',
    'buttonFocused',
    'statusBar',
    'statusSelected',
    'shadow',
  ] as const) {
    expect(role in defaultTheme).toBeTruthy();
  }
  expect(defaultTheme.desktop.pattern).toBe('░');
  // TV `cpAppColor[1]` = 0x71 = blue ░ on a lightGray field (app.h:142) — a muted steel desktop.
  expect(defaultTheme.desktop.fg).toBe(PALETTE.blue);
  expect(defaultTheme.desktop.bg).toBe(PALETTE.lightGray);
  expect(defaultTheme.menuBar.bg).toBe(PALETTE.lightGray);
  // RD-10 — the status-line pressed item (TV cSelect 0x20 / hotkey 0x24): black + red on green.
  expect(defaultTheme.statusSelected).toStrictEqual({
    fg: PALETTE.black,
    bg: PALETTE.green,
    hotkey: PALETTE.red,
  });
});

// --- RD-06 (essential-controls) ST-02 — the additive `cpGrayDialog` control theme roles -----------
//
// Immutable oracle: the expectations are computed DIRECTLY from the Turbo Vision source palettes
// (the AUTHORING RULE — never from the implementation), so the theme bytes are pinned to
// `magiblot/tvision` and a hand-decode error in `theme.ts` fails this test (RED), not the oracle.
//
//   • `cpGrayDialog` (dialogs.h:80-82) maps a dialog slot (1-based) → a `cpAppColor` color number.
//   • `cpAppColor`   (app.h:142-151)   maps a color number (1-based) → a CGA attribute byte `0xHL`
//     (high nibble = background, low nibble = foreground; the DOS-16 index → PALETTE name order).
//
// Source: jsvision-ui RD-06 AC-9 → ST-02 (essential-controls/07-testing-strategy.md, 03-01 §B).
// The palette-decode tables + `decodeGrayDialogSlot` live in `./theme-decode.helpers.ts` (DRY —
// shared with the RD-11 `theme-roles.spec` oracle).

/** RD-06 control roles → their `cpGrayDialog` slot (dialogs.h:42-73 palette layout). */
const CONTROL_ROLE_SLOTS = {
  staticText: 6,
  label: 7,
  labelSelected: 8,
  labelShortcut: 9,
  buttonDefault: 11,
  buttonDisabled: 13,
  buttonShortcut: 14,
  // `buttonShadow` = TV `cShadow = getColor(8)`: `cpButton[8]=0x0F` → cpGrayDialog slot 15 → 0x70.
  buttonShadow: 15,
  clusterNormal: 16,
  clusterSelected: 17,
  clusterShortcut: 18,
  clusterDisabled: 31,
  inputNormal: 19,
  inputSelected: 20,
  inputArrows: 21,
} as const;

test('ST-02: control theme roles deep-equal the app.h cpGrayDialog source decode', () => {
  // Built-in anchor (also the ST-02 worked example): StaticText (slot 6) is black on lightGray.
  expect(decodeGrayDialogSlot(6)).toStrictEqual({ fg: PALETTE.black, bg: PALETTE.lightGray });
  // And the reused button roles must still resolve to their existing slots (10 normal / 12 selected).
  expect(decodeGrayDialogSlot(10)).toStrictEqual({ fg: defaultTheme.button.fg, bg: defaultTheme.button.bg });
  expect(decodeGrayDialogSlot(12)).toStrictEqual({
    fg: defaultTheme.buttonFocused.fg,
    bg: defaultTheme.buttonFocused.bg,
  });

  for (const [role, slot] of Object.entries(CONTROL_ROLE_SLOTS)) {
    const expected = decodeGrayDialogSlot(slot);
    const actual = defaultTheme[role as keyof typeof CONTROL_ROLE_SLOTS];
    expect(actual, `${role} (cpGrayDialog slot ${slot})`).toStrictEqual(expected);
  }
});

test('ST-02: encode() of each control theme role does not throw', () => {
  for (const role of Object.keys(CONTROL_ROLE_SLOTS) as (keyof typeof CONTROL_ROLE_SLOTS)[]) {
    const { fg, bg } = defaultTheme[role];
    expect(() => encode(fg, 'fg', 'truecolor'), `${role}.fg`).not.toThrow();
    expect(() => encode(bg, 'bg', 'truecolor'), `${role}.bg`).not.toThrow();
  }
});

test('ST-02: button / buttonFocused are unchanged by the additive control roles', () => {
  expect(defaultTheme.button).toStrictEqual({ fg: PALETTE.black, bg: PALETTE.green });
  expect(defaultTheme.buttonFocused).toStrictEqual({
    fg: PALETTE.white,
    bg: PALETTE.green,
    hotkey: PALETTE.yellow,
  });
});
