/**
 * Color parsing and validation for the rendering pipeline.
 *
 * `toRgb()` is the single point where a color string is validated and turned
 * into RGB. It accepts only three forms — `'default'`, one of the 16 named ANSI
 * colors, or a `#rgb`/`#rrggbb` hex string — and throws {@link InvalidColorError}
 * on anything else. It never returns a partial value, so a malformed color can
 * never leak arbitrary bytes into the escape-sequence stream.
 */
import type { Color } from '../render/types.js';
import { TuiError } from '../safety/errors.js';

import { ANSI16_REFERENCE, isAnsi16Name } from './palette.js';

/** RGB components, each an integer 0–255. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * Thrown when a color string is not a valid `#rgb`/`#rrggbb`, named, or
 * `'default'` value.
 *
 * Extends {@link TuiError}, so a single `catch (e) { if (e instanceof TuiError) }`
 * handles this alongside every other SDK error. Thrown by {@link toRgb} and
 * {@link encode}; note that {@link encodeStyle} deliberately swallows it and
 * degrades to no-color so a bad cell can never crash the render loop.
 *
 * @example
 * import { toRgb, InvalidColorError } from '@jsvision/core';
 *
 * try {
 *   toRgb('#zzz');
 * } catch (e) {
 *   if (e instanceof InvalidColorError) {
 *     console.error('bad color:', e.message);
 *   }
 * }
 */
export class InvalidColorError extends TuiError {}

/** A `#rgb` or `#rrggbb` hex color (case-insensitive). */
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validate a `Color` and parse it to RGB components.
 *
 * `'default'` returns `null` (meaning "leave the terminal's own default color"),
 * a named ANSI-16 color returns its reference RGB, and a `#rgb`/`#rrggbb` hex
 * string is parsed (the 3-digit form expands each nibble, so `#f00` === `#ff0000`).
 * Anything else throws — the value is never partially parsed.
 *
 * @param color The color to parse: `'default'`, a named ANSI-16 color (e.g.
 *   `'red'`, `'brightBlue'`), or a hex string.
 * @returns The `{ r, g, b }` components (each 0–255), or `null` for `'default'`.
 * @throws InvalidColorError when `color` is a malformed hex string or an unknown name.
 * @example
 * import { toRgb } from '@jsvision/core';
 *
 * toRgb('#ff0000');  // → { r: 255, g: 0, b: 0 }
 * toRgb('#f00');     // → { r: 255, g: 0, b: 0 }  (shorthand expands)
 * toRgb('default');  // → null  (keep the terminal default)
 */
export function toRgb(color: Color): Rgb | null {
  if (color === 'default') return null;
  if (color.startsWith('#')) {
    if (!HEX_RE.test(color)) throw new InvalidColorError(`Invalid hex color: ${color}`);
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  if (isAnsi16Name(color)) return ANSI16_REFERENCE[color];
  throw new InvalidColorError(`Unknown color: ${color}`);
}
