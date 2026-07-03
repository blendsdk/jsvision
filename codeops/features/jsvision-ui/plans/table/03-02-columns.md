# Columns module: Table / DataGrid

> **Document**: 03-02-columns.md
> **Parent**: [Index](00-index.md)

## Overview

`columns.ts` — the pure, view-free column math: the `Column<T>`/`ColumnWidth` types, width apportion
(over RD-02 `solveTrack`, incl. the `auto` pre-measure + min/max clamps), the shared column-geometry
resolver, cell extraction + alignment, and the `{col,dir}` sort comparator. Kept separate so `grid-rows.ts`
stays ≤ 500 lines (AR-178) and every piece is unit-testable without a view.

## Architecture

Pure functions + the type declarations. No view state, no signals — callers pass snapshots.

## Implementation Details

### Types

```ts
export type ColumnWidth = number | `${number}fr` | 'auto';

export interface Column<T> {
  readonly title: string;
  readonly accessor: (row: T) => string;
  readonly width: ColumnWidth;
  readonly align?: 'left' | 'right' | 'center';   // default 'left'
  readonly compare?: (a: T, b: T) => number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
}

export interface ColumnGeometry {
  readonly widths: number[];      // content cells per column (integer, post-apportion)
  readonly starts: number[];      // absolute x of each column's content (pre-indent)
  readonly totalWidth: number;    // Σ(widths[c] + 1 divider); the H-scroll content width
}
```

### Column geometry — split into measure (O(rows)) + apportion (O(cols)), AR-173/AR-174/AR-179

The geometry source is **two** functions so the expensive O(rows) `auto` scan runs only on a data change
(a `computed`) while the cheap O(cols) apportion runs per draw (viewport width is not reactive) — honouring
AR-173's "no per-frame O(rows)" (PF-102):

```ts
/**
 * Pre-measure `auto` columns to a fixed cell width over ALL current rows (the O(rows) part — AR-173).
 * Wrapped in a `computed` over the `rows` signal in data-grid.ts, so it re-runs on data change, not per frame.
 * @returns one entry per column: the measured `auto` width, or `null` for `number`/`fr` columns.
 */
export function measureAutoWidths<T>(
  columns: Column<T>[], rows: T[], measure: (s: string) => number,
): (number | null)[];

/**
 * Apportion per-column integer widths + absolute starts for a viewport (the O(cols) per-draw part).
 * @param columns       The column descriptors.
 * @param autoWidths    The measureAutoWidths result (memoized upstream).
 * @param viewportWidth The data-area width in cells.
 */
export function apportionColumns<T>(
  columns: Column<T>[], autoWidths: (number | null)[], viewportWidth: number,
): ColumnGeometry;
```

`measureAutoWidths` (O(rows)): `autoW(c) = clamp( max over ALL rows of measure(accessor(row)),
maxOf(c.title width, c.minWidth ?? 0), c.maxWidth ?? ∞ )`; empty rows → the header title width (never 0);
`null` for non-`auto` columns.

`apportionColumns` (O(cols), per draw):

1. **Build `TrackItem[]`**: `number` or an `auto` measured width → `{kind:'fixed', size}`; `` `${n}fr` `` →
   `{kind:'flex', weight:n}`. **Reserve dividers**: apportion over `viewportWidth - numCols` (one divider
   cell per column, AR-179), so `fr` columns fill the remaining viewport exactly.
2. **`solveTrack`** the fixed/flex items → `widths` (integer-correct, sums exactly; `apportion.ts`).
3. **Apply min/max clamps** (Should-Have, AR-175) to `fr` results; re-run step 2 with clamped columns
   pinned as `fixed` if any clamp bit (a bounded fixpoint, ≤ numCols passes).
4. **`starts[c]` = Σ_{k<c}(widths[k] + 1)**; **`totalWidth` = Σ(widths[c] + 1)**.

> **Decision per AR-173:** `auto` measured over ALL current rows, `maxWidth`-or-uncapped, recomputed on
> data change. **Rejected:** visible-window measurement (width jitters on scroll). The O(rows) measurement
> is a `computed` in `data-grid.ts` (re-runs on the `rows` signal only); the per-draw path calls just the
> O(cols) `apportionColumns`.

### `extractCell` + `alignCell`

```ts
/** The clipped, aligned cell string for a column, exactly `width` cells wide (AC-4). */
export function alignCell(text: string, width: number, align: Align, measure: (s: string) => number): string;
```

- Clip to `width` **width-aware** via `glyphWidth` (never split a wide/CJK glyph — PF-104), then pad:
  `left` → pad right; `right` → pad left; `center` → split the remainder (extra cell to the right). Output
  is exactly `width` cells (AC-4, AC-13). This is a deliberate improvement over `ListRows`' character-based
  `text.slice(0, textWidth)` (`list-rows.ts:211`), which miscounts wide glyphs; `alignCell` builds its own
  width-aware clip from `glyphWidth` (there is no shared clip helper in `measure.ts`).
- The clipped/padded string is passed to `ctx.text`, which sanitizes — `alignCell` only clips/pads.

### `sortRows` — the `{col,dir}` comparator (AR-158)

```ts
/**
 * A new display ordering by column + direction (the RD-11 sorted-display PATTERN, not the code — AR-158).
 * @returns a new array (stable); the original `rows` is untouched.
 */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState): T[];
```

- `sort===null` → return `rows` unchanged (source order).
- Else pick `col = columns[sort.col]`; comparator = `col.compare ?? (a,b) =>
  col.accessor(a).localeCompare(col.accessor(b))` (locale-aware default, AR-158); apply `dir` (`desc`
  negates); `[...rows].sort(cmp)` (JS sort is stable → ties keep source order).
- Numeric columns supply `compare: (a,b) => a.n - b.n` and sort numerically (AC-6).

## Integration Points

- `data-grid.ts` wraps `sortRows` in the `display` computed and `measureAutoWidths` in an `autoWidths`
  computed (over the `rows`/`display` signal); `grid-rows.ts`/`GridHeader` call `apportionColumns`
  (per draw, with the current `bounds.width` + the memoized `autoWidths`) + `alignCell`.
- `measure` = `stringWidth` from `../controls/measure.ts` (the shipped wcwidth width function) — reused,
  no new width code.

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| `columns = []` | `apportionColumns` returns `{widths:[],starts:[],totalWidth:0}`; callers draw a blank field | AC-14 |
| `rows = []` for `auto` | `auto` width falls back to the title width (never 0) | AR-173/AC-14 |
| `minWidth > maxWidth` | `maxWidth` wins (clamp order: min then max) — documented; caller error is bounded, no crash | AR-175 |
| `sort.col` out of range | Guard: treat as `null` (source order) — never index an absent column | AC-9 |
| Fractional `fr` weight | `apportion` rounds weights (existing behaviour, `apportion.ts:36`) | — |

## Testing Requirements

- Unit: `apportionColumns` (all-fr fills viewport; all-fixed overflow → `totalWidth > viewport`; min/max
  clamps; divider reservation; zero-col) + `measureAutoWidths` (measures widest incl. title; empty→title;
  `maxWidth` cap). `alignCell` (left/right/center, clip, wide-glyph). `sortRows` (asc/desc, numeric
  `compare`, locale default, stable ties, null).
