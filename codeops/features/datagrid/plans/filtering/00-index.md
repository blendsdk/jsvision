# Filtering Implementation Plan

> **Feature**: Excel-class column filtering for `@jsvision/datagrid` — quick-filter row, condition filters, value-list, funnel + "N of M", multi-column AND, and push-down
> **Status**: Planning Complete
> **Created**: 2026-07-15
> **Implements**: datagrid/RD-06
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-06 adds filtering to the editable data grid. Like sorting (RD-05), every filter evaluates a
column's **typed value** (from `GridColumn.value`), never the formatted display string — except the
quick-filter row and any text `contains`/`startsWith`/`endsWith`/`equals` filter, which match the
**formatted display** (what the user sees and types; AR #4). Active filters across columns combine
with **AND** (AR #8), and — when the data source supports it — filtering pushes down to the source
via `setFilter(model)` instead of filtering in memory, exactly as `setSort` does for ordering.

The load-bearing architecture (AR #6) mirrors the sort design: a pure, view-free **`filter.ts`**
owns the model (`ColumnFilter`, `FilterModel`, the per-filter predicate derivation, and
`filterRows`); a container-owned `Signal<FilterModel<T>>` is the single source of truth; the grid's
`display` derives **filter → then sort** on the client path (AR #7); and a separate guarded effect
pushes the model down when the source exposes `setFilter`. On top of the data plane sit three UI
surfaces: an opt-in **quick-filter row** (default off, AR #3) with one inline `Input` per column, a
**funnel indicator** merged into the existing `SortHeader` (AR #11) that opens two anchored popups —
the **condition filter** (type-appropriate operators) and the **Excel value-list** (a distinct
checkbox picker with type-ahead search + Select All). Anchored popups over the grid are a proven
pattern here — RD-03 already mounts `DatePicker`/`ComboBox`/`CheckGroup` cell editors in the overlay.

This plan ships **all of RD-06's Must-Haves** (AR #1), phased data-plane-first so acceptance criteria
land incrementally. The "N of M" count is exposed as reactive API and demonstrated in the kitchen-sink
story (AR #2) — the RD-09 footer band that will host it visually is out of scope. The Should-Haves
(global quick-search, top-N / relative-date filters) stay deferred to Phase B per the RD.

## Document Index

| #   | Document                                       | Description                                             |
| --- | ---------------------------------------------- | ------------------------------------------------------ |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail)            |
| 00  | [Index](00-index.md)                           | This document — overview and navigation                |
| 01  | [Requirements](01-requirements.md)             | Scope delta over RD-06                                  |
| 02  | [Current State](02-current-state.md)           | The datagrid filter seams + what RD-05 left in place    |
| 03-01 | [Filter Model](03-01-filter-model.md)        | `filter.ts` — `ColumnFilter`, `FilterModel`, predicate derivation, `filterRows`, column `filterType?` |
| 03-02 | [Quick-Filter Row & Funnel Header](03-02-quick-filter-and-header.md) | `quick-filter-row.ts` band + the `SortHeader` funnel indicator & funnel-click routing |
| 03-03 | [Filter Popups & Distinct](03-03-filter-popups.md) | `filter-popup.ts` (condition), `value-list-popup.ts` (distinct picker), the widened `distinct` seam |
| 03-04 | [Container Wiring](03-04-container-wiring.md) | `grid.ts` — the filter API, `display` composition, push-down, count, distinct delegation, popup opening |
| 07  | [Testing Strategy](07-testing-strategy.md)     | Specification test cases (ST-*) and verification        |
| 99  | [Execution Plan](99-execution-plan.md)         | Phases, sessions, and task checklist                    |

## Quick Reference

### Usage Examples

```ts
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Sale { region: string; qty: number; closed: Date | null; }
const columns = [
  column({ id: 'region', title: 'Region', value: (r: Sale) => r.region }),
  column({ id: 'qty', title: 'Qty', align: 'right', value: (r: Sale) => r.qty }), // filterType inferred: number
  column({ id: 'closed', title: 'Closed', value: (r: Sale) => r.closed, filterType: 'date' }),
];

const grid = new EditableDataGrid<Sale>({
  columns,
  source: fromRows(rows, { rowKey: (r) => r.region }),
  quickFilter: true, // opt in to the always-visible quick-filter row (default off)
});

// Imperative filter API (the quick-filter row + popups drive the same container signal):
grid.setFilter('region', { kind: 'text', op: 'contains', value: 'ali' }); // matches formatted display
grid.setFilter('qty', { kind: 'number', op: 'between', a: 100, b: 500 });  // matches the numeric value
grid.filterModel();    // ReadonlyMap { 'region' => …, 'qty' => … }
grid.filteredCount();  // rows passing all active filters (reactive)
grid.totalCount();     // pre-filter row count (reactive) — render "N of M" from the pair
grid.clearFilter('qty');
grid.clearFilter();    // clear all filters
```

### Key Decisions

| Decision                                           | Outcome                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Plan scope (AR #1)                                 | All RD-06 Must-Haves, one plan, phased data-plane-first                  |
| "N of M" home (AR #2)                              | Reactive API + kitchen-sink story echo; no footer band (RD-09 owns it)  |
| Quick-filter row default (AR #3)                   | Opt-in via `quickFilter` (default off)                                  |
| Text-filter match target (AR #4)                   | Formatted display; number/date/set evaluate the typed value            |
| Distinct truncation (AR #5)                        | Widen `distinct` → `Promise<{ values, truncated? }>`                     |
| Model placement (AR #6)                            | New `filter.ts`; `FilterModel` moves there (same barrel export)        |
| Composition (AR #7)                                | `display` = filter → then sort; push-down fires both `setFilter`+`setSort` |
| Client distinct (AR #9)                            | Grid computes `format∘value` distinct; delegates to `source.distinct` when present |
| Funnel surface (AR #11)                            | Extend `SortHeader` (funnel glyph + `onFunnelClick`); title click still sorts |
| Column filter type (AR #14)                        | Runtime inference + optional `filterType?` override                    |

## Related Files

- **New:** `packages/datagrid/src/filter.ts` (`ColumnFilter`, `FilterModel`, predicate derivation,
  `filterRows`), `packages/datagrid/src/quick-filter-row.ts` (the opt-in band),
  `packages/datagrid/src/filter-popup.ts` (condition filter popup),
  `packages/datagrid/src/value-list-popup.ts` (distinct value-list popup).
- **Modified:** `packages/datagrid/src/column.ts` (add optional `filterType?` to `GridColumn`),
  `packages/datagrid/src/data-source.ts` (import `FilterModel` from `filter.ts`; widen `distinct` to
  `Promise<DistinctResult>`), `packages/datagrid/src/sort-header.ts` (funnel glyph + funnel-click
  routing), `packages/datagrid/src/grid.ts` (container `Signal<FilterModel<T>>`, `display`
  composition, push-down effect, the `setFilter`/`clearFilter`/`filterModel`/`filteredCount`/
  `totalCount` API, distinct delegation, opening the popups, the opt-in quick-filter band),
  `packages/datagrid/src/index.ts` (barrel exports).
- **New tests:** `filter.spec.test.ts` / `filter.impl.test.ts`, `quick-filter-row.spec.test.ts`,
  `filter-popup.spec.test.ts`, `value-list-popup.spec.test.ts`, additions to `security.spec.test.ts`,
  a `filtering` kitchen-sink story + smoke coverage.
