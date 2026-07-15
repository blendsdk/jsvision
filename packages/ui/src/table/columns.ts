/**
 * Pure column math behind `DataGrid<T>` — the view-free core: the column descriptor types,
 * integer-correct width apportionment (with the `auto` pre-measure and the min/max clamp),
 * width-aware cell alignment, and the sort comparator. No view state and no signals; callers pass
 * plain snapshots, so every helper here is deterministic and directly testable.
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
  /** Typed sort comparator; default = locale-aware string compare of the `accessor` output. */
  readonly compare?: (a: T, b: T) => number;
  /** Lower clamp on the resolved width. */
  readonly minWidth?: number;
  /** Upper clamp on the resolved width, and the cap applied when measuring an `auto` column. */
  readonly maxWidth?: number;
}

/** The active sort: a column index + direction, or `null` for source order. */
export type SortState = { readonly col: number; readonly dir: 'asc' | 'desc' } | null;

/** Resolved per-column geometry for one draw (all integer, post-apportion). */
export interface ColumnGeometry {
  /** Content cells per column (excludes the divider cell). */
  readonly widths: number[];
  /** Absolute x of each column's content, pre-indent: `starts[c] = Σ_{k<c}(widths[k] + gap)`, where `gap` is 1 with dividers, 0 compact. */
  readonly starts: number[];
  /** The H-scroll content width: `Σ(widths[c] + gap)` (`gap` = 1 with dividers, 0 compact). */
  readonly totalWidth: number;
}

/**
 * Pre-measure `auto` columns to a fixed cell width across ALL current rows. This is the O(rows) pass;
 * wrap it in a `computed` over the rows signal so it re-runs only when the data changes, not every
 * frame.
 *
 * Per column: `null` for `number`/`fr` columns; for `auto`, the widest cell across all rows, floored
 * to the header title width (never 0 — an empty grid falls back to the title) and to `minWidth`, then
 * capped by `maxWidth` (if `minWidth > maxWidth`, `maxWidth` wins).
 *
 * @param columns The column descriptors.
 * @param rows    The current (unsorted) row snapshot.
 * @param measure Display-width function (measures each string in terminal cells, wide-glyph aware).
 * @returns One entry per column: the measured `auto` width, or `null` for non-`auto` columns.
 * @example
 * ```ts
 * const cols = [{ title: 'Name', accessor: (r) => r.name, width: 'auto' as const }];
 * measureAutoWidths(cols, [{ name: 'Ada' }, { name: 'Bartholomew' }], (s) => s.length); // [11]
 * ```
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
 * Apportion per-column integer widths and absolute start columns for a viewport — the O(cols)
 * per-draw pass.
 *
 * Reserves one divider cell per column (apportions over `viewportWidth − numCols`) so `fr` columns
 * fill the remaining viewport exactly, then applies the min/max clamps to `fr` results: a clamped
 * `fr` column is pinned to a fixed width and the track re-solved, converging in at most `numCols`
 * passes. Fixed and `auto` widths pass through unchanged, so an all-fixed track that overflows keeps
 * its widths (enabling horizontal scroll) rather than shrinking.
 *
 * Pass `dividers: false` to reserve **no** inter-column divider cell (a compact / dense layout): the
 * track apportions over the full `viewportWidth`, `starts` pack tightly, and `totalWidth` excludes the
 * dividers — so a caller that also skips painting the `│` stays aligned and its horizontal-scroll clamp
 * is correct. The default (`true`) is byte-identical to reserving one divider per column.
 *
 * @param columns       The column descriptors.
 * @param autoWidths    The {@link measureAutoWidths} result (memoize it upstream).
 * @param viewportWidth The data-area width in cells.
 * @param dividers      Reserve one divider cell per column (default `true`); `false` packs columns tight.
 * @returns The resolved {@link ColumnGeometry}; empty arrays + `totalWidth 0` for zero columns.
 * @example
 * ```ts
 * const cols = [
 *   { title: 'A', accessor: (r) => r.a, width: '1fr' as const },
 *   { title: 'B', accessor: (r) => r.b, width: 6 },
 * ];
 * apportionColumns(cols, [null, null], 20); // { widths: [12, 6], starts: [0, 13], totalWidth: 20 }
 * apportionColumns(cols, [null, null], 20, false); // compact: { widths: [14, 6], starts: [0, 14], totalWidth: 20 }
 * ```
 */
export function apportionColumns<T>(
  columns: Column<T>[],
  autoWidths: (number | null)[],
  viewportWidth: number,
  dividers = true,
): ColumnGeometry {
  const numCols = columns.length;
  if (numCols === 0) return { widths: [], starts: [], totalWidth: 0 };

  const gap = dividers ? 1 : 0; // cells reserved per column for the inter-column divider
  const trackTotal = Math.max(0, viewportWidth - numCols * gap);
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
    x += widths[c] + gap; // + the reserved divider cell(s) per column (0 in compact mode)
  }
  return { widths, starts, totalWidth: x };
}

/**
 * Clip `text` to exactly `width` cells (width-aware — never splits a wide/CJK glyph), then pad to the
 * requested alignment: `left` pads on the right, `right` pads on the left, `center` splits the
 * remainder (an odd extra cell goes to the right). The result is always exactly `width` cells. This
 * only clips and pads; the caller is responsible for sanitizing before drawing.
 *
 * @param text    The cell text.
 * @param width   The target cell width (≤ 0 returns an empty string).
 * @param align   The horizontal alignment.
 * @param measure Per-glyph display-width function (measures in terminal cells, wide-glyph aware).
 * @returns A string that occupies exactly `width` terminal cells.
 * @example
 * ```ts
 * alignCell('Ada', 6, 'right', (s) => s.length);         // '   Ada'
 * alignCell('Bartholomew', 6, 'left', (s) => s.length);  // 'Bartho' (clipped to 6 cells)
 * ```
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
 * Produce a new display ordering of `rows` by column + direction. Stable (ties keep source order),
 * and the original `rows` array is never mutated.
 *
 * @param rows    The source rows.
 * @param columns The column descriptors (supply the comparator / accessor).
 * @param sort    The active sort, or `null` for source order.
 * @returns A new sorted array, or the original `rows` unchanged when `sort` is `null` or its column
 *   index is out of range.
 * @example
 * ```ts
 * const cols = [{ title: 'Qty', accessor: (r) => String(r.qty), width: 'auto' as const, compare: (a, b) => a.qty - b.qty }];
 * sortRows([{ qty: 1000 }, { qty: 9 }], cols, { col: 0, dir: 'asc' }); // [{ qty: 9 }, { qty: 1000 }]
 * ```
 */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState): T[] {
  if (sort === null || sort.col < 0 || sort.col >= columns.length) return rows;
  const col = columns[sort.col];
  const cmp = col.compare ?? ((a: T, b: T) => col.accessor(a).localeCompare(col.accessor(b)));
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => dir * cmp(a, b));
}
