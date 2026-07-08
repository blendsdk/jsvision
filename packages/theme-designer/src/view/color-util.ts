/**
 * Small color conversions the inspector uses to sync its R/G/B sliders, hex field, and swatch — all
 * built on core's `toRgb` validation boundary.
 */
import { toRgb } from '@jsvision/core';
import type { Color } from '@jsvision/core';

/** A 0–255 channel as a clamped, rounded two-digit hex. */
export function channelHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

/** Compose a `#rrggbb` {@link Color} from three 0–255 channels (always a well-formed hex color). */
export function composeHex(r: number, g: number, b: number): Color {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`;
}

/** A color's R/G/B channels (0,0,0 for `'default'`/unresolvable). */
export function toChannels(c: Color): { r: number; g: number; b: number } {
  return toRgb(c) ?? { r: 0, g: 0, b: 0 };
}

/** Normalize a color to `#rrggbb`, or leave it as-is when it has no RGB (e.g. `'default'`). */
export function normalizeHex(c: Color): string {
  const rgb = toRgb(c);
  return rgb ? composeHex(rgb.r, rgb.g, rgb.b) : String(c);
}
