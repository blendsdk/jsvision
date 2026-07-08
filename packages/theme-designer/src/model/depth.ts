/**
 * Color-depth preview — how a single color renders once downsampled to each terminal depth. The
 * designer shows this as a small swatch strip beside the inspector so an author can see, e.g., what a
 * truecolor accent collapses to on a 16-color terminal.
 */
import { nearest256, nearest16, rgb256, toRgb, PALETTE } from '@jsvision/core';
import type { Color, ColorDepth, Rgb } from '@jsvision/core';

/**
 * The 16 terminal color slots (in `nearest16`'s index order) mapped to the Borland/DOS-16 `PALETTE`
 * keys — the canonical CGA correspondence. `PALETTE` *is* the Borland palette in this order under DOS
 * names: ANSI "yellow" is dark yellow (brown), low-intensity "white" is lightGray, "brightBlack" is
 * darkGray, "brightYellow" is yellow, "brightWhite" is white. Drawing the preview with these keeps the
 * depth strip in the same DOS-16 vocabulary as the rest of the designer.
 */
const DOS16_BY_SLOT: readonly (keyof typeof PALETTE)[] = [
  'black',
  'red',
  'green',
  'brown',
  'blue',
  'magenta',
  'cyan',
  'lightGray',
  'darkGray',
  'brightRed',
  'brightGreen',
  'yellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'white',
];

/** One depth's stand-in for a color: the depth, the resulting `#rrggbb`, and a short label. */
export interface DepthSample {
  readonly depth: ColorDepth;
  readonly hex: string;
  readonly label: string;
}

/** `#rrggbb` for an Rgb. */
function hexOf(rgb: Rgb): string {
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** Black or white, whichever a simple luminance threshold picks for `rgb` at mono depth. */
function monoOf(rgb: Rgb): string {
  const luma = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luma >= 128 ? '#ffffff' : '#000000';
}

/**
 * Compute how `color` looks at each terminal color depth: the color as-is (truecolor), its nearest
 * xterm-256 entry, its nearest DOS-16 palette color, and a mono black/white. A `'default'` or
 * otherwise unresolvable color has no fixed RGB, so it yields a single `n/a` row.
 *
 * @param color The color to preview.
 * @returns Four {@link DepthSample}s (truecolor/256/16/mono), or one `n/a` row for `'default'`.
 * @example
 * import { depthSamples } from './model/depth.js';
 *
 * depthSamples('#3b82f6').map((s) => `${s.depth}:${s.hex}`);
 * // e.g. ['truecolor:#3b82f6', '256:#5f87ff', '16:#5555ff', 'mono:#000000']
 */
export function depthSamples(color: Color): DepthSample[] {
  const rgb = toRgb(color);
  if (rgb === null) return [{ depth: 'truecolor', hex: '', label: 'n/a' }];
  return [
    { depth: 'truecolor', hex: hexOf(rgb), label: 'truecolor' },
    { depth: '256', hex: hexOf(rgb256(nearest256(rgb))), label: '256-color' },
    // The DOS-16 color for the slot the downsampler emits (kept in the designer's Borland palette).
    { depth: '16', hex: PALETTE[DOS16_BY_SLOT[nearest16(rgb)]], label: '16-color' },
    { depth: 'mono', hex: monoOf(rgb), label: 'mono' },
  ];
}
