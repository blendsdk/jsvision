/**
 * Turn one logical line of the buffer into the sequence of visual cells to paint on one screen row.
 * Pure — it reads the buffer and the selection range, and returns cells; it never writes anything.
 *
 * What it handles for you:
 *   • Selection colouring: each cell is flagged `selected` when its position falls in the selection
 *     range, so the caller can paint runs in the normal vs. selected theme colours.
 *   • Tabs expand to the next 8-column stop; every other cluster advances by its display width.
 *   • Horizontal scroll: only text past `hScroll` is emitted. A tab or wide glyph straddling the
 *     left edge renders as spaces for its visible width — never a split cell.
 *   • A wide glyph straddling the right edge is emitted whole; the caller's screen buffer clips it.
 *   • The row is padded with spaces out to `width`; the padding takes the colour of the position
 *     just past the text, so a selection that runs through the line break paints the padding too.
 *
 * Cell contents are passed through raw; control characters are made inert later, at the point where
 * the row is written to the screen — that is not this function's concern.
 */
import { stringWidth } from '../controls/measure.js';
import { nextClusterEnd } from './buffer/segment.js';
import { lineEnd } from './buffer/navigate.js';
import type { BufText } from './buffer/gap.js';

/** One visual cell of a formatted row: the glyph (a whole cluster), its role, and its width. */
export interface FormatCell {
  /** The cluster to draw (`' '` for tab fills, h-scroll stubs, and padding). */
  ch: string;
  /** `true` when this cell falls within the selection (paint it in the selected colour). */
  selected: boolean;
  /** Display width in columns (a wide CJK/emoji cluster is 2). */
  width: 1 | 2;
}

/**
 * Format one visual row from the buffer, horizontally scrolled and padded to `width`.
 *
 * @param b The buffer (or any `BufText`).
 * @param lineStartP Buffer position of the line's first unit.
 * @param hScroll Columns scrolled off the left edge (clamped ≥ 0).
 * @param width Row width in columns (clamped ≥ 0).
 * @param sel The absolute selection range `[start, end)`, or `null` for none.
 * @returns The row's cells, in order; total width = `width` (a straddling trailing wide glyph may
 *   exceed it by 1 — it is emitted whole and the screen buffer clips it).
 */
export function formatLine(
  b: BufText,
  lineStartP: number,
  hScroll: number,
  width: number,
  sel: { start: number; end: number } | null,
): FormatCell[] {
  const h = Math.max(0, Math.trunc(hScroll) || 0);
  const w = Math.max(0, Math.trunc(width) || 0);
  const len = b.length;
  const ls = Math.max(0, Math.min(Math.trunc(lineStartP) || 0, len));
  const text = b.slice(ls, lineEnd(b, ls)); // one line's text, stopping at the next \r/\n
  const selectedAt = (p: number): boolean => sel !== null && sel.start <= p && p < sel.end;

  const cells: FormatCell[] = [];
  let i = 0;
  let pos = 0;
  let x = 0;
  while (i < text.length) {
    const isTab = text[i] === '\t';
    const nextI = isTab ? i + 1 : nextClusterEnd(text, i);
    let nextPos: number;
    if (isTab) {
      nextPos = (pos | 7) + 1;
    } else {
      const cp0 = text.codePointAt(i) ?? 0x20;
      // A C0 control / DEL steps as ONE column: when the row is written to the screen each control
      // char becomes exactly one space cell, so the column math here must agree — never treat it as
      // a zero-width cluster.
      const w = cp0 < 0x20 || cp0 === 0x7f ? 1 : stringWidth(text.slice(i, nextI));
      nextPos = pos + w;
    }

    // Stop before drawing past the row width, or at a glyph on the boundary that would extend past
    // it — checked before emitting so a combining mark in the last column still joins its base.
    if (x > w || (x === w && pos < nextPos)) break;

    if (nextPos > h) {
      const selected = selectedAt(ls + i);
      const charWidth = nextPos - Math.max(pos, h);
      const cp0v = text.codePointAt(i) ?? 0x20;
      if (isTab || pos < h || cp0v < 0x20 || cp0v === 0x7f) {
        // A tab, the visible remainder of a glyph cut off by the horizontal scroll, or a C0/DEL
        // control — emit spaces, never a split cell. Emitting the control as its own space keeps
        // the row's column math identical to the write boundary (which would otherwise drop the
        // control and shift every later cell one column left).
        for (let s = 0; s < charWidth; s++) cells.push({ ch: ' ', selected, width: 1 });
      } else if (charWidth === 0) {
        // A zero-width cluster (a lone combining mark) — join it to the previous cell, mirroring
        // terminal behavior; if it lands at the row start it becomes a width-1 cell of its own.
        const prev = cells[cells.length - 1];
        if (prev !== undefined) prev.ch += text.slice(i, nextI);
        else cells.push({ ch: text.slice(i, nextI), selected, width: 1 });
      } else {
        cells.push({ ch: text.slice(i, nextI), selected, width: charWidth === 2 ? 2 : 1 });
      }
      x += charWidth;
    }
    i = nextI;
    pos = nextPos;
  }

  // Pad the rest of the row in the colour of the position just past the text (the line break, or
  // end of buffer), so a selection running through the break also colours the padding.
  if (x < w) {
    const selected = selectedAt(ls + i);
    for (let s = x; s < w; s++) cells.push({ ch: ' ', selected, width: 1 });
  }
  return cells;
}
