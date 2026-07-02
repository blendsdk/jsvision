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

import { SGR_RESET, SYNC_BEGIN, SYNC_END, cursorTo } from './ansi.js';
import { fallbackGlyph } from './glyphs.js';
import type { AttrMask, Cell, Color } from './types.js';
import type { ScreenBuffer } from './buffer.js';
import type { CapabilityProfile } from '../capability/index.js';
import { encodeStyle } from '../color/index.js';

/**
 * Encodes a cell style to an SGR sequence for the detected depth. Defaults to the
 * RD-05 depth-aware {@link defaultEncodeStyle}; an app may inject its own via
 * {@link RenderOptions.encodeStyle} (PL-14).
 */
export type StyleEncoder = (fg: Color, bg: Color, attrs: AttrMask, caps: CapabilityProfile) => string;

/** Options for {@link serialize}: capabilities + the injectable encoder (PL-14). */
export interface RenderOptions {
  readonly caps: CapabilityProfile;
  /** Defaults to the RD-05 depth-aware encoder ({@link defaultEncodeStyle}). */
  readonly encodeStyle?: StyleEncoder;
}

/**
 * The default style encoder: the RD-05 depth-aware {@link encodeStyle}, which
 * downsamples truecolor→256→16→mono and merges attrs + fg + bg into one SGR
 * (AR-3/AR-4). Replaces the provisional truecolor-only encoder RD-04 shipped.
 */
export const defaultEncodeStyle: StyleEncoder = encodeStyle;

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

      // HR-20 (PA-14): a changed run starting on a wide-glyph CONTINUATION (its lead unchanged) must
      // re-emit the lead glyph with the changed style — never a zero-glyph styled run. Emit the lead
      // glyph at the lead column with the continuation's new style, then skip the continuation.
      if (row[x].width === 0 && x > 0 && row[x - 1].width === 2) {
        const lead = row[x - 1];
        const cont = row[x]; // the changed continuation carries the new style
        const g = fallbackGlyph(lead.char, caps);
        body.push(cursorTo(y + 1, x)); // the lead column (x-1) → 1-based x
        body.push(encode(cont.fg, cont.bg, cont.attrs, caps));
        body.push(g);
        if (g.length === 1 && g !== lead.char) body.push(' '); // wide-fallback pad (HR-18/PA-11)
        body.push(SGR_RESET);
        x += 1;
        continue;
      }

      const runStart = x;
      const head = row[x];
      let glyphs = '';
      // HR-18 (PA-11): a wide glyph whose fallback collapses to one narrow char needs its
      // continuation cell emitted as a space pad, so the 2-column footprint (and column math) holds.
      let padWide = false;
      while (x < row.length) {
        const cell = row[x];
        if (prev && cellsEqual(cell, prev[x])) break; // unchanged → run ends
        if (!sameStyle(cell, head)) break; // style change → run ends
        if (cell.width === 0) {
          // Continuation: the lead already emitted the wide glyph — but if that glyph fell back to a
          // single narrow char, emit a space pad here to preserve the two columns (HR-18).
          if (padWide) glyphs += ' ';
          padWide = false;
        } else {
          const g = fallbackGlyph(cell.char, caps);
          glyphs += g;
          padWide = cell.width === 2 && g.length === 1 && g !== cell.char;
        }
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
