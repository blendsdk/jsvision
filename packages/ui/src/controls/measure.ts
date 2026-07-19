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

/**
 * Word-wrap `content` to `width` display columns — the same wrapping a {@link Text} view applies
 * when it draws. Reach for it when you need the line count *before* laying anything out, e.g. to
 * size a dialog tall enough that its message cannot be clipped.
 *
 * Each output line is a verbatim slice of the source, so whitespace *between* words and leading
 * indentation are preserved, not collapsed. The wrap breaks after the last whole word that fits; a
 * single word wider than the view is hard-broken at the width boundary; the spaces at a break are
 * dropped from the start of the next line. An explicit `\n` always forces a line break, and a blank
 * source line stays a blank output line. A `width` of zero or less yields no lines at all.
 *
 * Widths are measured in display columns, not characters, so CJK and emoji wrap where they actually
 * render rather than where `String.length` would guess. One consequence is worth knowing: a single
 * glyph wider than `width` (a 2-column CJK character at width 1) is emitted on its own line anyway,
 * so wrapping always terminates. That is the only case an output line can exceed `width`.
 *
 * @param content The text to wrap.
 * @param width   The available width in display columns.
 * @returns The wrapped lines (at least one, possibly empty, per source paragraph).
 * @example
 * ```ts
 * wrapText('the quick brown fox', 10); // ['the quick', 'brown fox']
 * wrapText('one\n\ntwo', 10);          // ['one', '', 'two'] — the blank line survives
 *
 * // Size a message box so nothing is clipped: frame (2) + button band (2) + the wrapped text.
 * const height = wrapText(message, width - 2).length + 4;
 * ```
 */
export function wrapText(content: string, width: number): string[] {
  const lines: string[] = [];
  if (width <= 0) return lines;
  for (const paragraph of content.split('\n')) {
    const n = paragraph.length;
    if (n === 0) {
      lines.push(''); // a blank source line stays a blank output line
      continue;
    }
    let i = 0; // the start index of the current output line
    while (i < n) {
      let p = i;
      let w = 0;
      let lastWordEnd = -1; // index just past the last whole word that fits within `width`
      let fitsAll = true;
      while (p < n) {
        const ch = paragraph[p] ?? ' ';
        const cw = glyphWidth(ch);
        if (w + cw > width) {
          fitsAll = false;
          break;
        }
        w += cw;
        p += 1;
        if (ch !== ' ' && (p >= n || paragraph[p] === ' ')) lastWordEnd = p; // just passed a word-end
      }
      let end: number; // exclusive end of this line's verbatim source
      if (fitsAll) {
        end = n;
      } else if (lastWordEnd > i) {
        end = lastWordEnd; // back up to break after the last whole word that fit
      } else {
        end = p > i ? p : i + 1; // one word wider than the view: hard-break at the width edge
      }
      lines.push(paragraph.slice(i, end)); // verbatim — whitespace between words is kept
      let next = end;
      while (next < n && paragraph[next] === ' ') next += 1; // drop the break spaces before the next line
      i = fitsAll ? n : next;
    }
  }
  return lines;
}
