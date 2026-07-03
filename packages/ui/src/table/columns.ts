/**
 * Pure column math for the RD-16 `DataGrid<T>` — the view-free, unit-testable core: the column
 * descriptor types, width apportionment (over the RD-02 integer `solveTrack`, incl. the `auto`
 * pre-measure and the min/max clamp fixpoint), width-aware cell alignment, and the `{col,dir}` sort
 * comparator.
 *
 * Kept separate from `grid-rows.ts` so the renderer stays ≤ 500 lines (AR-178) and every piece is
 * testable without a view. No view state, no signals — callers pass snapshots. See
 * plans/table/03-02-columns.md.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { TrackItem } from '../layout/apportion.js';
import { solveTrack } from '../layout/apportion.js';

/** How a column is sized: an exact cell count, an `fr` flex weight, or `auto` (measured over rows). */
export type ColumnWidth = number | `${number}fr` | 'auto';

/** Horizontal alignment of a cell's text within its column width. */
export type ColumnAlign = 'left' | 'right' | 'center';

/**
 * A single heterogeneous column of a `DataGrid<T>` — a title, a field accessor, a sizing rule, and
 * optional alignment / typed comparator / min-max clamps.
 */
export interface Column<T> {
  /** The header cell text. */
  readonly title: string;
  /** Extracts this column's display string from a row. */
  readonly accessor: (row: T) => string;
  /** Sizing: fixed cell count, `${n}fr` flex share, or `auto` (widest cell over all rows). */
  readonly width: ColumnWidth;
  /** Text alignment within the column width (default `'left'`). */
  readonly align?: ColumnAlign;
  /** Typed sort comparator; default = locale-aware string compare of `accessor` (AR-158). */
  readonly compare?: (a: T, b: T) => number;
  /** Lower clamp on the resolved width (Should-Have, AR-175). */
  readonly minWidth?: number;
  /** Upper clamp on the resolved width and the `auto` measurement cap (AR-173/AR-175). */
  readonly maxWidth?: number;
}

/** The active sort: a column index + direction, or `null` for source order. */
export type SortState = { readonly col: number; readonly dir: 'asc' | 'desc' } | null;

/** Resolved per-column geometry for one draw (all integer, post-apportion). */
export interface ColumnGeometry {
  /** Content cells per column (excludes the 1-cell divider). */
  readonly widths: number[];
  /** Absolute x of each column's content, pre-indent: `starts[c] = Σ_{k<c}(widths[k] + 1)`. */
  readonly starts: number[];
  /** The H-scroll content width: `Σ(widths[c] + 1 divider)`. */
  readonly totalWidth: number;
}

/**
 * Pre-measure `auto` columns to a fixed cell width over ALL current rows — the O(rows) part (AR-173).
 * Wrap in a `computed` over the `rows` signal (in data-grid.ts) so it re-runs on data change, not per
 * frame (PF-102).
 *
 * Per column: `null` for `number`/`fr` columns; for `auto`, the widest cell over all rows, floored to
 * the header title width (never 0 — an empty grid falls back to the title) and the `minWidth`, then
 * capped by `maxWidth` (`maxWidth` wins over `minWidth`; AR-175).
 *
 * @param columns The column descriptors.
 * @param rows    The current (unsorted) row snapshot.
 * @param measure Display-width function (the shared `stringWidth`).
 * @returns One entry per column: the measured `auto` width, or `null`.
 */
export function measureAutoWidths<T>(
  columns: Column<T>[],
  rows: T[],
  measure: (s: string) => number,
): (number | null)[] {
  return columns.map((col) => {
    if (col.width !== 'auto') return null;
    let contentMax = 0;
    for (const row of rows) contentMax = Math.max(contentMax, measure(col.accessor(row)));
    const lo = Math.max(measure(col.title), col.minWidth ?? 0);
    const hi = col.maxWidth ?? Infinity;
    return Math.min(Math.max(contentMax, lo), hi);
  });
}

/**
 * Resolve a column to a track item: `pinned` override (from a clamp pass) or its declared kind.
 * `auto` and `number` widths are fixed; `${n}fr` is a flex weight.
 */
function toTrackItem<T>(col: Column<T>, autoWidth: number | null, pinned: number | undefined): TrackItem {
  if (pinned !== undefined) return { kind: 'fixed', size: pinned };
  if (col.width === 'auto') return { kind: 'fixed', size: autoWidth ?? 0 };
  if (typeof col.width === 'number') return { kind: 'fixed', size: Math.max(0, col.width) };
  return { kind: 'flex', weight: parseFloat(col.width) };
}

/**
 * Apportion per-column integer widths + absolute starts for a viewport — the O(cols) per-draw part.
 *
 * Reserves one divider cell per column (apportions over `viewportWidth − numCols`, AR-179) so `fr`
 * columns fill the remaining viewport exactly, then applies the min/max clamps to `fr` results via a
 * bounded fixpoint (a clamped `fr` column is pinned as fixed and the track re-solved; ≤ numCols
 * passes). `fixed`/`auto` widths pass through `solveTrack` unchanged, so an all-fixed track that
 * overflows keeps its widths (→ H-scroll) rather than shrinking.
 *
 * @param columns       The column descriptors.
 * @param autoWidths    The `measureAutoWidths` result (memoized upstream).
 * @param viewportWidth The data-area width in cells.
 * @returns The resolved {@link ColumnGeometry}; empty arrays + `totalWidth 0` for zero columns.
 */
export function apportionColumns<T>(
  columns: Column<T>[],
  autoWidths: (number | null)[],
  viewportWidth: number,
): ColumnGeometry {
  const numCols = columns.length;
  if (numCols === 0) return { widths: [], starts: [], totalWidth: 0 };

  const trackTotal = Math.max(0, viewportWidth - numCols);
  const pinned: (number | undefined)[] = new Array(numCols).fill(undefined);

  let widths: number[] = [];
  // Bounded fixpoint: solve, clamp any fr column that violates min/max, pin it, re-solve. Each pass
  // pins ≥ 1 more column or stops, so it terminates in ≤ numCols passes.
  for (let pass = 0; pass <= numCols; pass++) {
    const items = columns.map((col, c) => toTrackItem(col, autoWidths[c], pinned[c]));
    widths = solveTrack(trackTotal, items);
    let changed = false;
    for (let c = 0; c < numCols; c++) {
      const col = columns[c];
      // Only fr columns are clamped here; fixed/auto are already their intended size, and a
      // pinned column must not be re-clamped.
      if (pinned[c] !== undefined || col.width === 'auto' || typeof col.width === 'number') continue;
      const w = widths[c];
      const lo = col.minWidth ?? 0;
      const hi = col.maxWidth ?? Infinity;
      const clamped = Math.min(Math.max(w, lo), hi); // min then max → maxWidth wins if min > max
      if (clamped !== w) {
        pinned[c] = clamped;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const starts = new Array<number>(numCols);
  let x = 0;
  for (let c = 0; c < numCols; c++) {
    starts[c] = x;
    x += widths[c] + 1; // +1 divider cell per column
  }
  return { widths, starts, totalWidth: x };
}

/**
 * Clip `text` to exactly `width` cells (width-aware — never splits a wide/CJK glyph, PF-104), then
 * pad to the alignment: `left` pads right, `right` pads left, `center` splits the remainder (extra
 * cell to the right). The output is always exactly `width` cells (AC-4). Sanitization is the caller's
 * (`ctx.text`) — this only clips and pads.
 *
 * @param text    The cell text.
 * @param width   The target cell width (≤ 0 → empty string).
 * @param align   The horizontal alignment.
 * @param measure Per-glyph display-width function (the shared `stringWidth`).
 */
export function alignCell(text: string, width: number, align: ColumnAlign, measure: (s: string) => number): string {
  if (width <= 0) return '';
  let clipped = '';
  let w = 0;
  for (const ch of text) {
    const cw = measure(ch);
    if (w + cw > width) break;
    clipped += ch;
    w += cw;
  }
  const pad = width - w;
  if (align === 'right') return ' '.repeat(pad) + clipped;
  if (align === 'center') {
    const left = Math.floor(pad / 2);
    return ' '.repeat(left) + clipped + ' '.repeat(pad - left);
  }
  return clipped + ' '.repeat(pad);
}

/**
 * A new display ordering by column + direction (the RD-11 sorted-display PATTERN, not the code —
 * AR-158). Stable (ties keep source order); the original `rows` is never mutated.
 *
 * @param rows    The source rows.
 * @param columns The column descriptors (for the comparator / accessor).
 * @param sort    The active sort, or `null` for source order.
 * @returns A new array in the requested order, or `rows` unchanged when `sort` is `null` / invalid.
 */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState): T[] {
  if (sort === null || sort.col < 0 || sort.col >= columns.length) return rows;
  const col = columns[sort.col];
  const cmp = col.compare ?? ((a: T, b: T) => col.accessor(a).localeCompare(col.accessor(b)));
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => dir * cmp(a, b));
}
