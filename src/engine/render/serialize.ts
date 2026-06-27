/**
 * The pure damage-diff serializer (RD-04, AC-1/AC-3/AC-6, plan doc 03-02).
 *
 * `serialize(current, previous, options)` turns a frame into the minimal ANSI
 * needed to paint it over the previous frame: only changed cells emit, adjacent
 * same-style changed cells coalesce into one styled run, and the whole frame is
 * optionally wrapped in synchronized-output markers. It is a pure function (no
 * I/O, no state) — the RD-07 host holds the previous frame and performs the
 * actual write (PL-5). Bytes are proportional to damage (AC-1); two identical
 * frames cost zero bytes (AC-6).
 *
 * Decisions: PL-1 (default encoder), PL-5 (purity), PL-6 (string output),
 * PL-9 (glyph fallback), PL-13 (resize → full repaint), PL-14 (seam options).
 */

import { SGR_RESET, SYNC_BEGIN, SYNC_END, cursorTo, CSI } from './ansi.js';
import { fallbackGlyph } from './glyphs.js';
import { Attr } from './types.js';
import type { AttrMask, Cell, Color } from './types.js';
import type { ScreenBuffer } from './buffer.js';
import type { CapabilityProfile } from '../capability/index.js';

/**
 * Encodes a cell style to an SGR sequence for the detected depth. RD-05 injects
 * the full depth-aware version later via {@link RenderOptions.encodeStyle}; this
 * RD ships a minimal truecolor/mono default (PL-1).
 */
export type StyleEncoder = (fg: Color, bg: Color, attrs: AttrMask, caps: CapabilityProfile) => string;

/** Options for {@link serialize}: capabilities + the injectable encoder (PL-14). */
export interface RenderOptions {
  readonly caps: CapabilityProfile;
  /** Defaults to the built-in minimal truecolor/mono encoder (PL-1). */
  readonly encodeStyle?: StyleEncoder;
}

/** RGB components, each 0–255. */
interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * The 16 named ANSI colors as 24-bit RGB (common xterm palette). The minimal
 * default encoder over-emits these as truecolor; RD-05's depth-aware encoder
 * downsamples to 256/16 later.
 */
const ANSI16_RGB: Record<string, Rgb> = {
  black: { r: 0, g: 0, b: 0 },
  red: { r: 205, g: 0, b: 0 },
  green: { r: 0, g: 205, b: 0 },
  yellow: { r: 205, g: 205, b: 0 },
  blue: { r: 0, g: 0, b: 238 },
  magenta: { r: 205, g: 0, b: 205 },
  cyan: { r: 0, g: 205, b: 205 },
  white: { r: 229, g: 229, b: 229 },
  brightBlack: { r: 127, g: 127, b: 127 },
  brightRed: { r: 255, g: 0, b: 0 },
  brightGreen: { r: 0, g: 255, b: 0 },
  brightYellow: { r: 255, g: 255, b: 0 },
  brightBlue: { r: 92, g: 92, b: 255 },
  brightMagenta: { r: 255, g: 0, b: 255 },
  brightCyan: { r: 0, g: 255, b: 255 },
  brightWhite: { r: 255, g: 255, b: 255 },
};

/** SGR attribute codes, paired with their {@link Attr} bit. */
const ATTR_SGR: readonly { readonly bit: number; readonly code: number }[] = [
  { bit: Attr.bold, code: 1 },
  { bit: Attr.dim, code: 2 },
  { bit: Attr.italic, code: 3 },
  { bit: Attr.underline, code: 4 },
  { bit: Attr.blink, code: 5 },
  { bit: Attr.reverse, code: 7 },
  { bit: Attr.strike, code: 9 },
];

/** Parse a `#rgb` or `#rrggbb` color to RGB, or `null` for `'default'`/unknown. */
function colorToRgb(color: Color): Rgb | null {
  if (color === 'default') return null;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }
  return ANSI16_RGB[color] ?? null;
}

/**
 * The minimal default style encoder shipped with RD-04 (PL-1). Emits attribute
 * SGR codes always, plus 24-bit truecolor for non-`'default'` colors unless the
 * terminal is monochrome. RD-05 supersedes this with depth-aware downsampling.
 */
export function defaultEncodeStyle(fg: Color, bg: Color, attrs: AttrMask, caps: CapabilityProfile): string {
  const parts: number[] = [];
  for (const { bit, code } of ATTR_SGR) {
    if ((attrs & bit) !== 0) parts.push(code);
  }
  if (caps.colorDepth !== 'mono') {
    const f = colorToRgb(fg);
    if (f) parts.push(38, 2, f.r, f.g, f.b);
    const b = colorToRgb(bg);
    if (b) parts.push(48, 2, b.r, b.g, b.b);
  }
  if (parts.length === 0) return '';
  return `${CSI}${parts.join(';')}m`;
}

/** Whether two cells are visually identical (the damage-diff comparison). */
function cellsEqual(a: Cell, b: Cell): boolean {
  return a.char === b.char && a.fg === b.fg && a.bg === b.bg && a.attrs === b.attrs && a.width === b.width;
}

/** Whether two cells share the same style (run-merge boundary). */
function sameStyle(a: Cell, b: Cell): boolean {
  return a.fg === b.fg && a.bg === b.bg && a.attrs === b.attrs;
}

/**
 * Build the in-place ANSI frame that turns `previous` into `current` (damage
 * diff). When `previous` is `null` or its dimensions differ from `current`, the
 * diff baseline is invalid and every cell is repainted (PL-13).
 *
 * @param current The frame to display.
 * @param previous The last displayed frame, or `null` for a full first paint.
 * @param options Capabilities + optional style encoder (PL-14).
 * @returns One coalesced ANSI string (empty when nothing changed) (PL-6).
 */
export function serialize(current: ScreenBuffer, previous: ScreenBuffer | null, options: RenderOptions): string {
  const caps = options.caps;
  const encode = options.encodeStyle ?? defaultEncodeStyle;
  const rows = current.rows();

  const sameDims = previous !== null && previous.width === current.width && previous.height === current.height;
  const prevRows = sameDims && previous ? previous.rows() : null;

  const body: string[] = [];

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    const prev = prevRows ? prevRows[y] : null;
    let x = 0;
    while (x < row.length) {
      // Skip unchanged cells; a run starts at the first changed cell.
      if (prev && cellsEqual(row[x], prev[x])) {
        x += 1;
        continue;
      }
      const runStart = x;
      const head = row[x];
      let glyphs = '';
      while (x < row.length) {
        const cell = row[x];
        if (prev && cellsEqual(cell, prev[x])) break; // unchanged → run ends
        if (!sameStyle(cell, head)) break; // style change → run ends
        // Continuation cells (width 0) already had their glyph emitted by the lead.
        if (cell.width !== 0) glyphs += fallbackGlyph(cell.char, caps);
        x += 1;
      }
      body.push(cursorTo(y + 1, runStart + 1));
      body.push(encode(head.fg, head.bg, head.attrs, caps));
      body.push(glyphs);
      body.push(SGR_RESET);
    }
  }

  if (body.length === 0) return '';
  const inner = body.join('');
  // Sync wrappers only bracket real output, so AC-6 (zero-cost) stays zero-cost.
  return caps.sync2026 ? `${SYNC_BEGIN}${inner}${SYNC_END}` : inner;
}
