# Editing Engine & Commit Model — Implementation Plan

> **Feature**: `@jsvision/datagrid` editing engine — the interactive heart of the grid: the two-axis cell cursor, the in-cell editor-overlay lifecycle, per-cell immediate write-through commit (with revert-on-veto), dirty tracking, and the keyboard flow (begin-edit / commit / cancel / auto-advance) — layered additively on the read-only `EditableDataGrid` foundation.
> **Status**: Planning Complete
> **Created**: 2026-07-13
> **Implements**: datagrid/RD-02
> **CodeOps Skills Version**: 3.4.1

## Overview

RD-01 shipped a read-only `EditableDataGrid<T>` over the promoted `@jsvision/ui` grid engine. RD-02 makes it
**editable**. The engine subclass `EditableGridRows<T>` adds a column cursor beside the engine's inherited row
focus, overpaints the focused **cell** (not just the row), and drives a small editor-overlay lifecycle
(`idle → editing → committing → idle`). Editing writes the parsed value straight into the in-memory record and
runs the RD-01 `onCommit` veto sink; a rejected commit reverts to the previous value and keeps the editor open.

The plan is **additive** over RD-01 — it consumes the RD-01 contracts (`GridColumn`, `GridDataSource`/`rowKey`,
`OnCommit`/`commitCell`, `mountCellOverlay`) and the already-public `@jsvision/ui` engine (`GridRows`,
`alignCell`, the inherited `geometry()`), so **no new ui promotion is required**. It adds exactly one small
public API to the column model (`column.set`), one editor seam (`createCellEditor` + a default text `Input`),
two byte-frozen **core** theme roles (`gridCursor`, `gridDirty`), and grows the `EditableDataGrid` container to
own the shared cursor/selection/scroll signals so RD-07's frozen-panel split composes later with no retrofit.

Typed editor widgets are **RD-03**; the validation/BeforeSave gate is **RD-12** (RD-02 only exposes the
`onCommit` seam it plugs into); row-selection gestures are **RD-08**; mouse/double-click begin-edit routing **and
`Tab`/`Shift-Tab` cell traversal** are **RD-10** (an unbound `Tab` is swallowed by the dispatch router for focus
traversal before any `onEvent`, so grid-action Tab needs RD-10's keymap→command layer — PF-001). RD-02 keeps to
the keyboard-driven, single-panel, text-editor slice (Enter commit + row-advance) — but with every seam the later
RDs need already in place.

## Document Index

| #   | Document                                                     | Description                                                       |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Plan-level Zero-Ambiguity Gate decisions (15 items)              |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation                          |
| 01  | [Requirements](01-requirements.md)                           | Scope delta over RD-02 + plan-local decisions                    |
| 02  | [Current State](02-current-state.md)                         | Grounded analysis of the code RD-02 subclasses / edits           |
| 03-01 | [Additive Surface](03-01-additive-surface.md)             | `column.set` + editability · `createCellEditor` + default `Input` · core `gridCursor`/`gridDirty` roles |
| 03-02 | [Editing Engine](03-02-editing-engine.md)                 | `EditableGridRows<T>` — cursor, keymap, cell overpaint, the edit-lifecycle state machine + commit flow |
| 03-03 | [Dirty, Container & Story](03-03-dirty-container-story.md) | Dirty registry + `isDirty` · `EditableDataGrid` integration · editable kitchen-sink story + smoke |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | ST-1…ST-17 spec cases → AC-1…AC-10                               |
| 99  | [Execution Plan](99-execution-plan.md)                       | 6 phases, spec-first ordering, task checklist                    |

## Quick Reference

### Usage Example (the RD-02 delta)

```ts
import { signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Person { id: number; name: string; balance: number; }

// A column is EDITABLE when it has both `parse` (text -> V) and `set` (V -> record).
const columns = [
  column({
    id: 'name',
    title: 'Name',
    value: (r: Person) => r.name,
    parse: (t) => t,                       // text -> value
    set: (r, v) => { r.name = v; },        // NEW in RD-02: value -> record
  }),
  column({ id: 'id', title: 'ID', value: (r: Person) => r.id }), // read-only (no parse/set)
];

const rows = signal<Person[]>([{ id: 1, name: 'Ada', balance: 1000 }]);
const source = fromRows(rows, { rowKey: (r) => r.id });

const grid = new EditableDataGrid<Person>({
  columns,
  source,
  onCommit: (c) => c.value !== '',         // veto empty names; return false/reject to revert
});
// F2 / Enter / typing on the Name cell opens a text editor; Enter commits + advances to the next row.
// The ID column is read-only: the cursor lands on it, but F2/Enter are no-ops.
grid.isDirty(1, 'name'); // false once a commit resolves and the source reflects the value
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Column write seam | Add `column.set`; editable ⇔ `parse` && `set`; optimistic write via `commitCell` + revert | AR #1 (plan) |
| RD-02 editor | Built-in text `Input` + `createCellEditor` factory seam (RD-03 extends) | AR #2 (plan) |
| Theme roles | Add core `gridCursor` (filled-reverse cell) + `gridDirty` (`•`), byte-frozen | AR #3 (plan) |
| Panel model | Single `EditableGridRows`; **container** owns `focusedCol`/`focused`/`selected`/`indent` | AR #4 (plan) |
| Repaint after commit | Container `version` signal folded into `display` (the `Surface.version` pattern) | AR #5 (plan) |
| Dirty semantics | Pending-commit flag in a reactive `Set`; clears when the source reflects the value | AR #6 (plan) |
| Commit-key capture | Editor-host `Group` catches Enter/Esc via the focus-chain bubble (Tab → RD-10, PF-001) | AR #7 (plan) |
| Commit granularity | Per-cell immediate write-through | req AR-02 / AR-16 |
| Enter precedence | Context-sensitive (begin-edit when idle; commit + next-row when editing) | req AR-18 |
| Begin-edit triggers | F2 + Enter + printable-replaces | req AR-19 |

## Related Files

**Created** (`packages/datagrid/src/`): `editable-grid-rows.ts`, `cell-editor.ts`, `editing.ts`.
**Created** (`packages/datagrid/test/`): `editable-grid-rows.spec/impl`, `cell-editor.spec/impl`,
`editing.spec/impl`, `dirty.spec/impl`, plus the editable story + extended smoke coverage.

**Modified** (`packages/datagrid/src/`): `column.ts` (+`set`, `isEditable`), `grid.ts` (container owns the
shared signals + `EditableGridRows` + `onCommit`/`isDirty` + `version`), `index.ts` (re-exports).

**Modified** (`packages/core/src/engine/color/`): `theme.ts` (add `gridCursor` + `gridDirty` roles + JSDoc).
**Modified** (`packages/core/test/`): the theme byte-freeze spec covers the two new roles.

## Reuse (no new promotion)

RD-02 reuses these **already-public** `@jsvision/ui` symbols by name — confirmed on the barrel in RD-01:
`GridRows` (subclassed; its `display`/`columns`/`autoWidths`/`indent`/`focused`/`selected`/`geometry()`/
`topItem` are `protected`, so a subclass reads them), `alignCell`, `apportionColumns`, `ColumnGeometry`,
`stringWidth`, `Input`, `Group`, `View`, `signal`/`createRoot`. See [02-current-state](02-current-state.md).
