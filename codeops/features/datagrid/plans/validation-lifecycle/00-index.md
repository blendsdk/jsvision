# Validation & Lifecycle Implementation Plan

> **Feature**: The commit-safety layer for `@jsvision/datagrid` — per-cell value validation, a per-row
> cross-field gate, the `beforeSave` veto, invalid-cell + message error surfacing, and the grid's
> loading / empty / error lifecycle states.
> **Status**: Planning Complete
> **Created**: 2026-07-17
> **Implements**: datagrid/RD-12
> **CodeOps Skills Version**: 3.8.0

## Overview

RD-12 makes "per-cell immediate write-through" **safe**. Today an edit parses and writes to the
record optimistically, and the only gate is the grid's `onCommit` veto and a `PARSE_FAILED` reject.
This plan adds the four composable commit gates the enterprise datasheet needs — a typed per-cell
`validate`, a per-row cross-field `validateRow` (run on row-leave), a per-cell `beforeSave` veto
layered above `onCommit`, and the error surfacing that makes a rejection legible (an invalid-cell
role marker + a message area) — plus the grid's `loading` / `ready` / `empty` / `error` lifecycle
states with a `retry()` affordance.

The pipeline stays true to the RD's timing model: a value that fails **pre-apply** validation
(`parse`/`validate`) never touches the record and keeps the editor open; a value that passes but is
vetoed **post-apply** (`beforeSave`/`onCommit`) is applied then reverted. Client validation is UX
only — the caller's `onCommit`/source remains the authoritative security boundary.

The work is phased **foundation-first**: the `gridInvalid` core role + the typed `validate` field +
the `beforeSave` commit primitive; then the per-cell pipeline + error surfacing; then the per-row
gate + row-leave trap; then the lifecycle states; then the public barrel, showcase, and security
oracle. `grid.ts` is at its `< 1300` line guard, so every non-trivial piece lands in a new module
(`validation.ts`, `error-registry.ts`, `grid-lifecycle.ts`) with `grid.ts` holding only thin option
wiring and delegators — the RD-08/09/10 pattern.

## Document Index

| #   | Document                                                        | Description                                            |
| --- | -------------------------------------------------------------- | ------------------------------------------------------ |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions (audit trail)            |
| 00  | [Index](00-index.md)                                           | This document — overview and navigation                |
| 01  | [Requirements](01-requirements.md)                             | Scope delta over RD-12                                 |
| 02  | [Current State](02-current-state.md)                           | Grounded analysis of the code RD-12 builds on          |
| 03-01 | [Column validation & commit pipeline](03-01-column-validation-and-commit-pipeline.md) | `validate` field · `beforeSave` primitive · `commitValue` ordering |
| 03-02 | [Error surfacing](03-02-error-surfacing.md)                 | `gridInvalid` core role · error registry · message band |
| 03-03 | [Per-row gate & row-leave trap](03-03-row-gate.md)          | `validateRow` · dirty-gated row-leave interception + refocus |
| 03-04 | [Lifecycle state](03-04-lifecycle-state.md)                 | `status` option · loading / empty / error views · `retry` |
| 03-05 | [Public API, showcase & security](03-05-public-api-showcase-security.md) | Barrel · kitchen-sink story · showcase cluster · security oracle |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | ST-cases + verification                                |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, steps, and the task checklist                  |

## Quick Reference

### Usage Examples

```ts
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { signal } from '@jsvision/ui';

interface Line { id: number; qty: number; start: Date; end: Date; }

const rows = signal<Line[]>([/* … */]);

const grid = new EditableDataGrid<Line>({
  columns: [
    column({
      id: 'qty', title: 'Qty', value: (r) => r.qty,
      parse: (t) => Number(t), set: (r, v) => { r.qty = v; },
      editor: { kind: 'integer' },            // live keystroke filter (unchanged)
      validate: (v) => (v > 0 ? null : 'Quantity must be positive'), // per-cell commit gate
    }),
    // …start / end columns…
  ],
  source: fromRows(rows, { rowKey: (r) => r.id }),

  // Per-row cross-field gate — runs on row-leave when the row was edited:
  validateRow: (r) =>
    r.end > r.start ? { ok: true } : { ok: false, message: 'End must be after start', field: 'end' },

  // BeforeSave veto (layers above onCommit; a veto reverts + surfaces the reason):
  beforeSave: async (c) => c.value !== undefined,
  onCommit: async (c) => persist(c),          // authoritative persistence

  // Lifecycle: caller drives loading/error; empty is auto-derived from the filtered count:
  status: () => loadState(),                   // 'loading' | 'ready' | { kind:'error', message, retry }
  emptyText: 'No lines yet',
});
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Per-cell validation | New typed `validate(value,row) => string \| null` | AR-1 |
| Lifecycle state source | Caller reactive `status` option; empty auto-derived | AR-2 |
| `beforeSave` shape | Per-cell `change`, above `onCommit` | AR-3 |
| Invalid-cell style | New `gridInvalid` core theme role | AR-4 |
| `validateRow` trigger | Row-leave, only when the row is dirty | AR-5 |
| Empty state | One `emptyText` + filter-aware built-in | AR-6 |
| Placement | New modules; `grid.ts` thin; guard re-based `< 1300` → `< 1350` | AR-7 |

## Related Files

**New (datagrid):** `src/validation.ts` · `src/error-registry.ts` · `src/grid-lifecycle.ts` · the
matching `test/*.spec.test.ts` / `*.impl.test.ts`.
**Modified (datagrid):** `src/column.ts` (validate field) · `src/commit.ts` (beforeSave) ·
`src/editing.ts` (pipeline + EditHost) · `src/editable-grid-rows.ts` (gridInvalid paint + row-leave
hooks) · `src/grid.ts` (options + delegators) · `src/grid-panels.ts` (message band + state swap) ·
`src/cell-draw.ts` (CellState.invalid) · `src/index.ts` (barrel).
**Modified (core):** `src/engine/color/theme.ts` · `roles.ts` · `presets.ts` + CHANGELOG.
**Modified (examples):** kitchen-sink story + `datagrid-showcase` cluster + placeholder oracles.
