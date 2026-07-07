/**
 * Specification test (immutable oracle) — jsvision-ui RD-20 core `calendar*` theme roles (ST-14).
 *
 * Source: RD-20 AC-14 → ST-14 (plans/date-family/03-04-theme-packaging.md, PA-2/PA-3). Unlike the
 * feedback `progress*` roles (a by-analogy extension NOT byte-frozen), RD-20 pins **all six** calendar
 * bytes exactly (00-ambiguity-register.md PA-3): two are **TV-decoded** through the `getColor` chain
 * (`wpCyanWindow` → `cpAppColor`, `calendar.cpp`) and four are **user-gated** extension designs (PA-1/
 * PA-2). This oracle owns the byte guard for the new roles, so it freezes each `{ fg, bg }`:
 *   • `calendarNormal`     `0x3E` yellow-on-cyan   — TV `getColor(6)`→`cpCyanWindow[6]=0x15`→`cpAppColor[21]`
 *   • `calendarToday`      `0x21` blue-on-green     — TV `getColor(7)`→`cpCyanWindow[7]=0x16`→`cpAppColor[22]`
 *   • `calendarSelected`   `0x1F` white-on-blue     — extension (PA-2: blue-bg selection vs the cyan grid)
 *   • `calendarCursor`     `0xF0` black-on-white     — extension (PA-1: filled reverse focus cursor)
 *   • `calendarDisabled`   `0x38` darkGray-on-cyan  — extension (= the shipped clusterDisabled family)
 *   • `calendarWeekNumber` `0x30` black-on-cyan     — extension (PA-2: muted on-grid week number)
 *
 * The additive-only guard: every pre-existing role is byte-for-byte unchanged and the six `calendar*`
 * roles are the ONLY new keys. The `.js` extension in import specifiers is required by NodeNext ESM.
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
} as const;

/** The six additive RD-20 role names (the only new keys the additive guard tolerates). */
const CALENDAR_ROLES = [
  'calendarNormal',
  'calendarToday',
  'calendarSelected',
  'calendarCursor',
  'calendarDisabled',
  'calendarWeekNumber',
] as const;

/** The pinned byte decode of each `calendar*` role (PA-3; `0xHL`: H=bg nibble, L=fg nibble). */
const CALENDAR_EXPECTED: Record<(typeof CALENDAR_ROLES)[number], { fg: string; bg: string }> = {
  calendarNormal: { fg: P.yellow, bg: P.cyan }, // 0x3E
  calendarToday: { fg: P.blue, bg: P.green }, // 0x21
  calendarSelected: { fg: P.white, bg: P.blue }, // 0x1F
  calendarCursor: { fg: P.black, bg: P.white }, // 0xF0
  calendarDisabled: { fg: P.darkGray, bg: P.cyan }, // 0x38
  calendarWeekNumber: { fg: P.black, bg: P.cyan }, // 0x30
};

test('ST-14: the six calendar* roles exist with the PA-3 bytes (fg/bg pinned)', () => {
  for (const name of CALENDAR_ROLES) {
    const role = defaultTheme[name];
    expect(role, `${name} exists`).toBeTruthy();
    expect({ fg: role.fg, bg: role.bg }, `${name} bytes`).toStrictEqual(CALENDAR_EXPECTED[name]);
  }
});

test('ST-14: encode() of each calendar* role does not throw at any colour depth', () => {
  for (const name of CALENDAR_ROLES) {
    const role = defaultTheme[name];
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(role.fg, 'fg', depth), `${name}.fg @ ${depth}`).not.toThrow();
      expect(() => encode(role.bg, 'bg', depth), `${name}.bg @ ${depth}`).not.toThrow();
      if (role.hotkey !== undefined) {
        expect(() => encode(role.hotkey!, 'fg', depth), `${name}.hotkey @ ${depth}`).not.toThrow();
      }
    }
  }
});

test('ST-14: the calendar* roles are the ONLY additive keys — every existing role is unchanged', () => {
  // A snapshot of the full shipped role set (each entry copied verbatim from theme.ts BEFORE RD-20,
  // i.e. through RD-18's progress* roles). If any of these changed, the additive edit perturbed a
  // shipped decode → defect. These bytes are the AUTHORITATIVE pre-RD-20 values, a regression guard.
  const EXPECTED_UNCHANGED: Record<string, unknown> = {
    desktop: { pattern: '░', fg: P.blue, bg: P.lightGray },
    menuBar: { fg: P.black, bg: P.lightGray, hotkey: '#aa0000' },
    menuSelected: { fg: P.black, bg: P.green, hotkey: '#aa0000' },
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
    statusBar: { fg: P.black, bg: P.lightGray, hotkey: '#aa0000' },
    statusSelected: { fg: P.black, bg: P.green, hotkey: '#aa0000' },
    shadow: { fg: P.darkGray, bg: P.black },
  };

  for (const [name, value] of Object.entries(EXPECTED_UNCHANGED)) {
    expect(defaultTheme[name as keyof typeof defaultTheme], `${name} unchanged`).toStrictEqual(value);
  }

  // The calendar* roles were the ONLY new keys at RD-20 time (additive-only surface, AC-14). This
  // inventory tripwire tolerates roles that *later, sanctioned* additive RDs legitimately add on top —
  // each such RD's own theme spec owns the byte-for-byte guard for its roles (RD-21: color-theme.spec).
  // Extending this allowlist does NOT weaken RD-20's guarantee: every calendar* + pre-existing byte
  // above is still asserted unchanged. (RD-21 PA-14 runtime.)
  const LATER_ADDITIVE_ROLES = [
    'colorMarker', // RD-21 color family (PA-1, AC-10; guarded by color-theme.spec)
    'fileInfo', // RD-09 files package (PA-6, AC-15; guarded by files-theme.spec)
    'editorNormal',
    'editorSelected',
    'memoNormal',
    'memoSelected',
    'indicatorNormal',
    'indicatorDragging',
    'terminalNormal', // RD-08 editor family (PA-8; guarded by editor-theme.spec)
  ] as const;
  const knownKeys = new Set([...Object.keys(EXPECTED_UNCHANGED), ...CALENDAR_ROLES, ...LATER_ADDITIVE_ROLES]);
  const actualKeys = Object.keys(defaultTheme);
  const unexpected = actualKeys.filter((k) => !knownKeys.has(k));
  expect(unexpected, 'no theme key beyond the pre-existing set + the 6 calendar* roles').toEqual([]);
});
