/**
 * The pure damage-diff serializer: turns a frame into the minimal ANSI needed to
 * paint it over the previous frame.
 *
 * `serialize(current, previous, options)` emits only the cells that changed,
 * coalesces adjacent same-style changes into one styled run, and optionally wraps
 * the whole frame in synchronized-output markers so the terminal paints it
 * atomically. It is a pure function (no I/O, no state): you hold the previous frame
 * and perform the actual write. Bytes are proportional to the amount of change, and
 * two identical frames cost zero bytes.
 */

import { SGR_RESET, SYNC_BEGIN, SYNC_END, cursorTo } from './ansi.js';
import { fallbackGlyph } from './glyphs.js';
import type { AttrMask, Cell, Color } from './types.js';
import type { ScreenBuffer } from './buffer.js';
import type { CapabilityProfile } from '../capability/index.js';
import { encodeStyle } from '../color/index.js';

/**
 * Encodes a cell's foreground/background/attributes to an SGR escape sequence for
 * the terminal's color depth. Defaults to {@link defaultEncodeStyle}; supply your
 * own via {@link RenderOptions.encodeStyle} to customise color output.
 */
export type StyleEncoder = (fg: Color, bg: Color, attrs: AttrMask, caps: CapabilityProfile) => string;

/** Options for {@link serialize}: the terminal capabilities plus an optional custom style encoder. */
export interface RenderOptions {
  /** Resolved terminal capabilities (color depth, glyph support, synchronized output). */
  readonly caps: CapabilityProfile;
  /** Custom style encoder; defaults to the depth-aware {@link defaultEncodeStyle}. */
  readonly encodeStyle?: StyleEncoder;
}

/**
 * The default style encoder: depth-aware, downsampling truecolor→256→16→mono and
 * merging attributes + foreground + background into one SGR sequence.
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
 * Build the ANSI string that turns `previous` into `current` (a damage diff). When
 * `previous` is `null`, or its dimensions differ from `current` (e.g. after a
 * resize), the baseline is invalid and every cell is repainted.
 *
 * @param current The frame to display.
 * @param previous The last displayed frame, or `null` for a full first paint.
 * @param options Terminal capabilities plus an optional custom style encoder.
 * @returns One coalesced ANSI string, empty when nothing changed.
 * @example
 * import { ScreenBuffer, serialize, resolveCapabilities } from '@jsvision/core';
 * const caps = resolveCapabilities().profile;
 *
 * let previous: ScreenBuffer | null = null;
 * const frame = new ScreenBuffer(40, 10, { fg: 'white', bg: 'black' });
 * frame.text(1, 1, 'Ready.', { fg: 'brightGreen', bg: 'black' });
 *
 * // First paint: previous is null, so the whole frame is emitted.
 * process.stdout.write(serialize(frame, previous, { caps }));
 * previous = frame.clone();
 *
 * // Next frame: only the cells you changed since the snapshot are re-emitted.
 * frame.text(1, 1, 'Done. ', { fg: 'brightGreen', bg: 'black' });
 * process.stdout.write(serialize(frame, previous, { caps }));
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

      // A changed run that starts on a wide glyph's CONTINUATION cell (its lead unchanged) must
      // re-emit the lead glyph with the new style — a bare styled run with no glyph would leave the
      // wide char stale. Emit the lead glyph at the lead column with the continuation's new style,
      // then skip the continuation.
      if (row[x].width === 0 && x > 0 && row[x - 1].width === 2) {
        const lead = row[x - 1];
        const cont = row[x]; // the changed continuation carries the new style
        const g = fallbackGlyph(lead.char, caps);
        body.push(cursorTo(y + 1, x)); // the lead column (x-1) → 1-based x
        body.push(encode(cont.fg, cont.bg, cont.attrs, caps));
        body.push(g);
        if (g.length === 1 && g !== lead.char) body.push(' '); // pad: a wide glyph fell back to one narrow char
        body.push(SGR_RESET);
        x += 1;
        continue;
      }

      const runStart = x;
      const head = row[x];
      let glyphs = '';
      // When a wide glyph's ASCII fallback collapses to a single narrow char, its continuation cell
      // must be emitted as a space pad so the two-column footprint (and the column math) still holds.
      let padWide = false;
      while (x < row.length) {
        const cell = row[x];
        if (prev && cellsEqual(cell, prev[x])) break; // unchanged → run ends
        if (!sameStyle(cell, head)) break; // style change → run ends
        if (cell.width === 0) {
          // Continuation: the lead already emitted the wide glyph — but if that glyph fell back to a
          // single narrow char, emit a space pad here to preserve the two columns.
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
  // Only wrap real output in sync markers, so an unchanged frame stays truly zero-cost.
  return caps.sync2026 ? `${SYNC_BEGIN}${inner}${SYNC_END}` : inner;
}
