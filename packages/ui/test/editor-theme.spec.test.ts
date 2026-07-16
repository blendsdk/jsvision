/**
 * Specification test (immutable oracle) — jsvision-ui RD-08 core `editor*`/`memo*`/`indicator*`/
 * `terminal*` theme roles (ST-32).
 *
 * Source: RD-08 AC → ST-32 (codeops/features/jsvision-ui/plans/editor-family/07-testing-strategy.md,
 * register PA-8). All seven bytes are **TV-decoded** through the full `getColor` palette chain
 * (re-verified at exec GATE-1, 2026-07-07):
 *   • `editorNormal`      `0x1E` yellow-on-blue      — `cpEditor "\x06"` → `cpBlueWindow[6]=0x0D` →
 *                                                      `cpAppColor[13]` (`teditor1.cpp` getPalette,
 *                                                      `views.h` wpBlueWindow, `app.h` cpAppColor)
 *   • `editorSelected`    `0x71` blue-on-lightGray   — `cpEditor "\x07"` → `cpBlueWindow[7]=0x0E` →
 *                                                      `cpAppColor[14]`
 *   • `memoNormal`        `0x30` black-on-cyan       — `cpMemo "\x1A"` → `cpGrayDialog[26]=0x39` →
 *                                                      `cpAppColor` (`tmemo.cpp:27`, `dialogs.h`)
 *   • `memoSelected`      `0x2F` white-on-green      — `cpMemo "\x1B"` → `cpGrayDialog[27]=0x3A`
 *   • `indicatorNormal`   `0x1F` white-on-blue       — `cpIndicator "\x02"` → `cpBlueWindow[2]=0x09`
 *                                                      (`tindictr.cpp:27`; the resting ═ fill)
 *   • `indicatorDragging` `0x1A` brightGreen-on-blue — `cpIndicator "\x03"` → `cpBlueWindow[3]=0x0A`
 *                                                      (the ─ fill while the window drags)
 *   • `terminalNormal`    `0x1E` yellow-on-blue      — `cpScroller "\x06"` (`tscrolle.cpp:35`) via
 *                                                      `mapColor(1)` (`textview.cpp:125`)
 * Distinct roles are pinned even where bytes coincide (house convention — the `fileInfo` precedent).
 *
 * The additive-only guard: every pre-existing role is byte-for-byte unchanged and the seven roles are
 * the ONLY new keys. The `.js` extension in import specifiers is required by NodeNext ESM.
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

/** The seven additive RD-08 role names (the only new keys the additive guard tolerates). */
const EDITOR_ROLES = [
  'editorNormal',
  'editorSelected',
  'memoNormal',
  'memoSelected',
  'indicatorNormal',
  'indicatorDragging',
  'terminalNormal',
] as const;

/** The pinned byte decode of each role (PA-8; `0xHL`: H=bg nibble, L=fg nibble). */
const EDITOR_EXPECTED: Record<(typeof EDITOR_ROLES)[number], { fg: string; bg: string }> = {
  editorNormal: { fg: P.yellow, bg: P.blue }, // 0x1E
  editorSelected: { fg: P.blue, bg: P.lightGray }, // 0x71
  memoNormal: { fg: P.black, bg: P.cyan }, // 0x30
  memoSelected: { fg: P.white, bg: P.green }, // 0x2F
  indicatorNormal: { fg: P.white, bg: P.blue }, // 0x1F
  indicatorDragging: { fg: P.brightGreen, bg: P.blue }, // 0x1A
  terminalNormal: { fg: P.yellow, bg: P.blue }, // 0x1E
};

test('ST-32: the seven editor-family roles exist with the PA-8 bytes (fg/bg pinned)', () => {
  for (const name of EDITOR_ROLES) {
    const role = defaultTheme[name];
    expect(role, `${name} exists`).toBeTruthy();
    expect({ fg: role.fg, bg: role.bg }, `${name} bytes`).toStrictEqual(EDITOR_EXPECTED[name]);
  }
});

test('ST-32: encode() of each editor-family role does not throw at any colour depth', () => {
  for (const name of EDITOR_ROLES) {
    const role = defaultTheme[name];
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(role.fg, 'fg', depth), `${name}.fg @ ${depth}`).not.toThrow();
      expect(() => encode(role.bg, 'bg', depth), `${name}.bg @ ${depth}`).not.toThrow();
    }
  }
});

test('ST-32: the editor-family roles are the ONLY additive keys — every existing role is unchanged', () => {
  // A snapshot of the full shipped role set (each entry copied verbatim from theme.ts BEFORE RD-08,
  // i.e. through RD-09's fileInfo role). If any of these changed, the additive edit perturbed a
  // shipped decode → defect. These bytes are the AUTHORITATIVE pre-RD-08 values, a regression guard.
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
    calendarNormal: { fg: P.yellow, bg: P.cyan },
    calendarToday: { fg: P.blue, bg: P.green },
    calendarSelected: { fg: P.white, bg: P.blue },
    calendarCursor: { fg: P.black, bg: P.white },
    calendarDisabled: { fg: P.darkGray, bg: P.cyan },
    calendarWeekNumber: { fg: P.black, bg: P.cyan },
    colorMarker: { fg: P.black, bg: P.lightGray },
    fileInfo: { fg: P.cyan, bg: P.blue },
    statusBar: { fg: P.black, bg: P.lightGray, hotkey: '#aa0000' },
    statusSelected: { fg: P.black, bg: P.green, hotkey: '#aa0000' },
    shadow: { fg: P.darkGray, bg: P.black },
  };

  for (const [name, value] of Object.entries(EXPECTED_UNCHANGED)) {
    expect(defaultTheme[name as keyof typeof defaultTheme], `${name} unchanged`).toStrictEqual(value);
  }

  // The editor-family roles are the ONLY new keys at RD-08 time (additive-only surface). This
  // inventory tripwire tolerates roles that *later, sanctioned* additive RDs legitimately add on
  // top — each such RD's own theme spec owns the byte-for-byte guard for its roles. Extending this
  // allowlist does NOT weaken RD-08's guarantee: every editor-family + pre-existing byte above is
  // still asserted unchanged. (The RD-21/RD-20 PA-14 precedent.)
  const LATER_ADDITIVE_ROLES = ['sliderTrack', 'sliderThumb', 'dangerText', 'warningText', 'inputPlaceholder'] as const; // Slider (slider-theme.spec) + severity text roles (severity-text-theme.spec) + muted input placeholder (input-placeholder.spec)
  const knownKeys = new Set([...Object.keys(EXPECTED_UNCHANGED), ...EDITOR_ROLES, ...LATER_ADDITIVE_ROLES]);
  const actualKeys = Object.keys(defaultTheme);
  const unexpected = actualKeys.filter((k) => !knownKeys.has(k));
  expect(unexpected, 'no theme key beyond the pre-existing set + the 7 editor-family roles').toEqual([]);
});
