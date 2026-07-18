/**
 * Display-width helpers shared by the controls. These measure how many terminal columns a glyph or
 * string occupies, using the same width rules the screen buffer uses, so wrapping and centering math
 * agrees with what actually gets drawn (wide CJK/emoji = 2 columns, zero-width combining marks = 0).
 */
import { charWidth } from '@jsvision/core';
import type { WidthMode } from '@jsvision/core';

/** Width-resolution mode — matches the screen buffer so control math agrees with what is drawn. */
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
 * Display width of a string, summed over its glyphs. Use this to measure text the way the screen
 * buffer draws it — feed it to a grid's column-width / alignment math so auto-sized and CJK columns
 * line up with what actually renders (a naive `s.length` counts a wide glyph as one column and drifts).
 *
 * @param s The string to measure.
 * @returns The total display width in columns.
 * @example
 * ```ts
 * stringWidth('ab');   // 2 — two narrow glyphs
 * stringWidth('日本'); // 4 — each wide CJK glyph is 2 columns
 * ```
 */
export function stringWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += glyphWidth(ch);
  return w;
}
