/**
 * The shipped theme presets — ready-to-use {@link Theme}s covering the classic
 * classic DOS look, an attribute-driven monochrome scheme, and five popular
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
import {
  slateSeeds,
  nordSeeds,
  draculaSeeds,
  solarizedDarkSeeds,
  gruvboxDarkSeeds,
  janusSeeds,
  warpSeeds,
  solsticeSeeds,
  platinumSeeds,
  workbenchSeeds,
  horizonSeeds,
} from './preset-seeds.js';
import { defaultTheme, type Theme } from './theme.js';
import { Attr } from '../render/types.js';

export { PRESET_SEEDS } from './preset-seeds.js';

/**
 * The classic DOS "gray dialog / blue window" theme — an alias
 * of {@link defaultTheme} and the render-root default.
 *
 * @example
 * import { classicTheme } from '@jsvision/core';
 *
 * classicTheme.window.bg; // the classic blue
 */
export const classicTheme: Theme = defaultTheme;

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
  menuBar: { fg: B, bg: W, hotkey: B },
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
  inputPlaceholder: { fg: G, bg: B },
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
  sliderTrack: { fg: G, bg: B },
  sliderThumb: { fg: W, bg: B, attrs: REV },
  calendarNormal: { fg: W, bg: B },
  calendarToday: { fg: W, bg: B, attrs: UL },
  calendarSelected: { fg: W, bg: B, attrs: REV },
  calendarCursor: { fg: W, bg: B, attrs: BLD | REV },
  calendarDisabled: { fg: G, bg: B, attrs: DIM },
  calendarWeekNumber: { fg: G, bg: B },
  colorMarker: { fg: W, bg: B },
  gridCursor: { fg: W, bg: B, attrs: REV },
  gridDirty: { fg: W, bg: B, attrs: BLD },
  fileInfo: { fg: G, bg: B },
  editorNormal: { fg: W, bg: B },
  editorSelected: { fg: W, bg: B, attrs: REV },
  memoNormal: { fg: W, bg: B },
  memoSelected: { fg: W, bg: B, attrs: REV },
  indicatorNormal: { fg: G, bg: B },
  indicatorDragging: { fg: W, bg: B, attrs: BLD },
  terminalNormal: { fg: W, bg: B },
  statusBar: { fg: B, bg: W, hotkey: B },
  statusSelected: { fg: B, bg: W, hotkey: B, attrs: REV },
  shadow: { fg: G, bg: B },
  dangerText: { fg: W, bg: B },
  warningText: { fg: W, bg: B },
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
export const slateTheme: Theme = /* @__PURE__ */ createTheme(slateSeeds);

/**
 * The Nord palette — a cool arctic dark theme, with its canonical `nord0`
 * background, `snow storm` foreground, and `frost` accent pinned.
 *
 * @example
 * import { nordTheme } from '@jsvision/core';
 *
 * nordTheme.desktop.bg; // '#2e3440'
 */
export const nordTheme: Theme = /* @__PURE__ */ createTheme(nordSeeds);

/**
 * The Dracula palette — a dark theme with its signature purple accent and
 * `#282a36` background pinned.
 *
 * @example
 * import { draculaTheme } from '@jsvision/core';
 *
 * draculaTheme.desktop.bg; // '#282a36'
 */
export const draculaTheme: Theme = /* @__PURE__ */ createTheme(draculaSeeds);

/**
 * The Solarized Dark palette — a low-contrast dark theme with its `base03`
 * background and blue accent pinned.
 *
 * @example
 * import { solarizedDarkTheme } from '@jsvision/core';
 *
 * solarizedDarkTheme.desktop.bg; // '#002b36'
 */
export const solarizedDarkTheme: Theme = /* @__PURE__ */ createTheme(solarizedDarkSeeds);

/**
 * The Gruvbox Dark palette — a warm retro dark theme with its `bg0` background
 * and amber accent pinned.
 *
 * @example
 * import { gruvboxDarkTheme } from '@jsvision/core';
 *
 * gruvboxDarkTheme.desktop.bg; // '#282828'
 */
export const gruvboxDarkTheme: Theme = /* @__PURE__ */ createTheme(gruvboxDarkSeeds);

/**
 * A retro PC-desktop theme — a teal field, silver 3D chrome, black text, and a navy highlight for
 * the primary button, focus, and selection. High-contrast and easy to read.
 *
 * @example
 * import { janusTheme } from '@jsvision/core';
 *
 * janusTheme.desktop.bg; // '#008080' — the teal desktop
 */
export const janusTheme: Theme = /* @__PURE__ */ createTheme(janusSeeds);

/**
 * A Workplace-Shell-style theme — cool steel-blue surfaces over a mid steel field, with a deep
 * corporate blue accent for the primary button, focus, and selection.
 *
 * @example
 * import { warpTheme } from '@jsvision/core';
 *
 * warpTheme.desktop.bg; // '#567089' — the steel field
 */
export const warpTheme: Theme = /* @__PURE__ */ createTheme(warpSeeds);

/**
 * A Unix-workstation theme in the CDE / OpenWindows spirit — a sage field, warm putty chrome, and a
 * teal accent for the primary button, focus, and selection.
 *
 * @example
 * import { solsticeTheme } from '@jsvision/core';
 *
 * solsticeTheme.button.bg; // '#2a7d7d' — the teal accent
 */
export const solsticeTheme: Theme = /* @__PURE__ */ createTheme(solsticeSeeds);

/**
 * A classic-Mac Platinum theme — crisp grayscale surfaces with a restrained highlight blue for the
 * primary button, focus, and selection. Very high legibility.
 *
 * @example
 * import { platinumTheme } from '@jsvision/core';
 *
 * platinumTheme.button.bg; // '#3355bb' — the highlight blue
 */
export const platinumTheme: Theme = /* @__PURE__ */ createTheme(platinumSeeds);

/**
 * An Amiga-Workbench 1.x theme — an unmistakable blue field with white windows, black text, and an
 * orange accent for the primary button, focus, and selection.
 *
 * @example
 * import { workbenchTheme } from '@jsvision/core';
 *
 * workbenchTheme.desktop.bg; // '#0055aa' — the Workbench blue
 */
export const workbenchTheme: Theme = /* @__PURE__ */ createTheme(workbenchSeeds);

/**
 * A modern enterprise-software theme — a dark-blue shell field, white cards, and a clear corporate
 * blue accent for the primary button, focus, and selection.
 *
 * @example
 * import { horizonTheme } from '@jsvision/core';
 *
 * horizonTheme.button.bg; // '#0a6ed1' — the corporate blue
 */
export const horizonTheme: Theme = /* @__PURE__ */ createTheme(horizonSeeds);
