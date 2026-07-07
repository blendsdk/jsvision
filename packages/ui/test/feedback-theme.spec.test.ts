/**
 * Specification test (immutable oracle) — jsvision-ui RD-18 core `progress*` theme roles (ST-11).
 *
 * Source: RD-18 AC-11 → ST-11 (plans/feedback/03-03-theme-packaging.md §GATE-1, PA-3). Turbo Vision
 * has NO gauge/progress palette (AR-186 whole-tree search), so `progressFill`/`progressTrack` are
 * *documented extension* colours pinned by analogy to the shipped cyan-on-blue scrollbar-gauge family
 * (fill `0x1B` brightCyan-on-blue, brighter than track `0x13` cyan-on-blue = `scrollBarPage`) — NOT
 * frozen by this oracle. Per the AUTHORING RULE + the plan (03-03 §"Do not hard-code a byte beyond the
 * pinned pair"), ST-11 asserts only that the two roles **exist** as `ThemeRole`s and that `encode()`
 * of each does not throw at any colour depth; a faithful GATE-1 re-pin must never be a spec violation.
 *
 * The additive-only guard: every pre-existing role is byte-for-byte unchanged and the two `progress*`
 * roles are the ONLY new keys (the new roles must not perturb any shipped decode). The `.js` extension
 * in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import type { ColorDepth } from '@jsvision/core';
import { defaultTheme, encode } from '@jsvision/core';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

/** The two additive RD-18 role names (the only new keys the additive guard tolerates). */
const FEEDBACK_ROLES = ['progressFill', 'progressTrack'] as const;

test('ST-11: the two progress* roles exist as ThemeRoles (fg/bg present)', () => {
  for (const name of FEEDBACK_ROLES) {
    const role = defaultTheme[name];
    expect(role, `${name} exists`).toBeTruthy();
    expect(typeof role.fg, `${name}.fg`).toBe('string');
    expect(typeof role.bg, `${name}.bg`).toBe('string');
  }
});

test('ST-11: encode() of each progress* role does not throw at any colour depth', () => {
  for (const name of FEEDBACK_ROLES) {
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

test('ST-11: the progress* roles are the ONLY additive keys — every existing role is unchanged', () => {
  // A snapshot of the full shipped role set (each entry copied verbatim from theme.ts BEFORE RD-18,
  // i.e. through RD-17's tab* roles). If any of these changed, the additive edit perturbed a shipped
  // decode → defect. These bytes are the AUTHORITATIVE pre-RD-18 values, a genuine regression guard.
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

  // Every pre-RD-18 role, byte-for-byte (the additive edit must leave all of these untouched).
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
    statusBar: { fg: P.black, bg: P.lightGray, hotkey: '#aa0000' },
    statusSelected: { fg: P.black, bg: P.green, hotkey: '#aa0000' },
    shadow: { fg: P.darkGray, bg: P.black },
  };

  for (const [name, value] of Object.entries(EXPECTED_UNCHANGED)) {
    expect(defaultTheme[name as keyof typeof defaultTheme], `${name} unchanged`).toStrictEqual(value);
  }

  // The progress* roles were the ONLY new keys at RD-18 time (additive-only surface, AC-11). This
  // inventory tripwire tolerates roles that *later, sanctioned* additive RDs legitimately add on top —
  // each such RD's own theme spec owns the byte-for-byte guard for its roles (RD-20: date-theme.spec).
  // Extending this allowlist does NOT weaken RD-18's guarantee: every progress* + pre-existing byte
  // above is still asserted unchanged. (RD-20 PA-14 runtime.)
  const LATER_ADDITIVE_ROLES = [
    'calendarNormal',
    'calendarToday',
    'calendarSelected',
    'calendarCursor',
    'calendarDisabled',
    'calendarWeekNumber', // RD-20 date family (PA-3, AC-14; guarded by date-theme.spec)
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
  const knownKeys = new Set([...Object.keys(EXPECTED_UNCHANGED), ...FEEDBACK_ROLES, ...LATER_ADDITIVE_ROLES]);
  const actualKeys = Object.keys(defaultTheme);
  const unexpected = actualKeys.filter((k) => !knownKeys.has(k));
  expect(unexpected, 'no theme key beyond the pre-existing set + progress* + sanctioned later additive roles').toEqual(
    [],
  );
});
