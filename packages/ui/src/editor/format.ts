/**
 * `formatLine` — the faithful TV editor row renderer, pure (RD-08 03-02).
 *
 * Decode (`TEditor::formatLine`, `edits.cpp:38-92`, re-verified 2026-07-07 @ 57b6f56):
 *   • Per-position colour split via `getColorAt` (`edits.cpp:31-36`): `selStart ≤ P < selEnd` →
 *     the selected attr, else normal — here the boolean `selected` role selector (the byte pair
 *     `0x1E`/`0x71` is pinned by the `editorNormal`/`editorSelected` theme roles, PA-8).
 *   • Steps by `nextCharAndPos` (`teditor1.cpp:240-268`): a tab advances one unit to the next
 *     8-column stop `(pos|7)+1`; any other glyph by its display width — TV's multibyte step
 *     generalized to grapheme clusters (AR-251).
 *   • The width break happens BEFORE drawing: `x > width || (x == width && pos < nextPos)` — so a
 *     combining mark in the last column still joins its base, and a wide glyph may straddle the
 *     right edge (the caller's `DrawContext`/`ScreenBuffer` clips it).
 *   • Stops at `\r`/`\n` (the line-bounded slice realizes TV's explicit break check).
 *   • Only text past `hScroll` is emitted; an INCOMPLETE tab or wide glyph at the left edge
 *     (`buf[0] == '\t' || pos < hScroll`) renders as SPACES for its visible width — never a
 *     split cell.
 *   • The remainder pads with spaces in the colour of the position AFTER the text (the break's —
 *     so a selection that includes the line break paints the padding).
 *
 * Sanitization is NOT this function's job: cells pass raw and become inert at the write-time
 * boundary (`DrawContext`/`ScreenBuffer.set` — AC-17).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { stringWidth } from '../controls/measure.js';
import { nextClusterEnd } from './buffer/segment.js';
import { lineEnd } from './buffer/navigate.js';
import type { BufText } from './buffer/gap.js';

/** One visual cell of a formatted row: the glyph (a whole cluster), its role, and its width. */
export interface FormatCell {
  /** The cluster to draw (`' '` for tab fills, h-scroll stubs, and padding). */
  ch: string;
  /** `true` → `editorSelected` (`0x71`), else `editorNormal` (`0x1E`) — the getColorAt split. */
  selected: boolean;
  /** Display width in columns (a wide CJK/emoji cluster is 2). */
  width: 1 | 2;
}

/**
 * Format one visual row: TV `formatLine` over the buffer, hScroll-clipped, padded to `width`.
 *
 * @param b The buffer (or any `BufText`).
 * @param lineStartP Buffer position of the line's first unit.
 * @param hScroll Columns scrolled off the left edge (clamped ≥ 0).
 * @param width Row width in columns (clamped ≥ 0).
 * @param sel The absolute selection range `[start, end)`, or `null` for none.
 * @returns The row's cells, in order; total width = `width` (a straddling trailing wide glyph may
 *   exceed it by 1 — the decode draws it and the buffer clips).
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
  const text = b.slice(ls, lineEnd(b, ls)); // the line-bounded slice (stops at \r/\n, PF-007)
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
      // A C0 control / DEL steps as ONE column: the write-time boundary stores exactly one space
      // cell per control char (ScreenBuffer.set HR-05), so the column math must agree — never
      // treat it as a zero-width cluster.
      const w = cp0 < 0x20 || cp0 === 0x7f ? 1 : stringWidth(text.slice(i, nextI));
      nextPos = pos + w;
    }

    // The decode's pre-draw break: past the width, or a width-boundary glyph that would extend.
    if (x > w || (x === w && pos < nextPos)) break;

    if (nextPos > h) {
      const selected = selectedAt(ls + i);
      const charWidth = nextPos - Math.max(pos, h);
      const cp0v = text.codePointAt(i) ?? 0x20;
      if (isTab || pos < h || cp0v < 0x20 || cp0v === 0x7f) {
        // A tab, the visible remainder of a glyph cut by hScroll, or a C0/DEL control — spaces,
        // never a split cell. Emitting the control as its own SPACE keeps the row's column math
        // identical to the write boundary (DrawContext/sanitize would otherwise DROP it and shift
        // every later cell left); the one-char-one-cell rule mirrors ScreenBuffer.set HR-05.
        for (let s = 0; s < charWidth; s++) cells.push({ ch: ' ', selected, width: 1 });
      } else if (charWidth === 0) {
        // A zero-width cluster (lone combining mark) — join it to the previous cell, mirroring
        // terminal behavior; degenerate at row start → a width-1 cell (the ScreenBuffer rule).
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

  // EOL padding in the trailing position's colour (`colorAfter` at P — the break/EOB position).
  if (x < w) {
    const selected = selectedAt(ls + i);
    for (let s = x; s < w; s++) cells.push({ ch: ' ', selected, width: 1 });
  }
  return cells;
}
