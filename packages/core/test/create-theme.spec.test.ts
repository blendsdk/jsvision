/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-7…ST-11).
 *
 * Source: RD-22 AC-1…AC-4 → ST-7…ST-11 (plans/theming/07-testing-strategy.md; 03-02-create-theme-and-roles.md;
 * ambiguity registers AR-267, AR-269, AR-280, PA-2). Covers the semantic alias tier, the `createTheme`
 * builder, and the 63-role `rolesFromAliases` semantic-collapse mapping.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  createTheme,
  aliasesFromSeeds,
  rolesFromAliases,
  defaultTheme,
  toRgb,
  contrastRatio,
  type ThemeColors,
  type Theme,
} from '../src/engine/index.js';

/**
 * A fully-populated 18-token alias set for the mapping tests. `accelerator` and `menuAccelerator`
 * are set to values distinct from `warning`/`danger` (and from each other) so a test can prove which
 * alias a given hotkey role reads.
 */
const SAMPLE18: ThemeColors = {
  foreground: '#e0e0e0',
  foregroundMuted: '#a0a0a0',
  foregroundDisabled: '#707070',
  foregroundOnAccent: '#ffffff',
  background: '#101010',
  backgroundRaised: '#202020',
  backgroundSunken: '#0a0a0a',
  backgroundSelected: '#303030',
  accent: '#3b82f6',
  accentMuted: '#2563eb',
  accelerator: '#00ffff',
  menuAccelerator: '#ff00ff',
  border: '#404040',
  borderMuted: '#303030',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#0ea5e9',
};

// ── ST-7: the alias tier is exactly 18 tokens, with no accentForeground ────────────────────────────

test('ST-7: ThemeColors is exactly 18 tokens (incl. the two accelerators) and has no accentForeground', () => {
  const keys = Object.keys(SAMPLE18);
  expect(keys.length, 'exactly 18 alias tokens').toBe(18);
  expect(keys, 'the in-dialog control accelerator alias').toContain('accelerator');
  expect(keys, 'the global-chrome accelerator alias').toContain('menuAccelerator');
  expect(keys, 'no dropped accentForeground synonym').not.toContain('accentForeground');
});

// ── ST-8: rolesFromAliases covers every role and is a Theme ─────────────────────────────────────────

test('ST-8: rolesFromAliases returns a full Theme with every defaultTheme role present', () => {
  const roles: Theme = rolesFromAliases(SAMPLE18); // must be assignable to Theme (compile-time completeness)
  for (const key of Object.keys(defaultTheme)) {
    expect(key in roles, `role ${key} present`).toBe(true);
  }
  // Structural extras survive the mapping.
  expect(typeof roles.desktop.pattern, 'desktop keeps a pattern glyph').toBe('string');
  expect('title' in roles.window, 'window keeps a title color').toBe(true);
  expect('title' in roles.historyWindow, 'historyWindow has no title').toBe(false);
});

// ── ST-9: createTheme produces only resolvable colors ──────────────────────────────────────────────

test('ST-9: every role in a createTheme output parses via toRgb without throwing', () => {
  const theme = createTheme({ mode: 'dark', accent: '#3b82f6' });
  for (const [name, role] of Object.entries(theme) as [keyof Theme, Theme[keyof Theme]][]) {
    expect(() => toRgb(role.fg), `${name}.fg resolvable`).not.toThrow();
    expect(() => toRgb(role.bg), `${name}.bg resolvable`).not.toThrow();
    for (const extra of ['border', 'title', 'icon', 'hotkey'] as const) {
      if (extra in role) {
        expect(() => toRgb((role as Record<string, string>)[extra]), `${name}.${extra} resolvable`).not.toThrow();
      }
    }
  }
});

// ── ST-10: overrides re-drive derived roles; roleOverrides are surgical ─────────────────────────────

test('ST-10: an accent override re-drives accent-derived roles', () => {
  const red = createTheme({ mode: 'light', accent: '#3b82f6', overrides: { accent: '#ff0000' } });
  expect(red.button.bg, 'button.bg follows the accent alias').toBe('#ff0000');
  expect(red.listFocused.bg, 'listFocused.bg follows the accent alias').toBe('#ff0000');
});

test('ST-10: a roleOverride changes only the targeted key', () => {
  const base = createTheme({ mode: 'dark', accent: '#3b82f6' });
  const tweaked = createTheme({ mode: 'dark', accent: '#3b82f6', roleOverrides: { desktop: { pattern: '▒' } } });
  expect(tweaked.desktop.pattern, 'pattern overridden').toBe('▒');
  expect(base.desktop.pattern, 'base pattern differs').not.toBe('▒');
  expect(tweaked.desktop.fg, 'desktop.fg unchanged').toBe(base.desktop.fg);
  expect(tweaked.desktop.bg, 'desktop.bg unchanged').toBe(base.desktop.bg);
  expect(tweaked.button, 'an unrelated role is untouched').toStrictEqual(base.button);
});

// ── ST-11: light mode yields a lighter background than dark mode ────────────────────────────────────

test('ST-11: light-mode background is lighter than dark-mode background', () => {
  const light = createTheme({ mode: 'light', accent: '#3b82f6' });
  const dark = createTheme({ mode: 'dark', accent: '#3b82f6' });
  // Contrast against black rises with luminance, so the lighter background contrasts more.
  expect(
    contrastRatio(light.desktop.bg, '#000000'),
    'light background contrasts black more than dark does',
  ).toBeGreaterThan(contrastRatio(dark.desktop.bg, '#000000'));
});

// ── Accelerator aliases ─────────────────────────────────────────────────────────────────────────────
// The two dedicated hotkey aliases drive every accelerator/shortcut role; `danger`/`warning` drive none.

test('in-dialog control hotkeys are sourced from the accelerator alias, not warning', () => {
  const roles = rolesFromAliases(SAMPLE18);
  for (const role of ['buttonFocused', 'tabActive', 'tabInactive'] as const) {
    expect(roles[role].hotkey, `${role}.hotkey follows accelerator`).toBe(SAMPLE18.accelerator);
    expect(roles[role].hotkey, `${role}.hotkey is not warning`).not.toBe(SAMPLE18.warning);
  }
  for (const role of ['labelShortcut', 'buttonShortcut', 'clusterShortcut'] as const) {
    expect(roles[role].fg, `${role}.fg follows accelerator`).toBe(SAMPLE18.accelerator);
    expect(roles[role].fg, `${role}.fg is not warning`).not.toBe(SAMPLE18.warning);
  }
});

test('global-chrome hotkeys are sourced from the menuAccelerator alias, not danger', () => {
  const roles = rolesFromAliases(SAMPLE18);
  for (const role of ['menuBar', 'menuSelected', 'statusBar', 'statusSelected'] as const) {
    expect(roles[role].hotkey, `${role}.hotkey follows menuAccelerator`).toBe(SAMPLE18.menuAccelerator);
    expect(roles[role].hotkey, `${role}.hotkey is not danger`).not.toBe(SAMPLE18.danger);
  }
});

test('overriding warning/danger moves no hotkey; overriding the accelerators does', () => {
  const statusMoved = createTheme({
    mode: 'dark',
    accent: '#3b82f6',
    overrides: { warning: '#00ff00', danger: '#ff0000' },
  });
  expect(statusMoved.labelShortcut.fg, 'warning override leaves the accelerator default').toBe('#f59e0b');
  expect(statusMoved.menuBar.hotkey, 'danger override leaves the menuAccelerator default').toBe('#ef4444');

  const acceleratorsMoved = createTheme({
    mode: 'dark',
    accent: '#3b82f6',
    overrides: { accelerator: '#00ffff', menuAccelerator: '#ffff00' },
  });
  expect(acceleratorsMoved.labelShortcut.fg, 'accelerator override drives control hotkeys').toBe('#00ffff');
  expect(acceleratorsMoved.menuBar.hotkey, 'menuAccelerator override drives chrome hotkeys').toBe('#ffff00');
});

test('a generated theme with no accelerator seeds keeps the historical hotkey colors', () => {
  const theme = createTheme({ mode: 'dark', accent: '#3b82f6' });
  expect(theme.labelShortcut.fg, 'control shortcut = historical amber').toBe('#f59e0b');
  expect(theme.buttonFocused.hotkey, 'focused-button hotkey = historical amber').toBe('#f59e0b');
  expect(theme.menuBar.hotkey, 'menu hotkey = historical red').toBe('#ef4444');
  expect(theme.statusBar.hotkey, 'status hotkey = historical red').toBe('#ef4444');
});

test('aliasesFromSeeds returns accelerator/menuAccelerator with independent defaults, overridable by seed', () => {
  const defaults = aliasesFromSeeds({ mode: 'dark', accent: '#3b82f6' });
  expect(defaults.accelerator, 'accelerator default').toBe('#f59e0b');
  expect(defaults.menuAccelerator, 'menuAccelerator default').toBe('#ef4444');

  const seeded = aliasesFromSeeds({
    mode: 'dark',
    accent: '#3b82f6',
    accelerator: '#abcdef',
    menuAccelerator: '#fedcba',
  });
  expect(seeded.accelerator, 'accelerator seed wins').toBe('#abcdef');
  expect(seeded.menuAccelerator, 'menuAccelerator seed wins').toBe('#fedcba');
});

test('overriding danger/warning changes only dangerText/warningText — no other role moves', () => {
  const seeds = { mode: 'dark', accent: '#3b82f6' } as const;
  const base = createTheme(seeds);
  const withStatusOverrides = createTheme({ ...seeds, overrides: { danger: '#010203', warning: '#040506' } });
  // danger/warning drive exactly the two severity-text roles; the override must move those and no others.
  expect(withStatusOverrides.dangerText.fg, 'danger override reaches dangerText.fg').toBe('#010203');
  expect(withStatusOverrides.warningText.fg, 'warning override reaches warningText.fg').toBe('#040506');
  for (const name of Object.keys(base) as (keyof Theme)[]) {
    if (name === 'dangerText' || name === 'warningText') continue;
    expect(withStatusOverrides[name], `${name} unchanged by a danger/warning override`).toStrictEqual(base[name]);
  }
});
