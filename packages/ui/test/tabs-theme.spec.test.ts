/**
 * Specification test (immutable oracle) — jsvision-ui RD-17 core `tab*` theme roles (ST-29, ST-30).
 *
 * Source: RD-17 AC-11 → ST-29/ST-30 (plans/tabs/03-03-theme-packaging.md §GATE-1, AR-180). Turbo
 * Vision has NO tab/notebook class, so `tabActive`/`tabInactive`/`tabDisabled` are *documented
 * extension* colours pinned by analogy to the shipped gray-dialog decodes — NOT frozen by this
 * oracle. Per the AUTHORING RULE + the plan (03-03 §"the spec test … does not hard-code a byte"),
 * ST-29 asserts only that the three roles **exist** as `ThemeRole`s and that `encode()` of each does
 * not throw at any colour depth; a faithful GATE-1 re-pin must never be a spec violation.
 *
 * ST-30 is the additive-only guard: every pre-existing role is byte-for-byte unchanged (the new
 * roles must not perturb any shipped decode). The `.js` extension in import specifiers is required by
 * NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import type { ColorDepth } from '@jsvision/core';
import { defaultTheme, encode } from '@jsvision/core';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

/** The three additive RD-17 role names (the only new keys ST-30 tolerates on `defaultTheme`). */
const TAB_ROLES = ['tabActive', 'tabInactive', 'tabDisabled'] as const;

test('ST-29: the three tab* roles exist as ThemeRoles (fg/bg present)', () => {
  for (const name of TAB_ROLES) {
    const role = defaultTheme[name];
    expect(role, `${name} exists`).toBeTruthy();
    expect(typeof role.fg, `${name}.fg`).toBe('string');
    expect(typeof role.bg, `${name}.bg`).toBe('string');
  }
});

test('ST-29: encode() of each tab* role does not throw at any colour depth', () => {
  for (const name of TAB_ROLES) {
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

test('ST-30: the tab* roles are the ONLY additive keys — every existing role is unchanged', () => {
  // A snapshot of the full shipped role set (each entry copied verbatim from theme.ts at RD-16 time,
  // BEFORE RD-17). If any of these changed, the additive edit perturbed a shipped decode → defect.
  // The bytes here are the AUTHORITATIVE pre-RD-17 values, so this is a genuine regression guard, not
  // a mirror of the implementation.
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

  // Every pre-RD-17 role, byte-for-byte (the additive edit must leave all of these untouched).
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
    statusBar: { fg: P.black, bg: P.lightGray, hotkey: '#aa0000' },
    statusSelected: { fg: P.black, bg: P.green, hotkey: '#aa0000' },
    shadow: { fg: P.darkGray, bg: P.black },
  };

  for (const [name, value] of Object.entries(EXPECTED_UNCHANGED)) {
    expect(defaultTheme[name as keyof typeof defaultTheme], `${name} unchanged`).toStrictEqual(value);
  }

  // The tab* roles were the ONLY new keys at RD-17 time (additive-only surface). This inventory
  // tripwire tolerates roles that *later, sanctioned* additive RDs legitimately add on top — each
  // such RD's own theme spec owns the byte-for-byte guard for its roles (RD-18: feedback-theme.spec).
  // Extending this allowlist for a legitimately-added later role does NOT weaken RD-17's guarantee:
  // every tab* byte + every pre-existing byte above is still asserted unchanged. (RD-18 AR runtime.)
  const LATER_ADDITIVE_ROLES = [
    'progressFill',
    'progressTrack', // RD-18 feedback (PA-3, AC-11)
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
    'sliderTrack',
    'sliderThumb', // theme-designer Slider control (guarded by slider-theme.spec)
    'gridCursor',
    'gridDirty', // RD-02 datagrid editing engine (guarded by grid-theme.spec)
  ] as const;
  const knownKeys = new Set([...Object.keys(EXPECTED_UNCHANGED), ...TAB_ROLES, ...LATER_ADDITIVE_ROLES]);
  const actualKeys = Object.keys(defaultTheme);
  const unexpected = actualKeys.filter((k) => !knownKeys.has(k));
  expect(unexpected, 'no theme key beyond the pre-existing set + tab* + sanctioned later additive roles').toEqual([]);
});
