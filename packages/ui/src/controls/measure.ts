/**
 * Display-width helpers shared by the controls (RD-06). Wraps core's `charWidth` with the same
 * `wcwidth` mode `ScreenBuffer`/`DrawContext` use, so control wrap/centering math agrees with the
 * buffer (wide CJK/emoji = 2 columns, zero-width = 0). The `.js` extension in import specifiers is
 * required by NodeNext ESM resolution.
 */
import { charWidth } from '@jsvision/core';
import type { WidthMode } from '@jsvision/core';

/** Width-resolution mode — matches `ScreenBuffer`/`DrawContext` so control math agrees with the buffer. */
export const WIDTH_MODE: WidthMode = 'wcwidth';

/**
 * Display width of a single glyph.
 *
 * @param ch A single-glyph string.
 * @returns 0 (zero-width), 1 (narrow), or 2 (wide).
 */
export function glyphWidth(ch: string): number {
  return charWidth(ch.codePointAt(0) ?? 0, WIDTH_MODE);
}

/**
 * Display width of a string, summed over its glyphs.
 *
 * @param s The string to measure.
 * @returns The total display width in columns.
 */
export function stringWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += glyphWidth(ch);
  return w;
}
