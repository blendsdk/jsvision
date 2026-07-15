/**
 * Public API of the color & styling subsystem: depth-aware escape-sequence
 * encoding, color validation, nearest-color downsampling, the DOS-16 palette,
 * and the semantic theme.
 *
 * Re-exports: {@link encode}/{@link encodeStyle} (color + attribute encoding),
 * {@link nearest256}/{@link nearest16} (downsampling), {@link styleKey} (a cache
 * key), {@link toRgb}/{@link InvalidColorError} (validation), the {@link PALETTE}
 * and {@link ANSI16_ORDER} color sets, and the {@link Theme}/{@link defaultTheme}
 * semantic role map.
 */

// Color + attribute encoding to escape sequences.
export { encode, encodeStyle, styleKey } from './encode.js';
export type { ColorRole } from './encode.js';

// Nearest-color downsampling primitives.
export { nearest256, nearest16 } from './downsample.js';

// Color validation + typed error. `toRgb` is the single validation boundary.
export { InvalidColorError, toRgb } from './color.js';
export type { Rgb } from './color.js';

// App-facing palette + semantic theme. `ANSI16_ORDER` is the DOS-16 swatch order; `rgb256` gives the
// reference RGB of an xterm-256 palette index (used to preview a downsampled color).
export { PALETTE, ANSI16_ORDER, rgb256 } from './palette.js';
export { defaultTheme } from './theme.js';
export type { Theme, ThemeRole } from './theme.js';

// Perceptual OKLab color math + the WCAG contrast helper, and the semantic alias tier.
export { ramp, lighten, darken, mix } from './ramp.js';
export { contrastRatio } from './contrast.js';
export type { ThemeColors } from './aliases.js';

// Theme builder — seeds → 18 aliases → 67 roles. `aliasesFromSeeds` exposes the seed→alias step alone.
export { createTheme, aliasesFromSeeds } from './create-theme.js';
export { rolesFromAliases } from './roles.js';
export type { ThemeOptions } from './create-theme.js';

// Lossless, injection-safe theme serialization.
export { serializeTheme, parseTheme, InvalidThemeError } from './serialize.js';

// Shipped theme presets (tree-shakeable named exports) + the derived presets' seed sets as data.
export {
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
  PRESET_SEEDS,
} from './presets.js';
