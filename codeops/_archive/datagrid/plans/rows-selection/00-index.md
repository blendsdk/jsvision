# Rows, Records & Selection — Implementation Plan

> **Feature**: Record-level interaction for `@jsvision/datagrid` — row-oriented multi/single
> selection keyed by `rowKey`, a selection checkbox column + row-number gutter, row CRUD
> (insert/delete/duplicate) via a data-source mutation seam, and a per-column null policy.
> **Status**: Planning Complete
> **Created**: 2026-07-16
> **Implements**: datagrid/RD-08
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-08 adds the **record layer** on top of the cell-oriented grid shipped through RD-01…RD-07. Where
the grid so far has a *cell cursor* (a focused row × column) for editing and navigation, RD-08 adds
a *selection set* — whole records the user has marked — plus the machinery to create, delete, and
duplicate rows, and to represent an absent value (null) distinctly from an empty string.

Selection is **keyed by `rowKey`** (RD AR-15), so it is stable across sort, filter, and reorder for
free — a selected row stays selected wherever it moves. It **supersedes** the single-index `selected`
signal the container has carried since RD-01 (`grid.ts:233`) — which the base `GridRows` sets on every
plain click (`ui/…/grid-rows.ts:260`→`:330`) and which is a **required, base-owned** config field that
cannot be removed under zero-ui-change (AR-16). RD-08 keeps `selected` as the base's click sink, adds a
`selectedKeys` set beside it, and overrides `select()` so a plain click is cursor-only (AR-17). The
paint path already exists: the body's self-contained `draw()` override (`editable-grid-rows.ts:443`)
computes a per-row role under the precedence **cursor > dirty > selected > cellStyle > zebra > normal** —
RD-08 swaps the single-index selection test for a set-membership test at **both** paint sites (`draw()`
and `paintDirtyMarkers()`, AR-18) (**zero `@jsvision/ui` change**, AR-1).

The plan is phased **data-plane-first** (mirroring RD-05/06/07): the pure `selection.ts` model, then
the container state + gestures + paint, then the synthetic checkbox/gutter columns, then row CRUD,
then the null policy, then the story + showcase + security gate. Every phase follows spec-first
ordering.

## Document Index

| #   | Document                                          | Description                                        |
| --- | ------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)    | Zero-Ambiguity Gate decisions (audit trail)        |
| 00  | [Index](00-index.md)                              | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)                | Scope delta over RD-08 + acceptance criteria       |
| 02  | [Current State](02-current-state.md)              | The seams RD-08 plugs into (grounded)              |
| 03-01 | [Selection Model](03-01-selection-model.md)     | Pure `selection.ts` — the model twin               |
| 03-02 | [Container Selection](03-02-container-selection.md) | State, gestures, paint override, public API     |
| 03-03 | [Synthetic Columns](03-03-synthetic-columns.md) | Checkbox column + row-number gutter                |
| 03-04 | [Row CRUD](03-04-row-crud.md)                   | `RowMutations` seam + insert/delete/duplicate      |
| 03-05 | [Null Policy](03-05-null-policy.md)             | Per-column null vs empty                           |
| 07  | [Testing Strategy](07-testing-strategy.md)        | ST-cases (spec-first) + verification               |
| 99  | [Execution Plan](99-execution-plan.md)            | Phases, tasks, checklist                           |

## Quick Reference

### Usage Examples

```ts
import { signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Emp { id: number; name: string; dept: string | null; }
const rows = signal<Emp[]>([
  { id: 1, name: 'Ada', dept: 'R&D' },
  { id: 2, name: 'Bo', dept: null },
]);

const grid = new EditableDataGrid<Emp>({
  columns: [
    column({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 }),
    column({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 10,
             null: { nullable: true, display: '—' } }),
  ],
  source: fromRows(rows, { rowKey: (r) => r.id }),
  selectionMode: 'multi',      // default; 'single' replaces on each select
  checkboxColumn: true,        // opt-in leading [ ]/[x] column + tri-state header
  rowNumbers: true,            // opt-in 1-based display-number gutter
  assignKey: (clone) => ({ ...clone, id: Date.now() }), // caller mints the duplicate's key
});

// Reactive selection read + row CRUD
grid.selectedKeys();                 // ReadonlySet<Key>
grid.insertRow({ id: 3, name: 'Cy', dept: 'Ops' });
grid.duplicateRow(1);                // clones id:1 via assignKey
grid.deleteRows([2]);                // removes id:2 and clears it from the selection
```

### Key Decisions

| Decision                          | Outcome                                                              | AR   |
| --------------------------------- | ------------------------------------------------------------------- | ---- |
| Selection state                   | `selectedKeys: Signal<ReadonlySet<Key>>` + anchor **beside** the kept base `selected` sink; datagrid-local paint at both draw sites; **zero ui change** | AR-1/AR-16/AR-18 |
| Plain-click + `Space` semantics   | plain click cursor-only (`select()` override); `Space` toggles selection on read-only cells, begin-edit on editable cells | AR-17/AR-19 |
| Selection defaults                | gestures always live; `selectionMode` default `'multi'`; checkbox + gutter opt-in | AR-2 |
| Null policy                       | empty→null on a nullable column; non-nullable stores `''`           | AR-3 |
| Row CRUD + duplicate key          | `fromRows` built-in splice; caller-formed keys; `assignKey` hook (no hook ⇒ no-op + devWarn) | AR-4 |
| Checkbox / gutter geometry        | fixed-width synthetic prefix, left-pinned, not cursor-navigable      | AR-5 |
| Module layout                     | new `selection.ts` + `synthetic-columns.ts`; thin `grid.ts` wrappers | AR-6 |
| Select-all scope                  | current `display()` (filtered) rows                                 | AR-7 |
| Showcase                          | kitchen-sink story + showcase cluster (replaces RD-08 placeholder)  | AR-8 |

## Related Files

**New:** `packages/datagrid/src/selection.ts`, `packages/datagrid/src/synthetic-columns.ts`;
tests `selection.spec/impl.test.ts`, `grid-selection.spec.test.ts`, `synthetic-columns.spec.test.ts`,
`row-crud.spec.test.ts`, `null-policy.spec.test.ts`; kitchen-sink `rows-selection.story.ts`; a
datagrid-showcase `rows-selection/` cluster.

**Modified:** `grid.ts` (selection state beside the kept `selected` sink + CRUD + null wiring),
`editable-grid-rows.ts` (set-membership paint at both `draw()` + `paintDirtyMarkers()`, a cursor-only
`select()` override, read-only-cell `Space`-toggle + `Ctrl`/`Shift` gestures), `grid-panels.ts`
(synthetic prefix segment), `data-source.ts` (`RowMutations` + `fromRows` mutation), `column.ts` (flat
`nullable?`/`nullDisplay?` fields + accessor null render), `editing.ts` (empty→null commit lowering),
`index.ts` (barrel), and the datagrid-showcase `placeholders.ts` + smoke oracle.
