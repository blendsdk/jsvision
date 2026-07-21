/**
 * Display-width helpers shared by the controls, plus the word-wrap built on them. The measures report
 * how many terminal columns a glyph or string occupies, using the same width rules the screen buffer
 * uses, so wrapping and centering math agrees with what actually gets drawn (wide CJK/emoji = 2
 * columns, zero-width combining marks = 0). {@link wrapText} is the wrap a `Text` view draws with,
 * exposed here so a caller can pre-count the lines a message will need.
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
 * import { stringWidth } from '@jsvision/ui';
 *
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
 * Widths are measured in display columns rather than characters, so wide CJK glyphs wrap where they
 * actually render instead of where `String.length` would guess. A glyph too wide to ever fit — a
 * 2-column character at width 1 — is still emitted on its own line, so wrapping always terminates.
 *
 * The scan walks whole code points, so an astral character (most emoji) is one glyph and a break
 * never falls between the halves of a surrogate pair. **Grapheme clusters are still not handled**: a
 * ZWJ sequence, a skin-tone modifier, or a flag is several code points and may wrap between them.
 *
 * @param content The text to wrap.
 * @param width   The available width in display columns.
 * @returns The wrapped lines — one or more per source paragraph, or an empty array when `width` is
 *          zero or less.
 * @example
 * ```ts
 * import { wrapText } from '@jsvision/ui';
 *
 * wrapText('the quick brown fox', 10); // ['the quick', 'brown fox']
 * wrapText('one\n\ntwo', 10);          // ['one', '', 'two'] — the blank line survives
 *
 * // Size a message box so nothing is clipped: frame (2) + button band (2) + the wrapped text.
 * const message = 'The file could not be opened.';
 * const width = 40;
 * const height = wrapText(message, width - 2).length + 4; // 5
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
      let stopWidth = 1; // UTF-16 length of the glyph that did not fit (2 for a surrogate pair)
      while (p < n) {
        // Read a whole code point, not a code unit: an astral character occupies two UTF-16 slots,
        // and treating those as separate glyphs would let a break land between them — emitting lone
        // surrogates, which no terminal can draw. A malformed lone surrogate in the input reads back
        // as itself with length 1, so the scan still advances and the wrap terminates.
        const ch = String.fromCodePoint(paragraph.codePointAt(p) ?? 32);
        const cw = glyphWidth(ch);
        if (w + cw > width) {
          fitsAll = false;
          stopWidth = ch.length;
          break;
        }
        w += cw;
        p += ch.length;
        if (ch !== ' ' && (p >= n || paragraph[p] === ' ')) lastWordEnd = p; // just passed a word-end
      }
      let end: number; // exclusive end of this line's verbatim source
      if (fitsAll) {
        end = n;
      } else if (lastWordEnd > i) {
        end = lastWordEnd; // back up to break after the last whole word that fit
      } else {
        // One glyph wider than the whole view: emit it alone so the wrap makes progress. It must be
        // the WHOLE glyph — advancing a single code unit here would slice a surrogate pair in half.
        end = p > i ? p : i + stopWidth;
      }
      lines.push(paragraph.slice(i, end)); // verbatim — whitespace between words is kept
      let next = end;
      while (next < n && paragraph[next] === ' ') next += 1; // drop the break spaces before the next line
      i = fitsAll ? n : next;
    }
  }
  return lines;
}
