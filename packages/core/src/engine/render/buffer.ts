/**
 * The width-correct cell buffer your app draws into.
 *
 * A 2-D grid of styled {@link Cell}s, each carrying a glyph, foreground/background
 * color, an attribute mask, and a display `width`. The drawing helpers
 * (`set`/`text`/`fillRect`/`box`/`shadow`) keep wide glyphs (CJK/emoji) occupying
 * two columns — a lead cell (`width: 2`) plus a continuation cell (`width: 0`,
 * empty char) — so the terminal's column addressing stays in sync.
 *
 * The buffer is pure data + geometry: it knows display width but not terminal
 * capabilities. Capability-driven behavior (color depth, glyph fallback,
 * synchronized output) is applied later by {@link serialize} and the glyph
 * fallback layer.
 */

import { Attr } from './types.js';
import type { Cell, Style } from './types.js';
import { charWidth } from './width.js';
import type { WidthMode } from './width.js';
import { sanitize } from '../safety/sanitize.js';

/** The box-drawing glyph set per variant (real Unicode; fallback is serialize-time). */
const BOX = {
  single: { tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518', h: '\u2500', v: '\u2502' }, // ┌┐└┘─│
  double: { tl: '\u2554', tr: '\u2557', bl: '\u255A', br: '\u255D', h: '\u2550', v: '\u2551' }, // ╔╗╚╝═║
} as const;

/**
 * Default width-resolution mode for writes that do not specify one. Matches the
 * capability layer's default `unicode.widthMode`.
 */
const DEFAULT_WIDTH_MODE: WidthMode = 'wcwidth';

/** Sum of the display widths of a string's code points (combining marks count 0). */
function displayWidth(str: string): number {
  let total = 0;
  for (const glyph of str) total += charWidth(glyph.codePointAt(0) ?? 0x20, DEFAULT_WIDTH_MODE);
  return total;
}

/**
 * Clip a string to at most `maxWidth` display columns without splitting a wide glyph: a width-2
 * glyph that would straddle the limit is dropped whole rather than leaving a half cell.
 */
function clipToWidth(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  let out = '';
  let used = 0;
  for (const glyph of str) {
    const w = charWidth(glyph.codePointAt(0) ?? 0x20, DEFAULT_WIDTH_MODE);
    if (used + w > maxWidth) break;
    out += glyph;
    used += w;
  }
  return out;
}

/**
 * A mutable 2-D grid of styled cells — the surface you draw a frame onto before
 * handing it to {@link serialize} for painting.
 *
 * Fill it at construction with a background style, then draw with `set` (one
 * glyph), `text` (a left-aligned string), `fillRect`, `box`, and `shadow`. All
 * writes are width-correct and clipped to the buffer bounds, and every string is
 * sanitized so untrusted text cannot inject an escape sequence at paint time.
 *
 * @example
 * import { ScreenBuffer, serialize, resolveCapabilities } from '@jsvision/core';
 *
 * const buf = new ScreenBuffer(20, 3, { fg: 'white', bg: 'blue' });
 * buf.box(0, 0, 20, 3, { fg: 'white', bg: 'blue' }, 'single', 'Title');
 * buf.text(2, 1, 'Hello, 世界', { fg: 'brightWhite', bg: 'blue' });
 *
 * const caps = resolveCapabilities().profile;
 * process.stdout.write(serialize(buf, null, { caps })); // full first paint
 */
export class ScreenBuffer {
  public readonly width: number;
  public readonly height: number;
  /** Row-major cell storage; index `y * width + x`. */
  protected readonly cells: Cell[];

  /**
   * Create a buffer with every cell pre-filled with a background style.
   *
   * @param width  Buffer width in columns (clamped to at least 1).
   * @param height Buffer height in rows (clamped to at least 1).
   * @param fill   The style (and optional single narrow glyph, default space)
   *   every cell starts with.
   */
  constructor(width: number, height: number, fill: Style & { char?: string }) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    const char = fill.char ?? ' ';
    const attrs = fill.attrs ?? Attr.none;
    this.cells = new Array(this.width * this.height);
    for (let i = 0; i < this.cells.length; i += 1) {
      this.cells[i] = { char, fg: fill.fg, bg: fill.bg, attrs, width: 1 };
    }
  }

  /** True when (x, y) lies inside the buffer bounds. */
  protected inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** The cell at (x, y); caller must have bounds-checked. */
  protected cellAt(x: number, y: number): Cell {
    return this.cells[y * this.width + x];
  }

  /** Overwrite a cell's contents in place. */
  protected write(cell: Cell, char: string, style: Style, cellWidth: 0 | 1 | 2): void {
    cell.char = char;
    cell.fg = style.fg;
    cell.bg = style.bg;
    cell.attrs = style.attrs ?? Attr.none;
    cell.width = cellWidth;
  }

  /** Reduce a cell to a width-1 space, keeping its colors (clears a wide orphan). */
  protected blank(cell: Cell): void {
    cell.char = ' ';
    cell.width = 1;
  }

  /**
   * Before overwriting (x, y), repair any wide glyph this write would split: if
   * the existing cell is a wide lead, blank its continuation; if it is a
   * continuation, blank its lead. Prevents a stale half-glyph.
   */
  protected clearOrphan(x: number, y: number): void {
    const cell = this.cellAt(x, y);
    if (cell.width === 2 && this.inBounds(x + 1, y)) {
      const cont = this.cellAt(x + 1, y);
      if (cont.width === 0) this.blank(cont);
    } else if (cell.width === 0 && this.inBounds(x - 1, y)) {
      const lead = this.cellAt(x - 1, y);
      if (lead.width === 2) this.blank(lead);
    }
  }

  /**
   * Write a single glyph at (x, y); out-of-bounds writes are silently clipped.
   * A wide glyph (display width 2) occupies (x, y) as a `width: 2` lead and
   * (x+1, y) as a `width: 0` continuation; a wide glyph in the last column has
   * no room for its continuation and clips to a space (never a half glyph).
   *
   * @param widthMode Width-resolution mode; defaults to `'wcwidth'`.
   */
  public set(x: number, y: number, char: string, style: Style, widthMode: WidthMode = DEFAULT_WIDTH_MODE): void {
    if (!this.inBounds(x, y)) return;
    this.clearOrphan(x, y);
    const cp = char.codePointAt(0) ?? 0x20;
    // A C0 control (including \t/\n) or DEL becomes a single space cell. One input char = one cell,
    // so your column math holds and no raw control byte can reach the serializer and desync the
    // terminal's column addressing.
    if (cp < 0x20 || cp === 0x7f) {
      this.write(this.cellAt(x, y), ' ', style, 1);
      return;
    }
    const w = charWidth(cp, widthMode);
    if (w === 2) {
      if (this.inBounds(x + 1, y)) {
        this.clearOrphan(x + 1, y);
        this.write(this.cellAt(x, y), char, style, 2);
        this.write(this.cellAt(x + 1, y), '', style, 0);
      } else {
        // No room for the continuation in the last column: clip to a space.
        this.write(this.cellAt(x, y), ' ', style, 1);
      }
    } else {
      // Normal and zero-width inputs both occupy one cell here; a standalone
      // zero-width glyph via set() is degenerate, so store it as a width-1 cell.
      this.write(this.cellAt(x, y), char, style, 1);
    }
  }

  /** Read a cell, or `undefined` when out of bounds. */
  public get(x: number, y: number): Cell | undefined {
    if (!this.inBounds(x, y)) return undefined;
    return this.cellAt(x, y);
  }

  /** Fill a rectangle with a single glyph and style (width-correct via `set`). */
  public fillRect(x: number, y: number, w: number, h: number, char: string, style: Style): void {
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        this.set(x + col, y + row, char, style);
      }
    }
  }

  /**
   * Draw a left-aligned string starting at (x, y), advancing by each glyph's
   * **display width** (wide glyphs advance 2 columns). Glyphs outside the buffer
   * are clipped.
   *
   * The string is sanitized first: control bytes never become cells, so untrusted
   * text cannot inject an escape sequence at serialize time.
   *
   * @param widthMode Width-resolution mode; defaults to `'wcwidth'`.
   * @returns The column just past the written text (display columns, not
   *   code-point count).
   */
  public text(x: number, y: number, str: string, style: Style, widthMode: WidthMode = DEFAULT_WIDTH_MODE): number {
    let col = x;
    // The lead column of the most recently written cell, so a following combining mark can compose
    // onto it. -1 until the first base glyph of this write is stored.
    let lastLeadCol = -1;
    for (const glyph of sanitize(str)) {
      const cp = glyph.codePointAt(0) ?? 0x20;
      // A C0 control / DEL that survived sanitize (\t, \n) stores as one space cell and advances
      // exactly one column, mirroring set()'s replacement.
      const isControl = cp < 0x20 || cp === 0x7f;
      if (isControl) {
        this.set(col, y, ' ', style, widthMode);
        lastLeadCol = col;
        col += 1;
        continue;
      }
      // A zero-width combining mark composes onto the preceding cell's glyph (the cluster stays one
      // cell, width unchanged) — e.g. `e` + U+0301 → an `é` cell. A mark with no preceding cell in
      // this write (at the row start) is dropped: there is nothing to compose onto.
      if (charWidth(cp, widthMode) === 0) {
        if (lastLeadCol >= 0) this.appendCombining(lastLeadCol, y, glyph);
        continue;
      }
      this.set(col, y, glyph, style, widthMode);
      lastLeadCol = col;
      col += charWidth(cp, widthMode);
    }
    return col;
  }

  /**
   * Append a zero-width combining mark to the base cell at (x, y), keeping the cell's width.
   * No-op when (x, y) is out of bounds or the base cell was cleared to empty (nothing to compose on).
   *
   * @param x Column of the base cell (a wide glyph's lead).
   * @param y Row of the base cell.
   * @param mark The combining mark glyph to append.
   */
  protected appendCombining(x: number, y: number, mark: string): void {
    if (!this.inBounds(x, y)) return;
    const cell = this.cellAt(x, y);
    if (cell.char === '') return; // a continuation/empty cell is not a compose target
    cell.char += mark;
  }

  /**
   * Draw a framed box with an opaque interior fill and an optional centered
   * title. The real Unicode box glyphs are stored; the serializer substitutes
   * ASCII (`+`, `-`, `|`) when the terminal lacks box-drawing support.
   *
   * @param variant `'double'` for ╔═╗ frames or `'single'` for ┌─┐.
   */
  public box(
    x: number,
    y: number,
    w: number,
    h: number,
    style: Style,
    variant: 'single' | 'double' = 'single',
    title?: string,
  ): void {
    if (w < 2 || h < 2) return;
    const g = BOX[variant];
    this.fillRect(x, y, w, h, ' ', style);
    this.set(x, y, g.tl, style);
    this.set(x + w - 1, y, g.tr, style);
    this.set(x, y + h - 1, g.bl, style);
    this.set(x + w - 1, y + h - 1, g.br, style);
    for (let col = 1; col < w - 1; col += 1) {
      this.set(x + col, y, g.h, style);
      this.set(x + col, y + h - 1, g.h, style);
    }
    for (let row = 1; row < h - 1; row += 1) {
      this.set(x, y + row, g.v, style);
      this.set(x + w - 1, y + row, g.v, style);
    }
    if (title) {
      // Center by DISPLAY width (not code-point count) and clip to the box interior, so a CJK/emoji
      // title stays centered and never overflows the border.
      const interior = w - 2; // columns between the two vertical borders
      const label = clipToWidth(` ${title} `, interior);
      const labelWidth = displayWidth(label);
      const tx = x + 1 + Math.max(0, Math.floor((interior - labelWidth) / 2));
      this.text(tx, y, label, style);
    }
  }

  /**
   * Cast a drop shadow by darkening the cells one column right and one row below
   * the rectangle (classic text-mode style). Only the colors change; glyphs stay.
   */
  public shadow(x: number, y: number, w: number, h: number, style: Style): void {
    const attrs = style.attrs ?? Attr.none;
    for (let row = 0; row < h; row += 1) {
      const cell = this.get(x + w, y + row + 1);
      if (cell) {
        cell.fg = style.fg;
        cell.bg = style.bg;
        cell.attrs = attrs;
      }
    }
    for (let col = 0; col < w; col += 1) {
      const cell = this.get(x + col + 1, y + h);
      if (cell) {
        cell.fg = style.fg;
        cell.bg = style.bg;
        cell.attrs = attrs;
      }
    }
  }

  /** Expose the grid as rows of cells for the serializer (read-only view). */
  public rows(): readonly Cell[][] {
    const out: Cell[][] = [];
    for (let y = 0; y < this.height; y += 1) {
      out.push(this.cells.slice(y * this.width, y * this.width + this.width));
    }
    return out;
  }

  /**
   * Create a deep, independent copy of this buffer: same `width`/`height` and an element-wise
   * copy of every cell — `char`, `fg`/`bg`/`attrs`, and `width` (0/1/2, so wide-lead and
   * continuation cells are reproduced exactly). The copy shares no cell objects with the
   * original, so mutating either one never affects the other.
   *
   * Use it to snapshot the previous frame before drawing the next, then pass both to
   * `serialize(current, previous, …)` for a minimal damage diff. An exact clone is required here
   * because a `get`/`set`-based copy would recompute each cell's width from its char and so could
   * not reproduce continuation cells faithfully.
   *
   * @returns A new ScreenBuffer equal to this one cell-for-cell.
   * @example
   * import { ScreenBuffer, serialize, resolveCapabilities } from '@jsvision/core';
   * const caps = resolveCapabilities().profile;
   *
   * let previous = new ScreenBuffer(10, 1, { fg: 'default', bg: 'default' });
   * const next = previous.clone();
   * next.set(2, 0, 'Z', { fg: 'red', bg: 'default' });
   *
   * const diff = serialize(next, previous, { caps }); // emits only the one changed cell
   * previous = next; // snapshot becomes the baseline for the following frame
   */
  public clone(): ScreenBuffer {
    const copy = new ScreenBuffer(this.width, this.height, { fg: 'default', bg: 'default' });
    for (let i = 0; i < this.cells.length; i += 1) {
      const cell = this.cells[i];
      copy.cells[i] = { char: cell.char, fg: cell.fg, bg: cell.bg, attrs: cell.attrs, width: cell.width };
    }
    return copy;
  }
}
