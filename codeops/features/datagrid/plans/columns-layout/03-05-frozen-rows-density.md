# 03-05 — Frozen Rows & Density

> **Parent**: [Index](00-index.md) · **AR**: AR-14, AR-15

The two RD-07 "Should / Phase B-C" extras pulled forward by AR-1. Both are additive and default-off /
default-normal, so a grid that sets neither is byte-identical to the panels-only build.

## Frozen rows (AR-14) — `freezeRows?: number`

Pin the first **N data rows** as a non-scrolling band directly **below the header** and **above** the
virtual body, sharing each panel's column geometry (the horizontal mirror of frozen columns).

- **Structure.** A new fixed-height (`N` cells) band mirrors the body's panel split
  `[left | divider | center | divider | right | corner]`, so a frozen row aligns to the columns and
  to any frozen columns. The band is a thin `EditableGridRows`-like renderer (or the same class
  configured with a fixed `display` = the first N rows and no vertical scroll) — reuse the cell-draw
  path so custom `render`/`cellStyle`/dirty markers still apply to a pinned row.
- **Virtual window.** The scrolling body's `display` **excludes** the first N rows (its virtual
  window starts at row N); the pinned band renders exactly those N. So a pinned row never appears
  twice and never scrolls out.
- **Cursor.** The row cursor still ranges over the **whole** logical row set; when the cursor sits on
  a pinned row it highlights in the frozen band (the band shares `focused`/`selected`). Moving the
  cursor from a pinned row into the body scrolls the body normally.
- **Interaction with frozen columns.** Frozen rows compose with frozen columns: the top-left
  intersection (frozen rows × frozen columns) is fully pinned on both axes — it falls out naturally
  because the frozen-rows band itself uses the panel split.
- **Guard.** `freezeRows` clamps to `[0, displayLength]`; `0` (default) builds no band. Over-freezing
  rows (N ≥ viewport height) clamps so ≥ 1 scrolling body row remains, with a `devWarn` (mirrors the
  column over-pin guard, AR-9).

## Density / compact mode (AR-15) — `density?: 'normal' | 'compact'`

- **`'normal'`** (default) — unchanged: the `│` inter-column divider is drawn at each column's right
  edge (`editable-grid-rows.ts:367`, `sort-header.ts:176`).
- **`'compact'`** — **drop the divider**, reclaiming its 1 cell per column. The divider cell is part
  of `apportionColumns`'s reserved-per-column cell (`columns.ts:126`), so compact mode passes a flag
  down so the geometry reserves **0** divider cells and the painters skip the `│`. This widens the
  usable content area and reads denser.
- **Threading.** `density` is a container option → injected into every band (header, panels,
  frozen-rows band, quick-filter row) as a `compact: boolean`, exactly like `indent`/`zebra` are
  injected. Header and all panels must agree so columns stay aligned.
- **No row-height change** — rows are already 1 cell tall in this TUI; "compact" is horizontal only
  (divider removal). A future multi-line-row mode is out of scope.

### Geometry impact (AR-17 — decided at preflight, PF-001)

`apportionColumns` reserves **one** divider cell per column, hardcoded in **two** spots that
`solveTrack`'s `gap` does NOT route through: `columns.ts:126` (`trackTotal = viewportWidth −
numCols`) and `columns.ts:157` (`x += widths[c] + 1`; this also defines `totalWidth`). The earlier
"forward `solveTrack`'s `gap`" idea is **refuted** — `solveTrack`'s `gap` (`apportion.ts:99`) is
inter-item spacing inside free-space distribution, a different mechanism; forwarding it leaves both
`- numCols` and `+ 1` intact, so the dividers stay reserved.

Compact mode therefore takes the plan's **one ui touch**: an **additive optional param on
`apportionColumns`** (`@jsvision/ui`) — e.g. `dividers?: boolean` (default `true`) or a divider-cell
count — that gates **both** spots (`- numCols` → `- numCols·dividers`, `+ 1` → `+ dividers`). It is
additive + optional, so every existing caller (`grid-rows.ts`, `sort-header.ts`, the base engine) is
byte-identical when the param is omitted. `ColumnGeometry.totalWidth` then correctly reflects the
compact width so H-scroll clamps right. The datagrid threads `dividers: density !== 'compact'` into
its `geometry()` calls. This is a small, honest, uniform change benefiting header + body +
quick-filter together (contrast an inline datagrid re-implementation, which would duplicate the
apportionment logic and risk drift — rejected).

## Testing hooks

Spec (03-07): `freezeRows: 1` renders a pinned first row that stays put while the body scrolls
vertically; the body's virtual window starts after the pinned rows (no duplicate). `density:
'compact'` draws no `│` and widens content; header + body stay column-aligned in both modes. Impl:
over-freeze rows clamps + devWarn; frozen rows × frozen columns intersection pins on both axes.
