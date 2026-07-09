/**
 * The seed sets behind the {@link createTheme}-generated presets.
 *
 * Each preset theme references ONLY its own seed const, so importing one preset still lets a bundler
 * drop the others (their seeds and initializers tree-shake out); `PRESET_SEEDS` gathers them all as
 * reusable data — useful for a tool (e.g. a theme editor) that loads a preset as an *editable*
 * starting point — without breaking that per-preset isolation.
 *
 * The curated palettes override all 16 semantic aliases from each palette's published spec, so every
 * derived surface, border and status color is authentic rather than a generic ramp of one neutral;
 * `background` stays the palette's canonical backdrop and `accent` its signature color (and so its
 * button face).
 */
import type { ThemeOptions } from './create-theme.js';

const slateSeeds: ThemeOptions = { mode: 'dark', accent: '#5b7a99', neutral: '#64748b' };

const nordSeeds: ThemeOptions = {
  mode: 'dark',
  accent: '#88c0d0',
  overrides: {
    foreground: '#d8dee9',
    foregroundMuted: '#616e88',
    foregroundDisabled: '#4c566a',
    foregroundOnAccent: '#2e3440',
    background: '#2e3440',
    backgroundRaised: '#3b4252',
    backgroundSunken: '#272c36',
    backgroundSelected: '#434c5e',
    accent: '#88c0d0',
    accentMuted: '#5e81ac',
    border: '#4c566a',
    borderMuted: '#434c5e',
    danger: '#bf616a',
    warning: '#ebcb8b',
    success: '#a3be8c',
    info: '#81a1c1',
  },
};
const draculaSeeds: ThemeOptions = {
  mode: 'dark',
  accent: '#bd93f9',
  overrides: {
    foreground: '#f8f8f2',
    foregroundMuted: '#6272a4',
    foregroundDisabled: '#4d5066',
    foregroundOnAccent: '#282a36',
    background: '#282a36',
    backgroundRaised: '#343746',
    backgroundSunken: '#21222c',
    backgroundSelected: '#44475a',
    accent: '#bd93f9',
    accentMuted: '#9a75d6',
    border: '#6272a4',
    borderMuted: '#44475a',
    danger: '#ff5555',
    warning: '#f1fa8c',
    success: '#50fa7b',
    info: '#8be9fd',
  },
};
const solarizedDarkSeeds: ThemeOptions = {
  mode: 'dark',
  accent: '#268bd2',
  overrides: {
    foreground: '#839496',
    foregroundMuted: '#586e75',
    foregroundDisabled: '#465a61',
    foregroundOnAccent: '#fdf6e3',
    background: '#002b36',
    backgroundRaised: '#073642',
    backgroundSunken: '#00212b',
    backgroundSelected: '#0a3f4d',
    accent: '#268bd2',
    accentMuted: '#1e6ea3',
    border: '#586e75',
    borderMuted: '#073642',
    danger: '#dc322f',
    warning: '#b58900',
    success: '#859900',
    info: '#2aa198',
  },
};
const gruvboxDarkSeeds: ThemeOptions = {
  mode: 'dark',
  accent: '#d79921',
  overrides: {
    foreground: '#ebdbb2',
    foregroundMuted: '#928374',
    foregroundDisabled: '#7c6f64',
    foregroundOnAccent: '#282828',
    background: '#282828',
    backgroundRaised: '#3c3836',
    backgroundSunken: '#1d2021',
    backgroundSelected: '#504945',
    accent: '#d79921',
    accentMuted: '#b57614',
    border: '#665c54',
    borderMuted: '#504945',
    danger: '#cc241d',
    warning: '#d79921',
    success: '#98971a',
    info: '#689d6a',
  },
};

// Six retro-desktop palettes, each a faithful nod to an early-90s workstation look. `background` is
// the era's signature backdrop; the accent drives the primary button / focus fill.

// A nod to the early-90s PC desktop: a teal field, silver 3D chrome, and a navy highlight.
const janusSeeds: ThemeOptions = {
  mode: 'light',
  accent: '#000080',
  overrides: {
    foreground: '#000000',
    foregroundMuted: '#4d4d4d',
    foregroundDisabled: '#808080',
    foregroundOnAccent: '#ffffff',
    background: '#008080',
    backgroundRaised: '#c0c0c0',
    backgroundSunken: '#ffffff',
    backgroundSelected: '#a6a6a6',
    accent: '#000080',
    accentMuted: '#000050',
    border: '#000000',
    borderMuted: '#808080',
    danger: '#aa0000',
    warning: '#aa5500',
    success: '#00aa00',
    info: '#0000aa',
  },
};
// A nod to the OS/2 Workplace Shell: cool steel-blue surfaces and a deep corporate blue.
const warpSeeds: ThemeOptions = {
  mode: 'light',
  accent: '#1d3f73',
  overrides: {
    foreground: '#0a0a0a',
    foregroundMuted: '#3a4a5a',
    foregroundDisabled: '#7a8a9a',
    foregroundOnAccent: '#ffffff',
    background: '#567089',
    backgroundRaised: '#b8c4d0',
    backgroundSunken: '#dde4ec',
    backgroundSelected: '#9aabbd',
    accent: '#1d3f73',
    accentMuted: '#14284d',
    border: '#34506e',
    borderMuted: '#7f93a8',
    danger: '#a01818',
    warning: '#9a6a10',
    success: '#1d7a3a',
    info: '#2a6099',
  },
};
// A nod to the Sun CDE / OpenWindows desktop: a sage field, warm putty chrome, and a teal accent.
const solsticeSeeds: ThemeOptions = {
  mode: 'light',
  accent: '#2a7d7d',
  overrides: {
    foreground: '#1a1a1a',
    foregroundMuted: '#57544a',
    foregroundDisabled: '#8a8577',
    foregroundOnAccent: '#ffffff',
    background: '#64726b',
    backgroundRaised: '#c3c0b4',
    backgroundSunken: '#e6e3d8',
    backgroundSelected: '#a8a596',
    accent: '#2a7d7d',
    accentMuted: '#1d5757',
    border: '#57544a',
    borderMuted: '#9a9789',
    danger: '#9a2020',
    warning: '#9a6a10',
    success: '#2a7a3a',
    info: '#2a7d7d',
  },
};
// A nod to the classic Mac Platinum look: crisp grayscale with a restrained highlight blue.
const platinumSeeds: ThemeOptions = {
  mode: 'light',
  accent: '#3355bb',
  overrides: {
    foreground: '#000000',
    foregroundMuted: '#555555',
    foregroundDisabled: '#999999',
    foregroundOnAccent: '#ffffff',
    background: '#888888',
    backgroundRaised: '#dddddd',
    backgroundSunken: '#ffffff',
    backgroundSelected: '#b8b8b8',
    accent: '#3355bb',
    accentMuted: '#2a4494',
    border: '#000000',
    borderMuted: '#888888',
    danger: '#cc2222',
    warning: '#cc8800',
    success: '#228833',
    info: '#3355bb',
  },
};
// A nod to the Amiga Workbench 1.x palette: an unmistakable blue field with orange, white and black.
const workbenchSeeds: ThemeOptions = {
  mode: 'light',
  accent: '#ff8800',
  overrides: {
    foreground: '#000000',
    foregroundMuted: '#556677',
    foregroundDisabled: '#99a3b0',
    foregroundOnAccent: '#000000',
    background: '#0055aa',
    backgroundRaised: '#ffffff',
    backgroundSunken: '#eef2f7',
    backgroundSelected: '#ffcc88',
    accent: '#ff8800',
    accentMuted: '#d97400',
    border: '#0055aa',
    borderMuted: '#6a95c5',
    danger: '#cc0000',
    warning: '#ff8800',
    success: '#008800',
    info: '#0055aa',
  },
};
// A nod to modern enterprise-software UIs: a dark-blue shell, white cards, and a clear corporate blue.
const horizonSeeds: ThemeOptions = {
  mode: 'light',
  accent: '#0a6ed1',
  overrides: {
    foreground: '#32363a',
    foregroundMuted: '#6a6d70',
    foregroundDisabled: '#a9b4be',
    foregroundOnAccent: '#ffffff',
    background: '#354a5f',
    backgroundRaised: '#ffffff',
    backgroundSunken: '#f7f7f7',
    backgroundSelected: '#e5f0fa',
    accent: '#0a6ed1',
    accentMuted: '#085caf',
    border: '#d9d9d9',
    borderMuted: '#ededed',
    danger: '#bb0000',
    warning: '#e9730c',
    success: '#107e3e',
    info: '#0a6ed1',
  },
};

export {
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
};

/**
 * The seed sets behind the {@link createTheme}-generated presets, keyed by name — the same
 * `{ mode, accent, neutral, overrides }` options each curated theme is built from, exposed as data so
 * a tool (e.g. a theme editor) can load a preset as an *editable* starting point rather than an opaque
 * finished theme. The two literal presets (`turboVisionTheme`, `monochromeTheme`) are hand-authored
 * and have no seed form, so they are intentionally absent here.
 *
 * Importing `PRESET_SEEDS` pulls in every seed set; importing a single preset theme does not pull in
 * this map, so per-preset tree-shaking is preserved.
 *
 * @example
 * import { PRESET_SEEDS, createTheme } from '@jsvision/core';
 *
 * // Rebuild the Nord theme from its seeds, then tweak the accent.
 * const myNord = createTheme({ ...PRESET_SEEDS.nord, overrides: { accent: '#8fbcbb' } });
 */
export const PRESET_SEEDS: Record<
  | 'slate'
  | 'nord'
  | 'dracula'
  | 'solarized-dark'
  | 'gruvbox-dark'
  | 'janus'
  | 'warp'
  | 'solstice'
  | 'platinum'
  | 'workbench'
  | 'horizon',
  ThemeOptions
> = {
  slate: slateSeeds,
  nord: nordSeeds,
  dracula: draculaSeeds,
  'solarized-dark': solarizedDarkSeeds,
  'gruvbox-dark': gruvboxDarkSeeds,
  janus: janusSeeds,
  warp: warpSeeds,
  solstice: solsticeSeeds,
  platinum: platinumSeeds,
  workbench: workbenchSeeds,
  horizon: horizonSeeds,
};
