/**
 * The shipped theme presets — ready-to-use {@link Theme}s covering the classic
 * Turbo Vision look, an attribute-driven monochrome scheme, and five popular
 * dark/enterprise palettes.
 *
 * Each preset is an independent named export, so importing one tree-shakes the
 * rest out of your bundle. The curated palettes are generated with
 * {@link createTheme} and pin their canonical background/foreground/accent hexes
 * via `overrides`, so the recognizable colors appear regardless of ramp rounding;
 * every preset round-trips through {@link serializeTheme}/{@link parseTheme}.
 */
import type { AttrMask } from '../render/types.js';

import { createTheme } from './create-theme.js';
import { defaultTheme, type Theme } from './theme.js';
import { Attr } from '../render/types.js';

/**
 * The classic Borland / Turbo Vision "gray dialog / blue window" theme — an alias
 * of {@link defaultTheme} and the render-root default.
 *
 * @example
 * import { turboVisionTheme } from '@jsvision/core';
 *
 * turboVisionTheme.window.bg; // the classic blue
 */
export const turboVisionTheme: Theme = defaultTheme;

// Achromatic building blocks for the monochrome preset.
const W = '#ffffff';
const B = '#000000';
const G = '#808080';
const REV: AttrMask = Attr.reverse;
const BLD: AttrMask = Attr.bold;
const DIM: AttrMask = Attr.dim;
const UL: AttrMask = Attr.underline;

/**
 * A color-free theme that distinguishes state by **text attribute** (reverse /
 * bold / dim / underline) rather than hue — the readable choice on a monochrome
 * terminal, and a working demonstration of the {@link ThemeRole} `attrs` axis.
 *
 * Every role uses only black, white, or gray; focused/selected surfaces reuse
 * their normal color and add `reverse`, so nothing depends on color depth.
 *
 * @example
 * import { monochromeTheme } from '@jsvision/core';
 *
 * monochromeTheme.listFocused.attrs; // reverse — focus shown without color
 */
export const monochromeTheme: Theme = {
  desktop: { fg: G, bg: B, pattern: '░' },
  menuBar: { fg: B, bg: W, hotkey: B, attrs: UL },
  menuSelected: { fg: B, bg: W, hotkey: B, attrs: REV },
  window: { fg: W, bg: B, border: W, title: W, icon: W },
  windowInactive: { fg: G, bg: B, border: G, title: G, icon: G },
  dialog: { fg: W, bg: B, border: W, title: W, icon: W },
  button: { fg: B, bg: W },
  buttonFocused: { fg: B, bg: W, hotkey: B, attrs: REV },
  staticText: { fg: W, bg: B },
  label: { fg: W, bg: B },
  labelSelected: { fg: W, bg: B, attrs: BLD },
  labelShortcut: { fg: W, bg: B, attrs: UL },
  buttonDefault: { fg: B, bg: W, attrs: BLD },
  buttonDisabled: { fg: G, bg: W, attrs: DIM },
  buttonShortcut: { fg: B, bg: W, attrs: UL },
  buttonShadow: { fg: G, bg: B },
  clusterNormal: { fg: W, bg: B },
  clusterSelected: { fg: W, bg: B, attrs: REV },
  clusterShortcut: { fg: W, bg: B, attrs: UL },
  clusterDisabled: { fg: G, bg: B, attrs: DIM },
  inputNormal: { fg: W, bg: B },
  inputSelected: { fg: W, bg: B },
  inputSelection: { fg: W, bg: B, attrs: REV },
  inputArrows: { fg: W, bg: B },
  scrollBarPage: { fg: G, bg: B },
  scrollBarControls: { fg: W, bg: B },
  listNormal: { fg: W, bg: B },
  listFocused: { fg: W, bg: B, attrs: REV },
  listSelected: { fg: W, bg: B, attrs: BLD },
  listDivider: { fg: G, bg: B },
  tableHeader: { fg: W, bg: B, attrs: BLD },
  historyButtonSides: { fg: W, bg: B },
  historyButtonArrow: { fg: B, bg: W },
  historyWindow: { fg: W, bg: B, border: W, icon: W },
  historyViewer: { fg: W, bg: B },
  historyViewerFocused: { fg: W, bg: B, attrs: REV },
  outlineNormal: { fg: W, bg: B },
  outlineFocused: { fg: W, bg: B, attrs: REV },
  outlineSelected: { fg: W, bg: B, attrs: BLD },
  outlineNotExpanded: { fg: W, bg: B },
  tabActive: { fg: W, bg: B, attrs: BLD },
  tabInactive: { fg: W, bg: B },
  tabDisabled: { fg: G, bg: B, attrs: DIM },
  progressFill: { fg: W, bg: B, attrs: REV },
  progressTrack: { fg: G, bg: B },
  calendarNormal: { fg: W, bg: B },
  calendarToday: { fg: W, bg: B, attrs: UL },
  calendarSelected: { fg: W, bg: B, attrs: REV },
  calendarCursor: { fg: W, bg: B, attrs: BLD | REV },
  calendarDisabled: { fg: G, bg: B, attrs: DIM },
  calendarWeekNumber: { fg: G, bg: B },
  colorMarker: { fg: W, bg: B },
  fileInfo: { fg: G, bg: B },
  editorNormal: { fg: W, bg: B },
  editorSelected: { fg: W, bg: B, attrs: REV },
  memoNormal: { fg: W, bg: B },
  memoSelected: { fg: W, bg: B, attrs: REV },
  indicatorNormal: { fg: G, bg: B },
  indicatorDragging: { fg: W, bg: B, attrs: BLD },
  terminalNormal: { fg: W, bg: B },
  statusBar: { fg: B, bg: W, hotkey: B, attrs: UL },
  statusSelected: { fg: B, bg: W, hotkey: B, attrs: REV },
  shadow: { fg: G, bg: B },
};

/**
 * An enterprise muted blue-gray theme — a calm, low-saturation dark scheme
 * generated from a slate accent and neutral.
 *
 * @example
 * import { slateTheme } from '@jsvision/core';
 *
 * slateTheme.button.bg; // the slate accent
 */
export const slateTheme: Theme = /* @__PURE__ */ createTheme({
  mode: 'dark',
  accent: '#5b7a99',
  neutral: '#64748b',
});

/**
 * The Nord palette — a cool arctic dark theme, with its canonical `nord0`
 * background, `snow storm` foreground, and `frost` accent pinned.
 *
 * @example
 * import { nordTheme } from '@jsvision/core';
 *
 * nordTheme.desktop.bg; // '#2e3440'
 */
export const nordTheme: Theme = /* @__PURE__ */ createTheme({
  mode: 'dark',
  accent: '#88c0d0',
  neutral: '#4c566a',
  overrides: { background: '#2e3440', foreground: '#d8dee9', accent: '#88c0d0' },
});

/**
 * The Dracula palette — a dark theme with its signature purple accent and
 * `#282a36` background pinned.
 *
 * @example
 * import { draculaTheme } from '@jsvision/core';
 *
 * draculaTheme.desktop.bg; // '#282a36'
 */
export const draculaTheme: Theme = /* @__PURE__ */ createTheme({
  mode: 'dark',
  accent: '#bd93f9',
  neutral: '#44475a',
  overrides: { background: '#282a36', foreground: '#f8f8f2', accent: '#bd93f9' },
});

/**
 * The Solarized Dark palette — a low-contrast dark theme with its `base03`
 * background and blue accent pinned.
 *
 * @example
 * import { solarizedDarkTheme } from '@jsvision/core';
 *
 * solarizedDarkTheme.desktop.bg; // '#002b36'
 */
export const solarizedDarkTheme: Theme = /* @__PURE__ */ createTheme({
  mode: 'dark',
  accent: '#268bd2',
  neutral: '#586e75',
  overrides: { background: '#002b36', foreground: '#839496', accent: '#268bd2' },
});

/**
 * The Gruvbox Dark palette — a warm retro dark theme with its `bg0` background
 * and amber accent pinned.
 *
 * @example
 * import { gruvboxDarkTheme } from '@jsvision/core';
 *
 * gruvboxDarkTheme.desktop.bg; // '#282828'
 */
export const gruvboxDarkTheme: Theme = /* @__PURE__ */ createTheme({
  mode: 'dark',
  accent: '#d79921',
  neutral: '#928374',
  overrides: { background: '#282828', foreground: '#ebdbb2', accent: '#d79921' },
});
