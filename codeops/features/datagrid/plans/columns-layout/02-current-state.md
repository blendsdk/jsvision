# Current State — Columns & Layout

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.7.0

A codebase-grounded map of the seams RD-07 builds on, and the hazards the pinned-panel refactor
must handle. All line refs are as of plan authoring (2026-07-15).

## 1. The column-geometry engine (`@jsvision/ui`)

Pure, view-free, in `packages/ui/src/table/columns.ts`; re-exported through `@jsvision/ui`.

- **`Column<T>`** (`columns.ts:20`) — the engine's string-accessor column. **Already carries
  `minWidth?` and `maxWidth?`** (`:32-33`); `measureAutoWidths` honors them (floors an `auto` width
  to `max(title, minWidth)`, caps by `maxWidth`, `:80`). RD-07 only needs to *populate* them from the
  typed `GridColumn` (AR-4).
- **`ColumnGeometry`** (`columns.ts:41`) — `{ widths[], starts[], totalWidth }`. `starts[c] =
  Σ_{k<c}(widths[k] + 1 divider)`; `totalWidth` is the H-scroll content width.
- **`measureAutoWidths(columns, rows, measure)`** (`:69`) — O(rows) pre-measure; memoized in a
  container computed (`grid.ts:237`). Returns `null` for non-`auto` columns. **Auto-fit reuses this.**
- **`apportionColumns(columns, autoWidths, viewportWidth)`** (`:118`) — O(cols) per-draw; reserves 1
  divider cell/column; bounded fixpoint clamps fr columns to min/max. Fixed/`auto` widths pass
  through unchanged, so an all-fixed track that overflows keeps its widths → this is what enables
  horizontal scroll. **⚠️ Naming:** its local `pinned[]` (`:127`) is fr-clamp bookkeeping, NOT
  frozen columns — RD-07 uses `frozen`/`panel`, never `pinned` (AR-7 naming rule).
- **`alignCell(text, width, align, measure)`** (`:179`) — wide-glyph-aware clip + pad.

**How datagrid consumes it:** `GridColumn<T,V>` → engine `Column<T>` via `toEngineColumn`
(`column.ts:158`, `width: c.width ?? 'auto'`, `:165`). `EditableGridRows` calls `this.geometry(width)`
(= `apportionColumns`) and `alignCell` when painting. `SortHeader` calls `apportionColumns` via its
own `geometry()` (`sort-header.ts:127`) over the **same** `columns`/`autoWidths`/`indent` inputs, so
header and body geometry can never disagree.

## 2. The pointer-capture seam (the resize/reorder foundation — **already exists**)

The event loop owns the capture target (`event-loop.ts:137,458-462`). The seam is attached to every
enriched event (`dispatch.ts:182-193`) and exposed on `DispatchEvent` as optional
`setCapture?(view)` / `releaseCapture?()` / `hasCapture?(view)` (`view/types.ts:143-147`). While a
target is captured, **every** mouse/wheel event short-circuits straight to it with recomputed
view-local coords (`hit-test.ts:144-149`) — so a drag keeps correct `ev.local` even after the pointer
leaves the affordance.

**Reference pattern (mirror this for column grips):** the Window resize grip. `Window` detects the
grip zone (`frame.ts:196-215`, `window.ts:283-287`) and delegates to `Desktop`, which captures
(`desktop.ts:220-227` `beginResize` → `this.loop?.setCapture(this)`), drives the captured stream
(`desktop.ts:246-263`, **checking `!ev.hasCapture(this)` first to abort a stale drag**), and releases
on `up` (`:264-270`). `ScrollBar` thumb-drag (`scroll-bar.ts:228,258`) is the closest small analogue.

**Consequence:** column resize/reorder is fully buildable in datagrid with the existing seam — **no
core/ui change** (contrast RD-05, which had to add mouse modifiers to core).

## 3. The sticky header today

The datagrid uses its own `SortHeader<T>` (`sort-header.ts`), a passive non-focusable `View`
(`:75-76`) separate from the scrolling body. Alignment to the body is guaranteed by *sharing the
exact inputs* (`grid.ts:265-291`): same `engineCols`, same memoized `autoWidths`, same `indent`.
Vertical-scroll separation is structural via the band layout (`grid.ts:297-349`): a fixed-1-cell
`topRow` holds the header, the body sits in an `fr` `bodyRow`; the header is one row, outside the
body view, so it is inherently sticky while the body's `topItem`/virtual window scrolls below it.
`SortHeader`'s own doc (`:11-13`) states it is `columnId`-keyed **so a later frozen-panel split can
bind several headers to one container signal** — exactly RD-07's need (AR-11).

## 4. Horizontal scroll = the `indent` signal

`indent: Signal<number>` is container-owned (`grid.ts:192`) and shared by every band (header
`:269`, body `:280`, quick-filter `:319`) and bound to the horizontal `ScrollBar` (`:293`). Every
painter offsets cells by `x = geom.starts[c] − indent`; there is no column culling — all columns are
drawn shifted and the draw context clips off-screen cells. Each view clamps `indent` to
`max(0, totalWidth − width)` on every draw (`editable-grid-rows.ts:287-289`). **For panels: only the
center binds the scrollable `indent`; frozen L/R pin `indent = 0`** (AR-7).

## 5. Reactive state — the pattern to mirror

Solid-style `signal`/`computed`/`effect` (`packages/ui/src/reactive/`). The container's `sortKeys`
(`grid.ts:199`) / `filters` (`:203`) are the exact template for RD-07's column-layout signals
(AR-13): one signal as source of truth, a reactive read accessor (`sort()` `:443`), writes funneled
through one mutator (`applySort` `:609`), and the same signal **injected** into sub-views so a panel
split binds the very same one. RD-07 adds `columnOrder`/`columnWidths`/`hidden` signals the same way.

## 6. The `devWarn` convention

`packages/ui/src/shared/warnings.ts` → `devWarn(scope, message)` — `console.warn` gated on
`NODE_ENV !== 'production'`. The over-pinning guard reuses this pattern (AR-9).

## 7. Hazards the panel refactor must handle

| # | Hazard | Mitigation (this plan) |
| - | ------ | ---------------------- |
| H1 | `EditableGridRows.geometry(width)` measures **all** columns against **its own** `bounds.width` (`grid-rows.ts:160`; `editable-grid-rows.ts:204,282`) — it assumes it owns the full data width. | Give each panel a **sliced** `columns`/`autoWidths` subset; each panel's geometry is over its slice + its own width. This "just works" because `apportionColumns` accepts any column array (03-02). |
| H2 | `focusedCol` is a single global `Signal<number>` indexing `this.columns` (`editable-grid-rows.ts:89,196,240-263`); the cursor overpaint/`cellRect` clamp to `this.columns.length`. | Keep **one global `focusedCol`** over the whole visible order; each panel maps it to a local slice index and paints the cursor only when it falls in its range (03-02, AR-6). |
| H3 | `indent` is shared and clamped per-view; three panels would clamp it three different ways and desync. | Center panel binds scrollable `indent`; frozen panels use a constant `signal(0)` (AR-7). |
| H4 | The editor overlay + filter popup are grid-local `fill` layers anchored via `absoluteRect` (`grid.ts:258,542`; `overlay.ts`); a frozen-panel cell doesn't scroll, a center cell does. | The overlay mount resolves the **owning panel's** absolute origin so the editor lands on the right cell (AR-10, 03-04). |
| H5 | `topItem` is per-`GridRows` instance (`grid-rows.ts:105`) — three panels = three independent vertical scrolls. | Drive all three panels from the **one shared `focused` signal with identical heights** so their virtual windows stay in lockstep (AR-6, 03-02). |
| H6 | No `columnOrder`/`columnWidth`/`frozen` state or order-indirection exists; `apportionColumns` consumes `columns` in array order. | `column-model.ts` owns order/width/visibility/freeze; the container derives the ordered/visible/partitioned `columns`/`typedColumns`/`columnIds` arrays before geometry (03-01, 03-04). |
| H7 | Resize/reorder grips have no home; `SortHeader.onEvent` (`:189-223`) handles only title + funnel clicks. | Add divider-grip + header-drag hit-zones to `SortHeader`, capturing via `ev.setCapture` (03-03, AR-12). |

## 8. What RD-01…06 already left in place for this

- Both container and body docstrings explicitly anticipate the frozen-panel split ("so a later
  frozen-panel split can bind the very same signals with no retrofit" — `grid.ts:10,186-188`;
  `editable-grid-rows.ts:1-7`).
- The shared cursor/selection/scroll signals are already container-owned and injected.
- `SortHeader` is already `columnId`-keyed and multi-header-ready.
- The engine `Column` already has `minWidth`/`maxWidth` honored by the geometry engine.

The architecture was designed for this feature; the work is the panel-coordination refactor + the
pure column-model + the two gestures, not a foundation change.
