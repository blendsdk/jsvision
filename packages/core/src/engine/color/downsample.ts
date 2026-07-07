/**
 * Nearest-color downsampling — map a 24-bit color to the closest palette entry.
 *
 * When the terminal only supports 256 or 16 colors, a truecolor value has to be
 * approximated by the nearest palette slot. {@link nearest256}/{@link nearest16}
 * do that using "redmean" — a cheap, roughly perceptual color distance that
 * weights green most and shades red/blue by overall brightness, matching human
 * vision far better than a plain RGB distance. On a tie the lower index wins, so
 * the corner colors (pure black → 0, pure white → 15) always map exactly.
 */
import type { Rgb } from './color.js';

import { ANSI16_ORDER, ANSI16_REFERENCE, rgb256 } from './palette.js';

/**
 * Redmean weighted **squared** distance between two colors — larger when the
 * colors look more different. Returned squared (no `sqrt`) because only the
 * relative ordering matters when picking a nearest palette entry, and squaring
 * is monotonic, so skipping the root is faster and changes nothing.
 *
 * `rmean = (a.r+b.r)/2`,
 * `d² = (2 + rmean/256)·Δr² + 4·Δg² + (2 + (255-rmean)/256)·Δb²`.
 *
 * @param a One color.
 * @param b The other color.
 * @returns The squared redmean distance (≥ 0).
 */
export function redmean2(a: Rgb, b: Rgb): number {
  const rmean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db;
}

/**
 * Find the xterm-256 palette index (0–255) closest to an RGB color.
 *
 * Scans all 256 reference entries by redmean distance; on a tie the lower index
 * wins, so `#000000` → 0 and `#ffffff` → 15 stay exact instead of drifting into
 * the color cube.
 *
 * @param rgb The source color (from {@link toRgb}).
 * @returns The nearest palette index, 0–255.
 * @example
 * import { toRgb, nearest256 } from '@jsvision/core';
 *
 * nearest256(toRgb('#000000')!);  // → 0
 * nearest256(toRgb('#ffffff')!);  // → 15
 * nearest256({ r: 0x80, g: 0x80, b: 0x80 });  // → 244 (a gray-ramp slot)
 */
export function nearest256(rgb: Rgb): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < 256; index += 1) {
    const distance = redmean2(rgb, rgb256(index));
    // Strict `<` keeps the first (lowest) index on a tie.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/**
 * Find the ANSI-16 palette index (0–15) closest to an RGB color, where 0–7 are
 * the normal colors and 8–15 the bright variants.
 *
 * Same lowest-index tie rule as {@link nearest256}.
 *
 * @param rgb The source color (from {@link toRgb}).
 * @returns The nearest ANSI-16 index, 0–15.
 * @example
 * import { toRgb, nearest16 } from '@jsvision/core';
 *
 * nearest16(toRgb('#000000')!);  // → 0  (black)
 * nearest16(toRgb('#ffffff')!);  // → 15 (bright white)
 */
export function nearest16(rgb: Rgb): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < ANSI16_ORDER.length; index += 1) {
    const distance = redmean2(rgb, ANSI16_REFERENCE[ANSI16_ORDER[index]]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}
