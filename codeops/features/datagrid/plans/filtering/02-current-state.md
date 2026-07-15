# Current State: Filtering

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

RD-01…RD-05 shipped the foundation, editing engine, cell editors, formatting, and sorting. The
filtering seams are already stubbed and the sort architecture is the direct template to follow:

- **`data-source.ts`** declares the read/mutate seam. `FilterModel<T>` is a **forward-declared
  placeholder** (`{ conditions?; rowType? }` — `data-source.ts:16`) whose shape is defined "by the
  filtering subsystem". `setFilter?(model: FilterModel<T>)` (`:43`) and
  `distinct?(columnId: string): Promise<string[]>` (`:45`) are declared but unimplemented. `fromRows`
  (`:65`) is the in-memory source over a reactive `Signal<T[]>`; it carries only `rowKey`/`length`/
  `rowAt` — **no column model**, so it cannot compute `format∘value` distinct itself (AR #9).
- **`grid.ts`** — `EditableDataGrid<T>` owns the shared cursor/selection/scroll signals and, since
  RD-05, a `sortKeys = signal<SortKey[]>([])` single source of truth. `display` is a pure `derived`
  that materializes rows and, on the client path, sorts via `sortRowsMulti` (`grid.ts:174`); a
  **separate guarded `onMount` effect** pushes the model down when `source.setSort` exists (`:183`).
  `applySort` re-anchors the cursor/selection by `rowKey` after a re-sort (`:359`). The band layout
  stacks `topRow` (header) / `bodyRow` (rows + vbar) / `botRow` (hbar) in an `inner` column, with an
  `EditorOverlay` on top (`:135`–`:260`). This is the exact seam filtering extends.
- **`sort.ts`** — the pure, view-free sort model: `sortRowsMulti`, the type-aware `compareValues`
  (`typeof number` → numeric, `instanceof Date` → chronological, else a memoized collator). `filter.ts`
  is its direct structural analog (AR #6).
- **`sort-header.ts`** — `SortHeader<T>` (the datagrid's own header View) draws the title + a
  reserved-cell sort arrow / priority digit and routes a content-cell click to `onHeaderClick`
  (`sort-header.ts:149`). `columnAtX` (`:169`) resolves a click's x to a column, excluding the divider.
  The funnel indicator + funnel-click routing extend this (AR #11).
- **`column.ts`** — `GridColumn<T, V>` carries `value` (the filter key), optional `format`, `compare`,
  `nulls`. `filterType?` is the one new optional field (AR #14). `toEngineColumn` and the value-aware
  `defaultCompare` are untouched.
- **UI primitives available** — `Input` (+ `filter` validator), `ListView`/`ListBox`, `CheckGroup`,
  `MenuPopup`, `PopupHost`, `ComboBox`, `StatusLine`. Anchored popups over the grid are proven: RD-03
  mounts `DatePicker`/`ComboBox`/`CheckGroup` cell editors in the `EditorOverlay`.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/datagrid/src/filter.ts` | The pure filter model | **New** — `ColumnFilter`, `FilterModel`, predicate derivation, `filterRows` |
| `packages/datagrid/src/quick-filter-row.ts` | The opt-in quick-filter band | **New** — one `Input` per column → `text/contains` filter |
| `packages/datagrid/src/filter-popup.ts` | Condition-filter popup | **New** — type-appropriate operators + operand inputs |
| `packages/datagrid/src/value-list-popup.ts` | Excel value-list popup | **New** — distinct checkbox list + search + Select All + truncation note |
| `packages/datagrid/src/column.ts` | Typed column model | Add optional `filterType?: 'text'\|'number'\|'date'` |
| `packages/datagrid/src/data-source.ts` | The read/mutate seam | Import `FilterModel` from `filter.ts`; widen `distinct` → `Promise<DistinctResult>` |
| `packages/datagrid/src/sort-header.ts` | The datagrid header | Funnel glyph on filtered columns + `onFunnelClick` routing |
| `packages/datagrid/src/grid.ts` | The container | `Signal<FilterModel<T>>`, `display` composition, push-down, count, distinct delegation, popups, `quickFilter` band |
| `packages/datagrid/src/index.ts` | Public barrel | Export the filter model + popups; re-point `FilterModel` |

### Code Analysis

The sort push-down effect is the exact pattern for filter push-down (`grid.ts:183`):

```ts
this.onMount(() => {
  if (this.source.setSort) {
    this.bind(() => this.sortKeys(), (keys) => this.source.setSort!(keys));
  }
});
```

`display` composes on the client path only (`grid.ts:174`):

```ts
this.display = this.derived(() => {
  this.version();
  const rows = materialize(this.source);
  return this.source.setSort ? rows : sortRowsMulti(rows, this.sortKeys(), this.columnMap);
});
```

Filtering slots into both: `display` gains `filterRows(rows, this.filterModel(), this.columnMap)`
**before** `sortRowsMulti` on the client path (AR #7); a parallel guarded effect pushes `setFilter`.

## Gaps Identified

### Gap 1: No filter model
**Current:** `FilterModel<T>` is a `{ conditions?; rowType? }` placeholder; no predicates, no evaluator.
**Required:** the RD's `ColumnFilter` union + `FilterModel = ReadonlyMap<columnId, ColumnFilter>` +
predicate derivation + pure `filterRows`.
**Fix:** create `filter.ts` (AR #6); re-point `data-source.ts`/barrel.

### Gap 2: No filter evaluation in the container
**Current:** `display` only sorts; the grid has no filter API and no reactive filtered count.
**Required:** `display` filters-then-sorts (client), a `setFilter` push-down effect, and
`setFilter`/`clearFilter`/`filterModel`/`filteredCount`/`totalCount` (AR #7, #13).

### Gap 3: No filter UI
**Current:** header sorts only; no quick-filter row, no funnel, no popups.
**Required:** the opt-in quick-filter band, the funnel in `SortHeader`, and the two anchored popups
(AR #3, #11).

### Gap 4: `distinct` cannot disclose truncation
**Current:** `distinct(columnId): Promise<string[]>` — no truncation signal, no in-memory impl.
**Required:** widen to `Promise<{ values, truncated? }>` (AR #5); grid-owned client computation (AR #9).

## Dependencies

### Internal Dependencies
- RD-01 (column model, data source, container), RD-04 (`format` for the display-match + value-list
  labels), RD-05 (the `display`/push-down/header seams this plan extends).

### External Dependencies
- None — `@jsvision/datagrid` is zero-runtime-dependency; the filter model is pure TS and the UI
  reuses existing `@jsvision/ui` widgets.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Popup composition over the grid overlay is fiddly | Low | Med | Proven by RD-03 editors in the same overlay; reuse `PopupHost`/`ComboBox`/`CheckGroup` |
| Funnel cell collides with the sort arrow/digit reservation | Med | Med | Extend `SortHeader`'s existing reserve logic — one more reserved cell, clamped to width (03-02) |
| Runtime filter-type inference misclassifies sparse columns | Low | Low | Sample the first non-null value; `filterType?` override is the escape hatch (AR #14) |
| Client vs. push-down count divergence | Low | Med | `filteredCount`/`totalCount` read the same seam sort uses; push-down count from `source.length()` |
