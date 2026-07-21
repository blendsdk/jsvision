# Quick-Filter Row & Funnel Header: Filtering

> **Document**: 03-02-quick-filter-and-header.md
> **Parent**: [Index](00-index.md)

## Overview

The two always-visible filter surfaces: the opt-in **quick-filter row** (`quick-filter-row.ts`, a new
band) and the **funnel indicator** merged into the existing `SortHeader` (`sort-header.ts`). Both
share the body's column geometry (`apportionColumns`/`alignCell`/`stringWidth`) and horizontal-scroll
`indent`, so they stay column-aligned and pan in lockstep with header and body.

## Component A — `QuickFilterRow<T>`

### Architecture
A `Group` band, one cell tall, holding one live `Input` per column (AR #12). Enabled only when the
container passes `quickFilter: true` (AR #3); otherwise the band is never constructed and the grid's
height is unchanged. Sits between the header `topRow` and the `bodyRow` in the container's `inner`
column stack.

### Implementation Details

```ts
export interface QuickFilterRowConfig<T> {
  columns: Column<T>[];                 // shared with header + body (geometry never disagrees)
  columnIds: readonly string[];         // index → columnId
  autoWidths: () => (number | null)[];  // shared measure
  indent: Signal<number>;               // shared H-scroll offset — pans with the body
  /** Live contains-match: the column's Input text (empty string ⇒ clear this column's filter). */
  onQuickFilter: (columnId: string, text: string) => void;
}

export class QuickFilterRow<T> extends Group {
  // Builds one Input per column, each over its own value signal. Binds each Input's value to
  // onQuickFilter(columnId, text). Repositions the Inputs on every geometry / indent / width change:
  // each Input gets an absolute rect at { x: starts[c] - indent, y: 0, width: max(0, widths[c] - 1) }
  // (width-1 leaves the divider column), clipped by the band bounds so off-screen Inputs pan away.
}
```

- **Contains-match wiring (AR #4):** an Input's text `t` maps to the filter `{ kind: 'text', op:
  'contains', value: t }` set on that column (the container's `onQuickFilter` calls `setFilter`); an
  **empty** `t` calls `clearFilter(columnId)`. The predicate matches the formatted display
  (`03-01 §Predicate semantics`).
- **Geometry sharing:** identical inputs to `SortHeader.geometry` — `apportionColumns(columns,
  autoWidths(), width)` — and the same `clampedIndent`, so the Inputs line up under their titles and
  pan with the body.
- **Focus:** the Inputs are ordinary focusable children; the band participates in tab/focus order
  above the body. The band itself is a passive `Group`.

## Component B — `SortHeader` funnel extension

### Proposed Changes
`SortHeader` gains filter awareness (AR #11). Two new config members:

```ts
export interface SortHeaderConfig<T> {
  // …existing: columns, columnIds, autoWidths, indent, sort, onHeaderClick…
  /** The container's filter model, read to render the funnel on filtered columns. */
  filterModel: Signal<FilterModel<T>>;
  /**
   * Reports a funnel-cell click: the column, the funnel cell's header-local anchor (for the popup), and
   * the live `DispatchEvent`. The envelope is forwarded because the focus/popup seam
   * (`ev.focusView` / `ev.popupHost`) lives on it — the container needs it to focus the mounted popup
   * and to let the popup's nested `ComboBox`/`DatePicker` open their dropdowns, exactly as the cell
   * editor mounts (`editing.ts:196`, `:224`; a `ComboBox` no-ops without `ev.popupHost`). The `{x,y}`
   * anchor alone is not sufficient. `DispatchEvent` is already imported by this module (AR #18).
   */
  onFunnelClick: (columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void;
}
```

### Draw — reserved-cell layout

Extend the existing reserve logic (`sort-header.ts:128`). Per column, from the right edge:

| Cell (from right) | Glyph | Condition |
|-------------------|-------|-----------|
| `x + w - 1` | sort arrow `▲`/`▼` | column is sorted |
| `x + w - 2` | 1-based priority digit | multi-sort **and** sorted |
| `x + w - 1 - sortReserve` | funnel `▽` | column has an active filter |

where `sortReserve = sorted ? (multi ? 2 : 1) : 0` and the total reserved width is `sortReserve +
(filtered ? 1 : 0)`, clamped to `w`. The title clips into `w - reserve`; the funnel and sort glyphs,
drawn last, are never overwritten. The funnel glyph `▽` (U+25BD) matches the sort arrows' width class
(the header already ships the ambiguous-width `▲`/`▼`).

### Event — funnel-vs-title routing

Extend `onEvent` (`sort-header.ts:149`). On a mouse-down, in header-local content space (x + indent):

1. If the click lands on a **funnel cell** (a filtered column whose funnel x equals the click x) →
   `onFunnelClick(columnId, { x: funnelLocalX, y: 0 }, ev)` — the same `ev` this handler received, so
   the container inherits its focus/popup seam (AR #18) — and `ev.handled = true`.
2. Else if it lands in a column's **content** (`columnAtX`, divider excluded) → `onHeaderClick`
   (sort), as today.
3. Else (divider / past last column) → unhandled, falls through.

A module-private `funnelColumnAt(geom, x, isFiltered, sortReserveOf)` returns the funnel-hit columnId
(or `-1`), checked **before** `columnAtX` so a funnel click never also sorts.

## Integration Points

- The container constructs `SortHeader` with the new `filterModel`/`onFunnelClick` members and, when
  `quickFilter`, a `QuickFilterRow` sharing the same `columns`/`columnIds`/`autoWidths`/`indent`.
- `onFunnelClick`'s local anchor is translated to an absolute popup rect by the container via
  `absoluteRect(header)` (already in `overlay.ts`) — see `03-03` / `03-04`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Column too narrow for funnel + sort glyphs | Reserve clamped to `w`; glyphs drop right-to-left (arrow last survives, as today) | AR #11 |
| Quick-filter Input for an off-screen column | Repositioned to a negative x, clipped by the band bounds (pans away) | AR #12 |
| Empty quick-filter text | Maps to `clearFilter(columnId)` — never an empty-needle `contains` (which would match all) | AR #4 |
| Quick-filter Input and a popup filter on the same column | Last-writer-wins (one filter per column via the model `Map`): the Input reflects only `text` filters; a popup-set `set`/`number`/`date` filter leaves the Input blank while the funnel shows the column is filtered. No two-way sync in v1. | AR #20 |

> **Traceability:** every strategy cites its AR. See `00-ambiguity-register.md`.

## Testing Requirements
- `QuickFilterRow`: band absent unless `quickFilter`; one Input per column; typing sets a
  `text/contains` filter; clearing the Input clears the column's filter.
- `SortHeader`: funnel renders on a filtered column, absent when cleared; funnel-cell click fires
  `onFunnelClick`; a title click still fires `onHeaderClick` (sort). ST cases: `07-testing-strategy.md`
  (ST-17…ST-20).
