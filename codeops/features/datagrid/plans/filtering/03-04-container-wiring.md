# Container Wiring: Filtering

> **Document**: 03-04-container-wiring.md
> **Parent**: [Index](00-index.md)

## Overview

The `grid.ts` changes that turn the model + UI into a working feature: the container-owned filter
signal, the `display` composition (filter → then sort), the `setFilter` push-down effect, the reactive
count, distinct delegation, funnel-driven popup opening, and the opt-in quick-filter band. Every seam
here is the direct twin of the RD-05 sort wiring already in `grid.ts`.

## Proposed Changes

### New state
```ts
// The single source of truth for the filter model — the quick-filter row, the popups, and the
// setFilter/clearFilter API all drive this one signal (twin of `sortKeys`).
private readonly filters = signal<FilterModel<T>>(new Map());
```

### `display` composition (AR #7)
Replace the sort-only derivation with filter-then-sort, each half applied client-side **only** when
its push-down seam is absent (so all four source combinations compose correctly):

```ts
this.display = this.derived(() => {
  this.version();
  let rows = materialize(this.source);
  if (!this.source.setFilter) rows = filterRows(rows, this.filters(), this.columnMap);
  if (!this.source.setSort) rows = sortRowsMulti(rows, this.sortKeys(), this.columnMap);
  return rows;
});
```

### Push-down effect (parallel to sort)
```ts
this.onMount(() => {
  if (this.source.setSort) this.bind(() => this.sortKeys(), (k) => this.source.setSort!(k));
  if (this.source.setFilter) this.bind(() => this.filters(), (m) => this.source.setFilter!(m)); // AR #7
});
```

### Filter API (AR #13)
```ts
/** Set (or replace) a column's filter. An unknown `columnId` is ignored — never forwarded to setFilter. */
setFilter(columnId: string, filter: ColumnFilter): void {
  if (!this.columnMap.has(columnId)) return;                 // AC-9
  const next = new Map(this.filters()); next.set(columnId, filter);
  this.applyFilter(next);
}
/** Clear one column's filter, or (no arg) all filters. */
clearFilter(columnId?: string): void {
  if (columnId === undefined) return this.applyFilter(new Map());
  const next = new Map(this.filters()); next.delete(columnId);
  this.applyFilter(next);
}
/** The current filter model (reactive). */
filterModel(): FilterModel<T> { return this.filters(); }
/** Rows passing all active filters (reactive). Client: display().length; push-down: source.length(). */
filteredCount(): number { return this.display().length; }
/** Pre-filter row count (reactive). See the count-semantics note below. */
totalCount(): number { return this.source.length(); }
```

**Count semantics.** On the **client path** `source.length()` is the true pre-filter total and
`display().length` is the filtered count, so "N of M" is exact. On a **push-down** source `length()`
already reflects the filtered set (AC-6), so `totalCount() === filteredCount()` there — a documented
v1 limitation (a push-down source exposes no separate pre-filter total until the RD-11 windowing
seam). The kitchen-sink story uses an in-memory source, so its echo is exact (AR #2).

### `applyFilter` — cursor/selection re-anchor
Reuse the `applySort` re-anchor pattern (`grid.ts:359`): snapshot the focused/selected row keys, set
`this.filters`, and — on the client path only — re-find them in the new `display()`. A filter can
**remove** the focused row entirely, so when the anchor is absent, clamp `focused` into
`[0, after.length - 1]` and set `selected` to `-1`. On a push-down source, return after setting the
signal (the async re-query re-anchors nothing synchronously). Factor the shared snapshot/re-find out
of `applySort`/`applyFilter` if it reads cleanly.

### Distinct delegation (AR #9)
```ts
private distinctFor(columnId: string): Promise<DistinctResult> {
  const col = this.columnMap.get(columnId);
  if (!col) return Promise.resolve({ values: [], truncated: false });
  return this.source.distinct
    ? this.source.distinct(columnId)                                        // windowed (may truncate)
    : Promise.resolve({ values: computeDistinct(materialize(this.source), col), truncated: false });
}
```

### Funnel → popup (AR #18)
`SortHeader` is constructed with the new members; the funnel click **forwards the live `DispatchEvent`**
so the container inherits the focus/popup seam (`ev.focusView`/`ev.popupHost`) the mount path needs:
```ts
filterModel: this.filters,
onFunnelClick: (columnId, anchor, ev) => this.openFilterPopup(columnId, anchor, ev),
```
`openFilterPopup(columnId, anchor, ev)` builds a `FilterPopup` for the column — passing
`current = this.filters().get(id)`, `filterType = resolveFilterType(col, sampleValue(id))`,
`distinct = () => this.distinctFor(id)`, and `onApply/onClear` routing to `setFilter`/`clearFilter`. It
computes the popup's absolute rect from `absoluteRect(header)` + the funnel anchor and mounts it via
`mountCellOverlay({ host: this.popupOverlay, loop: { focusView: (v) => ev.focusView?.(v) }, … })` — the
**exact** seam the cell editor uses (`editing.ts:196`). The popup's nested `ComboBox`/`DatePicker`
consume the spread envelope so their dropdowns open (a `ComboBox` silently no-ops without `ev.popupHost`
— `combo-box.ts:200`). The `popupOverlay` is a second hit-transparent `EditorOverlay`-style fill layer
added topmost, so a filter popup never collides with an open cell editor. `onClose` disposes the mount
(the `mountCellOverlay` disposer) and hides the layer.

> **Why `ev` is threaded, not stored:** nothing in the grid holds a focus seam outside an event —
> `EditableDataGrid` stores only signals + views (`grid.ts:135`), and every focus call in the package
> flows through an envelope's `ev.focusView`. So `openFilterPopup` must **receive** `ev`; `grid.ts`
> imports the `DispatchEvent` type for the signature. The seam parameter is added in **Phase 3** (when
> `onFunnelClick` is first wired to a placeholder), so Phase 4 fills a body that already has the right
> shape — no retro-change to `SortHeaderConfig`/`onEvent`.

### Opt-in quick-filter band (AR #3)
`EditableDataGridOptions<T>` gains `readonly quickFilter?: boolean`. When `true`, construct a
`QuickFilterRow` sharing `engineCols`/`columnIds`/`autoWidths`/`indent`, with
`onQuickFilter: (id, text) => text ? this.setFilter(id, { kind: 'text', op: 'contains', value: text })
: this.clearFilter(id)`. Insert it as a band (`fr` beside a `fixed1` corner, one cell tall) into the
`inner` column stack **between** `topRow` (header) and `bodyRow`. When `false`/omitted, the band is
never built and the layout is byte-identical to today.

## Integration Points
- `column.ts`: add `readonly filterType?: FilterType;` to `GridColumn` (AR #14).
- `data-source.ts`: import `FilterModel`/`DistinctResult` from `filter.ts`; widen `distinct`.
- `index.ts`: re-point `FilterModel`; export `filterRows`, `computeDistinct`, the
  `ColumnFilter`/`FilterModel`/`DistinctResult`/`FilterType` types, and (for bespoke grids)
  `QuickFilterRow`/`FilterPopup`/`ValueList` + their configs.
- `grid.ts`: import the `DispatchEvent` type (from `@jsvision/ui`) for `openFilterPopup`'s signature —
  the focus/popup seam is threaded from the funnel click, never stored (AR #18).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `setFilter`/`clearFilter` on an unknown column | No-op; never forwarded to `setFilter` push-down | AR #13 / AC-9 |
| Filter removes the focused/selected row | `applyFilter` clamps `focused`; sets `selected` to `-1` | AR #7 |
| Popup opened while editing | Dedicated popup overlay, separate from the editor overlay | AR #11 |
| Quick-filter Input vs. a popup filter on one column | Last-writer-wins (one `ColumnFilter` per column); the Input mirrors only `text` filters — no two-way sync in v1 | AR #20 |
| Push-down source: pre-filter total unknown | `totalCount() === filteredCount()`; documented v1 limitation | AR #2 |

> **Traceability:** every strategy cites its AR. See `00-ambiguity-register.md`.

## Testing Requirements
- `setFilter`/`clearFilter`/`filterModel`/`filteredCount`/`totalCount`; client filter+sort
  composition; push-down `setFilter` spy (no client filter); unknown-column no-op; cursor re-anchor
  on a row-removing filter; distinct delegation (client vs `source.distinct`). ST cases:
  `07-testing-strategy.md` (ST-12…ST-16, ST-27).
