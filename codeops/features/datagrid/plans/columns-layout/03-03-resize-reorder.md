# 03-03 — Resize & Reorder Gestures + Auto-fit

> **Parent**: [Index](00-index.md) · **AR**: AR-12, AR-4 · Reference: `desktop.ts:220-271`, `scroll-bar.ts:228`

Both gestures live on `SortHeader` (the header owns the column geometry + the divider glyphs) and use
the **existing** `ev.setCapture?.(this)` / `ev.releaseCapture?.()` / `ev.hasCapture?.(this)` seam —
no core/ui change (AR-12). Each `SortHeader` reports the gesture up to the container via new config
callbacks, which mutate the shared column-layout signals.

## Header hit-zones

`SortHeader.geometry()` already yields `starts[]`/`widths[]`. Add a zone classifier on mouse-down
(mirrors `frameZoneAt`, `frame.ts:196`):

- **Resize grip** — the 1-cell divider column at `starts[c] + widths[c] − indent` (the `│` at
  `sort-header.ts:176`), for each column `c`. A down here begins a **resize** of column `c`.
- **Title body** — the rest of a column's cells. A **press-and-drag** past a 1-cell threshold begins
  a **reorder** of column `c`; a click without drag stays the existing sort/funnel behavior
  (unchanged — the gesture only starts once the pointer moves).

Zone precedence: grip > title. The classifier returns `{ kind: 'resize' | 'reorder' | 'none', col }`.

## Resize gesture (AC-1)

1. **down on a grip** → record `startX = ev.local.x`, `startWidth = columnWidth(colId)`,
   `ev.setCapture?.(this)`; set a `resizing` flag.
2. **captured `move`/`drag`** → `next = clampWidth(startWidth + (ev.local.x − startX), col.minWidth,
   col.maxWidth)` (03-01); `onColumnResize(colId, next)` → container `setColumnWidth`. **Live** — the
   width signal changes each move and the grid repaints, neighbours reflow (fr columns re-apportion).
3. **`up`** → clear `resizing`, `ev.releaseCapture?.()`.
4. **stale-capture guard** — like `Desktop`, check `!ev.hasCapture?.(this)` first and abort a
   half-finished resize if capture was lost (`desktop.ts:252`).

The width is stored as an explicit override in `columnWidths` (03-04); a column with an explicit
width apportions as `fixed`, so resizing an `auto`/`fr` column pins it. Clamp floors to
`minWidth ?? 3` (AR-4).

## Auto-fit (AC-7)

- **Double-click a grip** → `autoFitColumn(colId)`. Reuses the container's memoized `autoWidths`
  computed (`measureAutoWidths`, `grid.ts:237`): the fitted width is
  `clampWidth(autoWidth ?? titleWidth, col.minWidth, col.maxWidth ?? DEFAULT_AUTOFIT_MAX)` — bounded
  by `maxWidth ?? 60` (AR-4). Sets an explicit width override.
- **API** `autoFitColumn(id)` / `autoFitAll()` on the container do the same without a gesture.
- Double-click detection: two grip-downs within the framework's existing double-click window (reuse
  the mouse event's click-count if present, else a small time/space heuristic already used elsewhere —
  confirm the available signal during impl; if none, a plain `autoFitColumn` API + a documented
  single-primitive gesture is acceptable and the double-click is a thin add).

## Reorder gesture (AC-2)

1. **down on a title** → record `sourceCol`, `ev.setCapture?.(this)`, set `reordering` with a pending
   flag (no visual change until the pointer moves past 1 cell — so a plain click still sorts).
2. **captured `drag` past threshold** → compute the **target slot** from `ev.local.x` against
   `starts[]`; draw a **drop indicator** (a `▮`/`│`-style marker in an accent role at the target
   column boundary). The target is constrained to the **source column's panel** — a drag beyond the
   panel's edge pins the indicator at the panel boundary (visually shows "can't cross").
3. **`up`** → if the target ≠ source and same panel, `onColumnReorder(from, to)` → container
   `reorderWithinPanel` (03-01) → `setColumnOrder`. A cross-panel drop is **rejected** (order
   unchanged, AC-2). Clear `reordering`, `ev.releaseCapture?.()`.
4. **stale-capture guard** as above.

Because each `SortHeader` instance only spans its own panel's columns (03-02), "within its panel" is
naturally enforced — a header only ever sees its slice's columns; the container maps the panel-local
indices to global visible-order indices for `reorderWithinPanel`.

## New `SortHeader` config

```ts
interface SortHeaderConfig<T> {
  // …existing…
  readonly onColumnResize?: (columnId: string, width: number) => void;   // live resize
  readonly onColumnAutoFit?: (columnId: string) => void;                  // double-click grip
  readonly onColumnReorder?: (fromVisible: number, toVisible: number) => void; // drop (visible-order indices)
  readonly columnOffset?: number; // this panel's slice start in global visible order (for reorder mapping)
}
```

All optional — a header with none behaves exactly as today (RD-05/06 grids unaffected).

## Testing hooks

Spec (03-07): a grip drag changes `columnWidth` live + clamps at min (AC-1); a title drag past
threshold reorders within panel and updates `columnOrder`, a cross-boundary drop leaves the order
unchanged (AC-2); `autoFitColumn` sizes to the widest visible cell bounded by max (AC-7). Gestures
are driven headlessly with synthetic captured mouse-move/up envelopes carrying `local` (the same
harness `scroll-bar`/`slider` tests use).
