/**
 * Small color helpers for the `demo:amiga-clock` showcase.
 *
 * `@jsvision/core` cells carry a 24-bit hex `Color`; the serializer downsamples (truecolor → 256 →
 * 16 → mono) to whatever the terminal reports. The boing-ball sphere needs per-cell shading, so this
 * module produces 24-bit colors and can dim a base color by a `0–1` factor for the lit/unlit faces.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */

/** An RGB triple with float channels in `0–255`. */
export type Rgb = readonly [r: number, g: number, b: number];

/** Clamp a float channel to an integer `0–255` and format it as two lowercase hex digits. */
function byte(channel: number): string {
  const value = Math.max(0, Math.min(255, Math.round(channel)));
  return value.toString(16).padStart(2, '0');
}

/**
 * Build a 24-bit hex color from float RGB channels (each `0–255`).
 *
 * @param r Red channel.
 * @param g Green channel.
 * @param b Blue channel.
 * @returns A `#rrggbb` color string.
 */
export function rgbHex(r: number, g: number, b: number): `#${string}` {
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * Dim (or brighten) an RGB base by a scalar factor and return it as a hex color. Used to shade the
 * boing ball: the lit side (`factor ≈ 1`) keeps the base color, the terminator (`factor ≈ 0.35`)
 * darkens it toward black, giving the sphere its 3-D roundness.
 *
 * @param base The base RGB triple.
 * @param factor Brightness multiplier (clamped to `>= 0`).
 * @returns A `#rrggbb` color string.
 */
export function shade(base: Rgb, factor: number): `#${string}` {
  const f = Math.max(0, factor);
  return rgbHex(base[0] * f, base[1] * f, base[2] * f);
}
