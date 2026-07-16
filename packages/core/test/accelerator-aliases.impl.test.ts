/**
 * Implementation test — accelerator-alias internals.
 *
 * Covers seed precedence for the two accelerator aliases (seed beats default, override beats seed) and
 * a scoped proof that `danger`/`warning` drive exactly the two severity-text roles — a sentinel placed
 * on either surfaces in its own role (`dangerText`/`warningText`) and in no other role, in either mode.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { createTheme, aliasesFromSeeds, type ThemeRole } from '../src/engine/index.js';

/** Every color-valued field on a role (fg/bg + optional hotkey + structural color extras). */
function colorFields(role: ThemeRole): string[] {
  const r = role as Record<string, unknown>;
  const out: string[] = [role.fg, role.bg];
  for (const key of ['hotkey', 'border', 'title', 'icon']) {
    if (typeof r[key] === 'string') out.push(r[key] as string);
  }
  return out;
}

test('an accelerator seed drives the control hotkeys; a menuAccelerator seed drives the chrome hotkeys', () => {
  const t = createTheme({ mode: 'dark', accent: '#3b82f6', accelerator: '#123456', menuAccelerator: '#654321' });
  for (const fg of [t.labelShortcut.fg, t.buttonShortcut.fg, t.clusterShortcut.fg]) {
    expect(fg, 'control shortcut fg follows the accelerator seed').toBe('#123456');
  }
  for (const hotkey of [t.buttonFocused.hotkey, t.tabActive.hotkey, t.tabInactive.hotkey]) {
    expect(hotkey, 'control hotkey follows the accelerator seed').toBe('#123456');
  }
  for (const hotkey of [t.menuBar.hotkey, t.menuSelected.hotkey, t.statusBar.hotkey, t.statusSelected.hotkey]) {
    expect(hotkey, 'chrome hotkey follows the menuAccelerator seed').toBe('#654321');
  }
});

test('overrides.accelerator/menuAccelerator win over the seed', () => {
  const t = createTheme({
    mode: 'dark',
    accent: '#3b82f6',
    accelerator: '#111111',
    menuAccelerator: '#222222',
    overrides: { accelerator: '#aaaaaa', menuAccelerator: '#bbbbbb' },
  });
  expect(t.labelShortcut.fg, 'override beats the accelerator seed').toBe('#aaaaaa');
  expect(t.menuBar.hotkey, 'override beats the menuAccelerator seed').toBe('#bbbbbb');
});

test('aliasesFromSeeds: an accelerator seed overrides the default, an absent seed falls back', () => {
  const base = aliasesFromSeeds({ mode: 'dark', accent: '#3b82f6' });
  expect(base.accelerator, 'accelerator default').toBe('#f59e0b');
  expect(base.menuAccelerator, 'menuAccelerator default').toBe('#ef4444');

  const seeded = aliasesFromSeeds({
    mode: 'dark',
    accent: '#3b82f6',
    accelerator: '#0f0f0f',
    menuAccelerator: '#0e0e0e',
  });
  expect(seeded.accelerator, 'accelerator seed wins over default').toBe('#0f0f0f');
  expect(seeded.menuAccelerator, 'menuAccelerator seed wins over default').toBe('#0e0e0e');
});

test('danger/warning drive exactly dangerText/warningText — the sentinel lands there and leaks nowhere else', () => {
  // Sentinel hexes unlikely to be produced by the neutral ramp or to equal another alias. Each must
  // surface in its own severity-text role and in NO other role — proof danger/warning drive those two
  // roles and nothing more.
  const sentinels: [string, string][] = [
    ['#dead01', '#beef02'],
    ['#c0ffee', '#faded0'],
  ];
  for (const mode of ['dark', 'light'] as const) {
    for (const [danger, warning] of sentinels) {
      const theme = createTheme({ mode, accent: '#3b82f6', overrides: { danger, warning } });
      expect(theme.dangerText.fg, `${mode}: danger ${danger} drives dangerText.fg`).toBe(danger);
      expect(theme.warningText.fg, `${mode}: warning ${warning} drives warningText.fg`).toBe(warning);
      // Every OTHER role must be free of both sentinels (no leak beyond the two intended roles).
      const otherColors = Object.entries(theme)
        .filter(([name]) => name !== 'dangerText' && name !== 'warningText')
        .flatMap(([, role]) => colorFields(role as ThemeRole));
      expect(otherColors, `${mode}: danger ${danger} absent from every other role`).not.toContain(danger);
      expect(otherColors, `${mode}: warning ${warning} absent from every other role`).not.toContain(warning);
    }
  }
});
