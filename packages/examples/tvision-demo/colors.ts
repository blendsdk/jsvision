/**
 * Small color helpers for the `demo:tvision` truecolor showcase.
 *
 * Turbo Vision targeted EGA/VGA — 16 fixed colors. `@jsvision/core` cells carry a 24-bit hex
 * `Color`, and the serializer downsamples (truecolor → 256 → 16 → mono) to whatever the terminal
 * reports. This module produces those 24-bit colors; the gradient window is the visible proof.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */

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
 * Convert an HSV triple to a 24-bit hex color. Used to sweep a smooth hue gradient across
 * the truecolor window.
 *
 * @param h Hue in degrees (wrapped into `[0, 360)`).
 * @param s Saturation in `[0, 1]`.
 * @param v Value/brightness in `[0, 1]`.
 * @returns A `#rrggbb` color string.
 */
export function hsv(h: number, s: number, v: number): `#${string}` {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = v - c;
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
