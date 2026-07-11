/**
 * Pack a row of fixed-width and flexible segments into exact integer columns.
 *
 * A thin adapter over the 1-D flex solver ({@link solveTrack}): it turns a list of bar segments —
 * each a fixed-width button or a flexible spacer with a grow weight — into the resolved
 * `{ x, width }` of every segment, packed left-to-right. It is the shared packing step behind
 * data-driven chrome bars (menu titles) that want right-alignment and flexible gaps while keeping
 * the default, spacer-free layout a plain left-pack.
 */

import { solveTrack } from './apportion.js';
import type { TrackItem } from './apportion.js';

/** A segment to place along a bar: a fixed-width button, or a flexible spacer with a grow weight. */
export type RowSegment =
  | { readonly kind: 'fixed'; readonly width: number }
  | { readonly kind: 'flex'; readonly weight: number };

/** The resolved integer left column + width of one packed segment. */
export interface RowSlot {
  readonly x: number;
  readonly width: number;
}

/**
 * Resolve the integer `x` + `width` of each segment, packed into the columns `[startX, total)`.
 *
 * Fixed segments keep their width; flexible segments split the leftover space
 * (`total − startX − Σfixed`) via largest-remainder apportionment, so the columns are whole cells
 * and a trailing spacer pushes the segments after it flush against the right edge (`total`). With
 * no flexible segment the result is a plain left-pack from `startX` — so a bar with no spacer lays
 * out identically whether or not `total` is known.
 *
 * When the fixed widths overflow the available space, flexible segments collapse to width 0 and
 * fixed segments keep their natural widths (they extend past `total`); a width is never negative.
 *
 * @param segments The bar segments, in left-to-right order.
 * @param total The right edge (exclusive) to pack into — typically the bar's full width.
 * @param startX The column the first segment starts at (a left margin); default 0.
 * @returns One `{ x, width }` slot per input segment, in the same order.
 * @example
 * // Internal layout helper. "File" at a left margin of 1, "Help" pushed flush right in a 40-wide bar.
 * packRow(
 *   [{ kind: 'fixed', width: 6 }, { kind: 'flex', weight: 1 }, { kind: 'fixed', width: 6 }],
 *   40,
 *   1,
 * );
 * // → [ { x: 1, width: 6 }, { x: 7, width: 27 }, { x: 34, width: 6 } ]  ("Help" ends at column 40)
 */
export function packRow(segments: readonly RowSegment[], total: number, startX = 0): RowSlot[] {
  if (segments.length === 0) return [];

  const available = Math.max(0, total - startX);
  const items: TrackItem[] = segments.map((seg) =>
    seg.kind === 'fixed'
      ? { kind: 'fixed', size: Math.max(0, seg.width) }
      : { kind: 'flex', weight: seg.weight },
  );
  const widths = solveTrack(available, items);

  const slots: RowSlot[] = [];
  let x = startX;
  for (const width of widths) {
    slots.push({ x, width });
    x += width;
  }
  return slots;
}
