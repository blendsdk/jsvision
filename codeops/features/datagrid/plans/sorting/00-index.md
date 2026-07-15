# Sorting Implementation Plan

> **Feature**: Single + multi-column, value-aware, push-down-capable column sorting for `@jsvision/datagrid`
> **Status**: Planning Complete
> **Created**: 2026-07-15
> **Implements**: datagrid/RD-05
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-05 adds column sorting to the editable data grid: click a header to sort by that column's **typed
value** (never its formatted display string), `Ctrl`+click to build a multi-column priority sort, and —
when the data source supports it — push the ordering down to the source instead of sorting in memory.

The load-bearing architecture decision (AR #1): **the datagrid owns its sort model end-to-end.** A
container-owned `Signal<SortKey[]>` is the single source of truth; a **from-scratch** `SortHeader` View
renders arrows + priority digits from it; and **all** sorting — a single-column sort being a one-element
key list — routes through the datagrid's own `sortRowsMulti`. This is forced by the codebase: the
exposed `@jsvision/ui` `GridHeader` is single-column and column-*index* keyed with a monolithic
`draw()`/`onEvent()` and no `super` seam, and `EditableDataGrid` already deliberately **suppresses** the
engine sort path (`ReadonlyGridHeader` + a hard-wired `signal<SortState>(null)`), so that path is dead
code for the datagrid today. Owning the model reuses the shared geometry helpers
(`apportionColumns`/`alignCell`/`stringWidth`), inherits no dead state, renders the multi-key indicator
natively, and lets a later frozen-panel split (RD-07) bind several headers to the one signal — while the
ui engine's `SortState`/`sortRows` stay untouched (the read-only `DataGrid` still uses them).

This plan ships **all of RD-05** (AR #4): the Must-Haves (single, multi, value-aware, push-down, the
sort API) **and** the three Should-Haves (custom `compare`, `nulls` ordering, the tri-state header
cycle), since RD-05's acceptance criteria (AC-5/6/7) require them.

**Foundation prerequisite (AR #16 — Phase 1):** `Ctrl`+click multi-sort is impossible today because the
core `MouseEvent` (`events.ts:25`) carries no `ctrl`/`shift`/`alt` — the decoder parses the button-byte
modifier bit but `buildEvent` (`mouse.ts:111`) drops it for clicks (ui's editor documents the same gap,
`editor-mouse.ts:9`). So this plan's Phase 1 makes a small, **additive** change to `@jsvision/core`:
optional `ctrl?`/`alt?`/`shift?` fields on `MouseEvent`, populated by the decoder. The fields are
**optional** to stay backward-compatible with the ~109 existing `type: 'mouse'` construction sites (no
cross-package churn). This is the first datagrid-driven core change (user-authorised) and a general
input-layer capability, not sort-specific.

## Document Index

| #   | Document                                       | Description                                             |
| --- | ---------------------------------------------- | ------------------------------------------------------ |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail)            |
| 00  | [Index](00-index.md)                           | This document — overview and navigation                |
| 01  | [Requirements](01-requirements.md)             | Scope delta over RD-05                                  |
| 02  | [Current State](02-current-state.md)           | The datagrid sort seams + why the engine path is dead  |
| 03-01 | [Sort Model](03-01-sort-model.md)            | `sort.ts` — `sortRowsMulti`, the comparator, `SortKey`/`SortDir`, `GridColumn` additions |
| 03-02 | [Header & Container Wiring](03-02-header-and-wiring.md) | `SortHeader`, the container `Signal<SortKey[]>`, `applySort`, push-down, the sort API |
| 07  | [Testing Strategy](07-testing-strategy.md)     | Specification test cases (ST-*) and verification        |
| 99  | [Execution Plan](99-execution-plan.md)         | Phases, sessions, and task checklist                    |

## Quick Reference

### Usage Examples

```ts
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Sale { region: string; qty: number; closed: Date | null; }
const columns = [
  column({ id: 'region', title: 'Region', value: (r: Sale) => r.region }),
  column({ id: 'qty', title: 'Qty', align: 'right', value: (r: Sale) => r.qty }),   // sorts 9 above 1000
  column({ id: 'closed', title: 'Closed', value: (r: Sale) => r.closed, nulls: 'first' }),
];

const grid = new EditableDataGrid<Sale>({ columns, source: fromRows(rows, { rowKey: (r) => r.region }) });

// Imperative sort API (the header drives the same container signal):
grid.sortBy('qty');              // single key, ascending
grid.addSort('region', 'desc');  // secondary key → priority 2
grid.sort();                     // [{ columnId: 'qty', dir: 'asc' }, { columnId: 'region', dir: 'desc' }]
grid.clearSort();                // restore source order
```

### Key Decisions

| Decision                                       | Outcome                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| Header rendering surface (AR #1)               | Own it — from-scratch `SortHeader` + container `Signal<SortKey[]>`; ui engine sort path untouched/unused |
| String comparison (AR #2)                      | One comparator; strings via a memoized case-insensitive `Intl.Collator` (honours AC-5) |
| Cursor across a re-sort (AR #3)                | Re-anchor by `rowKey` — the record stays under the cursor           |
| Should-Have scope (AR #4)                      | All three (compare + nulls + tri-state) ship in this plan           |
| Push-down wiring (AR #6/#7)                    | `setSort(keys)` from a separate guarded effect; the pure `display` never calls it |
| Re-sort on edit (AR #8)                        | Pure-derived display re-sorts on data change (row may jump); snapshot ordering deferred |
| Sort-model placement (AR #11)                  | New `sort.ts` + `sort-header.ts`; `SortKey` moves there (same barrel export) |
| Mouse modifiers for `Ctrl`+click (AR #16)      | Additive **optional** `ctrl?`/`alt?`/`shift?` on core `MouseEvent` (Phase 1 prerequisite) |

## Related Files

- **Modified (core, Phase 1 prerequisite — AR #16):** `packages/core/src/engine/input/events.ts`
  (optional `ctrl?`/`alt?`/`shift?` on `MouseEvent`), `packages/core/src/engine/input/mouse.ts`
  (populate them in `buildEvent`), plus a core CHANGELOG line (minor additive API).
- **New:** `packages/datagrid/src/sort.ts` (`SortDir`, `SortKey`, `sortRowsMulti`, the value comparator),
  `packages/datagrid/src/sort-header.ts` (the from-scratch `SortHeader` View).
- **Modified:** `packages/datagrid/src/column.ts` (add `compare?`/`nulls?` to `GridColumn`),
  `packages/datagrid/src/data-source.ts` (import `SortKey` from `sort.ts` instead of declaring it),
  `packages/datagrid/src/grid.ts` (unwind `ReadonlyGridHeader`, add the container `Signal<SortKey[]>`,
  `applySort` seam + push-down effect, cursor re-anchor, the `sortBy`/`addSort`/`clearSort`/`sort` API,
  mount `SortHeader`), `packages/datagrid/src/index.ts` (barrel exports).
- **New tests:** `sort.spec.test.ts` / `sort.impl.test.ts`, `sort-header.spec.test.ts`, additions to
  `security.spec.test.ts`, a `sorting` kitchen-sink story + smoke coverage.
