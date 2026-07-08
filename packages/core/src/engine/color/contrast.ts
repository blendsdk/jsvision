/**
 * WCAG contrast ratio between two colors — the check a theme designer uses to
 * catch unreadable foreground/background pairs.
 *
 * This is a pure measurement: it never adjusts colors, and it is never called
 * inside `createTheme`. Because the terminal's `'default'` color has no fixed
 * luminance, a pair involving it is *unknown* rather than *wrong* — the ratio is
 * `NaN` (never a throw), so a preview loop can treat it as "skip, no warning".
 */
import type { Color } from '../render/types.js';

import { toRgb, type Rgb } from './color.js';

/** WCAG relative luminance of an RGB color (linearized sRGB, Rec. 709 weights). */
function relativeLuminance(rgb: Rgb): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * Compute the WCAG 2.x contrast ratio between two colors, `1` (identical) to `21`
 * (black on white).
 *
 * The ratio is `(Llight + 0.05) / (Ldark + 0.05)` on relative luminance, so
 * argument order does not matter. WCAG AA wants ≥ 4.5 for body text and ≥ 3 for
 * large text. If **either** color is unresolvable (`'default'` — its luminance is
 * whatever the terminal picks), the result is `NaN`; the function never throws, so
 * it is safe to call inside a render/preview loop.
 *
 * @param a One color (hex, named, or `'default'`).
 * @param b The other color.
 * @returns The contrast ratio `1..21`, or `NaN` when a color is unresolvable.
 * @example
 * import { contrastRatio } from '@jsvision/core';
 *
 * contrastRatio('#000000', '#ffffff'); // 21 — maximum contrast
 * contrastRatio('#777777', '#808080'); // ~1.05 — far below the 4.5 AA floor
 * contrastRatio('default', '#ffffff'); // NaN — luminance unknown, skip the check
 */
export function contrastRatio(a: Color, b: Color): number {
  const rgbA = toRgb(a);
  const rgbB = toRgb(b);
  if (rgbA === null || rgbB === null) return NaN;
  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
