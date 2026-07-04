/**
 * Specification test (immutable oracle) — jsvision-ui RD-21 core `colorMarker` theme role (ST-11).
 *
 * Source: RD-21 AC-10 → ST-11 (plans/color-family/03-03-theme-packaging.md, PA-1/PA-2). Unlike the
 * feedback `progress*` / tabs `tab*` by-analogy extensions (NOT byte-frozen), `colorMarker` is a
 * **TV-decoded** byte: `TColorSelector::draw()` forces the `◘` marker on a black cell to attribute
 * `0x70` (`colorsel.cpp:135-136`) so it stays visible; RD-21 pins that byte as the role and fires it
 * on **near-black** cells (the generic extension of TV's exact `c==0`, PA-2). This oracle owns the byte
 * guard for the new role, so it freezes `{ fg, bg }`:
 *   • `colorMarker` `0x70` black-on-lightGray — TV `putAttribute(j*3+1, 0x70)` (`colorsel.cpp:136`)
 *
 * The additive-only guard: every pre-existing role is byte-for-byte unchanged and `colorMarker` is the
 * ONLY new key. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import type { ColorDepth } from '@jsvision/core';
import { defaultTheme, encode } from '@jsvision/core';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

/** The DOS-16 palette hex values (matching core PALETTE; inlined so this oracle is self-contained). */
const P = {
  black: '#000000',
  blue: '#0000aa',
  green: '#00aa00',
  cyan: '#00aaaa',
  lightGray: '#aaaaaa',
  darkGray: '#555555',
  brightCyan: '#55ffff',
  yellow: '#ffff55',
  white: '#ffffff',
  brightGreen: '#55ff55',
  red: '#aa0000',
} as const;

test('ST-11: the colorMarker role exists with the PA-1 byte 0x70 (black-on-lightGray, fg/bg pinned)', () => {
  const role = defaultTheme.colorMarker;
  expect(role, 'colorMarker exists').toBeTruthy();
  expect({ fg: role.fg, bg: role.bg }, 'colorMarker bytes 0x70').toStrictEqual({ fg: P.black, bg: P.lightGray });
});

test('ST-11: encode() of the colorMarker role does not throw at any colour depth', () => {
  const role = defaultTheme.colorMarker;
  for (const depth of ALL_DEPTHS) {
    expect(() => encode(role.fg, 'fg', depth), `colorMarker.fg @ ${depth}`).not.toThrow();
    expect(() => encode(role.bg, 'bg', depth), `colorMarker.bg @ ${depth}`).not.toThrow();
  }
});

test('ST-11: colorMarker is the ONLY additive key — every existing role is byte-for-byte unchanged', () => {
  // A snapshot of the full shipped role set (each entry copied verbatim from theme.ts BEFORE RD-21,
  // i.e. through RD-20's calendar* roles). If any of these changed, the additive edit perturbed a
  // shipped decode → defect. These bytes are the AUTHORITATIVE pre-RD-21 values, a regression guard.
  const EXPECTED_UNCHANGED: Record<string, unknown> = {
    desktop: { pattern: '░', fg: P.blue, bg: P.lightGray },
    menuBar: { fg: P.black, bg: P.lightGray, hotkey: P.red },
    menuSelected: { fg: P.black, bg: P.green, hotkey: P.red },
    window: { fg: P.white, bg: P.blue, border: P.white, title: P.white, icon: P.brightGreen },
    windowInactive: { fg: P.lightGray, bg: P.blue, border: P.lightGray, title: P.lightGray, icon: P.lightGray },
    dialog: { fg: P.black, bg: P.lightGray, border: P.white, title: P.white, icon: P.brightGreen },
    button: { fg: P.black, bg: P.green },
    buttonFocused: { fg: P.white, bg: P.green, hotkey: P.yellow },
    staticText: { fg: P.black, bg: P.lightGray },
    label: { fg: P.black, bg: P.lightGray },
    labelSelected: { fg: P.white, bg: P.lightGray },
    labelShortcut: { fg: P.yellow, bg: P.lightGray },
    buttonDefault: { fg: P.brightCyan, bg: P.green },
    buttonDisabled: { fg: P.darkGray, bg: P.lightGray },
    buttonShortcut: { fg: P.yellow, bg: P.green },
    buttonShadow: { fg: P.black, bg: P.lightGray },
    clusterNormal: { fg: P.black, bg: P.cyan },
    clusterSelected: { fg: P.white, bg: P.cyan },
    clusterShortcut: { fg: P.yellow, bg: P.cyan },
    clusterDisabled: { fg: P.darkGray, bg: P.cyan },
    inputNormal: { fg: P.white, bg: P.blue },
    inputSelected: { fg: P.white, bg: P.blue },
    inputSelection: { fg: P.white, bg: P.green },
    inputArrows: { fg: P.brightGreen, bg: P.blue },
    scrollBarPage: { fg: P.cyan, bg: P.blue },
    scrollBarControls: { fg: P.cyan, bg: P.blue },
    listNormal: { fg: P.black, bg: P.cyan },
    listFocused: { fg: P.white, bg: P.green },
    listSelected: { fg: P.yellow, bg: P.cyan },
    listDivider: { fg: P.blue, bg: P.cyan },
    tableHeader: { fg: P.white, bg: P.cyan },
    historyButtonSides: { fg: P.green, bg: P.lightGray },
    historyButtonArrow: { fg: P.black, bg: P.green },
    historyWindow: { fg: P.white, bg: P.blue, border: P.white, icon: P.brightGreen },
    historyViewer: { fg: P.white, bg: P.blue },
    historyViewerFocused: { fg: P.white, bg: P.green },
    outlineNormal: { fg: P.yellow, bg: P.blue },
    outlineFocused: { fg: P.blue, bg: P.lightGray },
    outlineSelected: { fg: P.brightGreen, bg: P.blue },
    outlineNotExpanded: { fg: P.white, bg: P.blue },
    tabActive: { fg: P.white, bg: P.green, hotkey: P.yellow },
    tabInactive: { fg: P.black, bg: P.green, hotkey: P.yellow },
    tabDisabled: { fg: P.darkGray, bg: P.green },
    progressFill: { fg: P.brightCyan, bg: P.blue },
    progressTrack: { fg: P.cyan, bg: P.blue },
    calendarNormal: { fg: P.yellow, bg: P.cyan },
    calendarToday: { fg: P.blue, bg: P.green },
    calendarSelected: { fg: P.white, bg: P.blue },
    calendarCursor: { fg: P.black, bg: P.white },
    calendarDisabled: { fg: P.darkGray, bg: P.cyan },
    calendarWeekNumber: { fg: P.black, bg: P.cyan },
    statusBar: { fg: P.black, bg: P.lightGray, hotkey: P.red },
    statusSelected: { fg: P.black, bg: P.green, hotkey: P.red },
    shadow: { fg: P.darkGray, bg: P.black },
  };

  for (const [name, value] of Object.entries(EXPECTED_UNCHANGED)) {
    expect(defaultTheme[name as keyof typeof defaultTheme], `${name} unchanged`).toStrictEqual(value);
  }

  // colorMarker is the ONLY new key added to the theme (additive-only surface, AC-10).
  const knownKeys = new Set([...Object.keys(EXPECTED_UNCHANGED), 'colorMarker']);
  const actualKeys = Object.keys(defaultTheme);
  const unexpected = actualKeys.filter((k) => !knownKeys.has(k));
  expect(unexpected, 'no theme key beyond the pre-existing set + colorMarker').toEqual([]);
});
