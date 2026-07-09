/**
 * Color reference tables used by depth-aware encoding, plus the app-facing
 * DOS-16 palette.
 *
 * The reference tables ({@link ANSI16_REFERENCE}, {@link rgb256}) define the
 * canonical RGB of each terminal palette slot, so downsampling can pick the
 * nearest match. The app-facing {@link PALETTE} is the classic Borland 16-color
 * set as ready-to-use `#rrggbb` values you assign to theme roles or cells.
 */
import type { Ansi16Name, Color } from '../render/types.js';
import type { Rgb } from './color.js';

/**
 * The 16 named ANSI colors as 24-bit reference RGB (the common xterm palette).
 * These are the targets {@link nearest16} matches against, and they seed the
 * first 16 entries of the xterm-256 table so both depths agree.
 */
export const ANSI16_REFERENCE: Record<Ansi16Name, Rgb> = {
  black: { r: 0, g: 0, b: 0 },
  red: { r: 205, g: 0, b: 0 },
  green: { r: 0, g: 205, b: 0 },
  yellow: { r: 205, g: 205, b: 0 },
  blue: { r: 0, g: 0, b: 238 },
  magenta: { r: 205, g: 0, b: 205 },
  cyan: { r: 0, g: 205, b: 205 },
  white: { r: 229, g: 229, b: 229 },
  brightBlack: { r: 127, g: 127, b: 127 },
  brightRed: { r: 255, g: 0, b: 0 },
  brightGreen: { r: 0, g: 255, b: 0 },
  brightYellow: { r: 255, g: 255, b: 0 },
  brightBlue: { r: 92, g: 92, b: 255 },
  brightMagenta: { r: 255, g: 0, b: 255 },
  brightCyan: { r: 0, g: 255, b: 255 },
  brightWhite: { r: 255, g: 255, b: 255 },
};

/**
 * The 16 ANSI names in palette-index order: 0–7 normal, 8–15 bright. `nearest16`
 * returns an index into this list, which maps to the SGR codes 30–37/90–97.
 */
export const ANSI16_ORDER: readonly Ansi16Name[] = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
];

const NAME_SET: ReadonlySet<string> = new Set(ANSI16_ORDER);

/** Type guard: whether `value` is one of the 16 named ANSI colors. */
export function isAnsi16Name(value: string): value is Ansi16Name {
  return NAME_SET.has(value);
}

/** The six per-channel levels of the xterm 6×6×6 color cube. */
const CUBE_LEVELS: readonly number[] = [0, 95, 135, 175, 215, 255];

/**
 * Reference RGB for xterm-256 palette index `n` (0–255): the 16 base colors
 * (0–15), the 6×6×6 cube (16–231), then the 24-step gray ramp (232–255).
 *
 * Pair it with {@link nearest256} to preview how a truecolor value looks once
 * downsampled to the 256-color palette.
 *
 * @param index An integer 0–255.
 * @returns The reference RGB for that palette entry.
 * @example
 * import { rgb256, nearest256 } from '@jsvision/core';
 *
 * const rgb = rgb256(nearest256({ r: 59, g: 130, b: 246 })); // the 256-color stand-in for #3b82f6
 */
export function rgb256(index: number): Rgb {
  if (index < 16) return ANSI16_REFERENCE[ANSI16_ORDER[index]];
  if (index < 232) {
    const i = index - 16;
    return {
      r: CUBE_LEVELS[Math.floor(i / 36) % 6],
      g: CUBE_LEVELS[Math.floor(i / 6) % 6],
      b: CUBE_LEVELS[i % 6],
    };
  }
  const level = 8 + (index - 232) * 10;
  return { r: level, g: level, b: level };
}

/**
 * The classic Borland / DOS 16-color palette as ready-to-use `#rrggbb` colors.
 *
 * Each value is a valid {@link Color} you can assign directly to a cell or a
 * theme role; it encodes through the normal {@link encode} path (and downsamples
 * on low-color terminals). This is the palette you build UIs with — distinct from
 * the {@link ANSI16_REFERENCE} table above, which exists only to drive matching.
 *
 * @example
 * import { PALETTE } from '@jsvision/core';
 *
 * const titleFg = PALETTE.brightWhite;  // '#ffffff'
 * const titleBg = PALETTE.blue;         // '#0000aa'
 */
export const PALETTE = {
  black: '#000000',
  blue: '#0000aa',
  green: '#00aa00',
  cyan: '#00aaaa',
  red: '#aa0000',
  magenta: '#aa00aa',
  brown: '#aa5500',
  lightGray: '#aaaaaa',
  darkGray: '#555555',
  brightBlue: '#5555ff',
  brightGreen: '#55ff55',
  brightCyan: '#55ffff',
  brightRed: '#ff5555',
  brightMagenta: '#ff55ff',
  yellow: '#ffff55',
  white: '#ffffff',
} as const satisfies Record<string, Color>;
