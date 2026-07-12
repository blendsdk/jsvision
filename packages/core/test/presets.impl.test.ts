/**
 * Implementation test — jsvision-ui RD-22 preset internals & round-trips.
 *
 * Complements presets.spec.test.ts (ST-21…ST-24) with per-preset serialize round-trips and the
 * monochrome state-by-attrs matrix. `.js` import extension per NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  serializeTheme,
  parseTheme,
  classicTheme,
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
  Attr,
  type Theme,
} from '../src/engine/index.js';

const PRESETS: Record<string, Theme> = {
  classicTheme,
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
};

test('every preset round-trips losslessly through serialize/parse', () => {
  for (const [name, theme] of Object.entries(PRESETS)) {
    expect(parseTheme(serializeTheme(theme)), `${name} round-trips`).toStrictEqual(theme);
  }
});

test('curated presets pin their canonical accent as the button face', () => {
  expect(nordTheme.button.bg, 'nord accent').toBe('#88c0d0');
  expect(draculaTheme.button.bg, 'dracula accent').toBe('#bd93f9');
  expect(solarizedDarkTheme.button.bg, 'solarized accent').toBe('#268bd2');
  expect(gruvboxDarkTheme.button.bg, 'gruvbox accent').toBe('#d79921');
});

test('monochrome distinguishes many states by attrs while sharing surface colors', () => {
  const pairs: [keyof Theme, keyof Theme][] = [
    ['button', 'buttonFocused'],
    ['listNormal', 'listFocused'],
    ['editorNormal', 'editorSelected'],
    ['statusBar', 'statusSelected'],
  ];
  for (const [normalKey, activeKey] of pairs) {
    const normal = monochromeTheme[normalKey];
    const active = monochromeTheme[activeKey];
    expect(active.fg, `${activeKey}.fg matches ${normalKey}`).toBe(normal.fg);
    expect(active.bg, `${activeKey}.bg matches ${normalKey}`).toBe(normal.bg);
    expect(active.attrs, `${activeKey} sets a distinguishing attr`).not.toBe(normal.attrs);
  }
});

test('monochrome full-width bars carry no base underline (only accelerator runs are underlined)', () => {
  // A whole-bar `underline` base attr paints under every fill cell, producing a continuous line
  // under the menu/status strip. The bars stand out by their inverted colors; underline is reserved
  // for the accelerator convention (the *Shortcut roles) and the calendar-today marker.
  const hasUnderline = (n: number | undefined): boolean => ((n ?? 0) & Attr.underline) !== 0;
  expect(hasUnderline(monochromeTheme.menuBar.attrs), 'menuBar not underlined').toBe(false);
  expect(hasUnderline(monochromeTheme.statusBar.attrs), 'statusBar not underlined').toBe(false);
  // The accelerator convention is preserved where it belongs.
  expect(hasUnderline(monochromeTheme.buttonShortcut.attrs), 'buttonShortcut underlined').toBe(true);
  expect(hasUnderline(monochromeTheme.clusterShortcut.attrs), 'clusterShortcut underlined').toBe(true);
});
