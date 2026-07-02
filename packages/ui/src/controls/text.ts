/**
 * `Text` — a non-focusable static label (Turbo Vision `TStaticText`, RD-06 AR-100/PA-14).
 *
 * Renders a string or a reactive getter, word-wrapped on spaces and left-aligned, in the
 * `staticText` theme role. The wrap replicates `TStaticText::draw` (`tstatict.cpp:44-105`): greedily
 * fit whole words within the view width, hard-breaking a single word that is itself wider than the
 * view. Center/right alignment (TV's leading `0x03`) and the hardware caret are out of v1 (PA-14;
 * DEF-18). The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import { glyphWidth } from './measure.js';

/**
 * Word-wrap to `width` display columns, faithful to `TStaticText::draw` (`tstatict.cpp:44-105`): each
 * output line is a **verbatim** source substring — TV draws `s.substr(i, p-i)` between break points,
 * so **internal whitespace runs and leading indentation are preserved, not collapsed** (HR-57). Break
 * after the last whole word that fits; a single word wider than the view is hard-broken at the width
 * boundary; the break spaces are dropped from the next line's start (continuation lines are
 * left-flush). Explicit `\n` forces a line break.
 *
 * @param content The text to wrap.
 * @param width   The view width in display columns.
 * @returns The wrapped lines (at least one, possibly empty, per source paragraph).
 */
function wrapText(content: string, width: number): string[] {
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
        end = lastWordEnd; // break after the last whole word (TV backs up to the word boundary)
      } else {
        end = p > i ? p : i + 1; // a single word wider than the view → hard-break at the width edge
      }
      lines.push(paragraph.slice(i, end)); // verbatim — whitespace between words is kept
      let next = end;
      while (next < n && paragraph[next] === ' ') next += 1; // drop the break spaces before the next line
      i = fitsAll ? n : next;
    }
  }
  return lines;
}

/**
 * A static text view. Non-focusable (Tab skips it); paints word-wrapped, left-aligned text in the
 * `staticText` role.
 */
export class Text extends View {
  /** The literal text, or a reactive getter that repaints the view when its signals change. */
  protected readonly content: string | (() => string);

  /**
   * @param content A literal string, or a getter (`() => string`) that repaints `Text` on change.
   */
  constructor(content: string | (() => string)) {
    super();
    this.content = content;
    if (typeof content === 'function') {
      // Subscribe to the getter's signals so a change repaints (PA-14). Canonical site: onMount (PA-2).
      this.onMount(() => this.bind(content));
    }
  }

  /**
   * Paint the (resolved) content word-wrapped to the view width in the `staticText` role; rows beyond
   * the view height are clipped.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const content = typeof this.content === 'function' ? this.content() : this.content;
    const style = ctx.color('staticText');
    const { width, height } = ctx.size;
    ctx.fillRect(0, 0, width, height, ' ', style); // fill the field (TV moveChar ' ' per row)
    const lines = wrapText(content, width);
    for (let y = 0; y < height && y < lines.length; y += 1) {
      const line = lines[y];
      if (line !== undefined && line !== '') ctx.text(0, y, line, style);
    }
  }
}
