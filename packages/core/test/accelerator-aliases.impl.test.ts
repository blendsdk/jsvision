/**
 * Implementation test — accelerator-alias internals.
 *
 * Covers seed precedence for the two accelerator aliases (seed beats default, override beats seed) and
 * an exhaustive proof that `danger`/`warning` drive no built-in role — they are app-reserved status
 * tokens after the accelerator decouple, so a sentinel value placed on either must never surface in any
 * role color, in either mode.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { createTheme, aliasesFromSeeds, type Theme, type ThemeRole } from '../src/engine/index.js';

/** Every color-valued field on a role (fg/bg + optional hotkey + structural color extras). */
function colorFields(role: ThemeRole): string[] {
  const r = role as Record<string, unknown>;
  const out: string[] = [role.fg, role.bg];
  for (const key of ['hotkey', 'border', 'title', 'icon']) {
    if (typeof r[key] === 'string') out.push(r[key] as string);
  }
  return out;
}

/** Every color across every role in a theme. */
function allColors(theme: Theme): string[] {
  return Object.values(theme).flatMap((role) => colorFields(role));
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

test('danger/warning drive no role in either mode — sentinel values never appear in any role color', () => {
  // Sentinel hexes unlikely to be produced by the neutral ramp or to equal another alias. If either
  // one surfaced in a role, some role would still be reading danger/warning — the decouple would leak.
  const sentinels: [string, string][] = [
    ['#dead01', '#beef02'],
    ['#c0ffee', '#faded0'],
  ];
  for (const mode of ['dark', 'light'] as const) {
    for (const [danger, warning] of sentinels) {
      const colors = allColors(createTheme({ mode, accent: '#3b82f6', overrides: { danger, warning } }));
      expect(colors, `${mode}: danger ${danger} absent from every role`).not.toContain(danger);
      expect(colors, `${mode}: warning ${warning} absent from every role`).not.toContain(warning);
    }
  }
});
