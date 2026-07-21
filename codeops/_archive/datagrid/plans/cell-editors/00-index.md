# Cell Editors & Value Help — Implementation Plan

> **Feature**: `@jsvision/datagrid` cell editors — the concrete typed editors a cell mounts (`text`, `integer`, `decimal`, `boolean`, `date`, `enum`, `lookup`, `readonly`, `custom`), the typed string-field bridges that bind each `@jsvision/ui` widget to the RD-02 edit field, and F4 value-help (lookup dropdowns) — layered **additively** on the RD-02 `createCellEditor` seam with no reshape of the editing lifecycle.
> **Status**: Planning Complete
> **Created**: 2026-07-13
> **Implements**: datagrid/RD-03
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-02 shipped the editing lifecycle behind one editor seam — `createCellEditor(column, field, host)` — which
today always returns a text `Input` for an editable column and `null` for a read-only one. RD-03 grows **that
same seam** into the typed editor set: a column declares `editor?: CellEditorSpec | ((row: T) => CellEditorSpec)`,
`resolveSpec(column, row)` turns it into a concrete spec, and `createCellEditor` switches on `spec.kind` to mount
the right widget — a filtered `Input` (`text`/`integer`/`decimal`), a `CheckGroup` (`boolean`), a `DatePicker`
(`date`), a select-only `ComboBox` (`enum`, `lookup`), the caller's own `View` (`custom`), or `null`
(`readonly`). Each typed widget binds to the single `Signal<string>` edit field through an `untrack`-guarded
**bridge** so RD-02's `parse` still sees the authoritative string on commit.

The plan is **additive** over RD-02 — it consumes RD-02's lifecycle (`beginEdit`, the editor-host Enter/Esc
capture, `commitCell` write-through, dirty tracking) and reuses **already-public** `@jsvision/ui` widgets
(`Input`, `CheckGroup`, `DatePicker`, `ComboBox`, the `filter` validator, core `toISO`/`parseISO`) — so **no ui
promotion is required**. It adds one column field (`editor`), grows `cell-editor.ts` with the spec types +
`resolveSpec` + the widget switch, adds one internal `editor-bridges.ts`, and teaches `EditableGridRows`/the
editing controller a single new gesture (**F4** = begin-edit + open the value-help dropdown).

The commit-time validation **gate** and error surfacing are **RD-12** (RD-03 wires only the live keystroke
`filter`); schema-derived editors (`resolveEditors`/PG introspection) live in the separate Data Studio app, never
this package; `datetime`/`json`/`array` rich editors are a later RD (not in the `CellEditorKind` union). RD-03
keeps to *which* editor a cell mounts and *how* it binds — RD-02 still owns *when*.

## Document Index

| #   | Document                                                     | Description                                                       |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Plan-level Zero-Ambiguity Gate decisions (13 items)              |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation                          |
| 01  | [Requirements](01-requirements.md)                           | Scope delta over RD-03 + plan-local decisions                    |
| 02  | [Current State](02-current-state.md)                         | Grounded analysis of the RD-02 seam RD-03 extends + the ui widgets |
| 03-01 | [Editor Spec & Factory](03-01-editor-spec-and-factory.md) | `CellEditorSpec`/`CellEditorKind` · `column.editor` · `resolveSpec` · the `createCellEditor` widget switch + keystroke filters |
| 03-02 | [Typed Bridges](03-02-typed-bridges.md)                   | `boolBridge`/`dateBridge`/`enumBridge`/`lookupBridge` — the `untrack`-guarded string-field ⟷ typed-control adapters |
| 03-03 | [Lookup, F4 & Showcase](03-03-lookup-f4-and-showcase.md)  | Async lookup provider · F4 begin-edit-and-open (forwarded `Alt+Down`) · kitchen-sink stories + security ST |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | ST-1…ST-11 spec cases → AC-1…AC-9                                |
| 99  | [Execution Plan](99-execution-plan.md)                       | 6 phases, spec-first ordering, task checklist                    |

## Quick Reference

### Usage Example (the RD-03 delta)

```ts
import { signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Order { id: number; active: boolean; due: string; status: string; customerId: string; }

const columns = [
  // A typed editor is chosen by `editor`; the column still needs parse/set to be editable.
  column({
    id: 'active', title: 'Active', value: (r: Order) => r.active,
    format: (v) => (v ? 'true' : 'false'),
    parse: (t) => t === 'true', set: (r, v) => { r.active = v; },
    editor: { kind: 'boolean' },                       // → CheckGroup
  }),
  column({
    id: 'due', title: 'Due', value: (r: Order) => r.due,
    parse: (t) => t, set: (r, v) => { r.due = v; },
    editor: { kind: 'date' },                          // → DatePicker (commits ISO YYYY-MM-DD)
  }),
  column({
    id: 'status', title: 'Status', value: (r: Order) => r.status,
    parse: (t) => t, set: (r, v) => { r.status = v; },
    editor: { kind: 'enum', values: ['open', 'paid', 'shipped'] }, // → select-only ComboBox
  }),
  column({
    id: 'customerId', title: 'Customer', value: (r: Order) => r.customerId,
    parse: (t) => t, set: (r, v) => { r.customerId = v; },
    editor: { kind: 'lookup', items: async () => [{ key: '7', label: 'Ada Lovelace' }] }, // → F4 value help
  }),
  // No `editor` on an editable column → today's text Input (backward-compatible with RD-02).
  column({ id: 'id', title: 'ID', value: (r: Order) => r.id }), // read-only (no parse/set)
];

const grid = new EditableDataGrid<Order>({ columns, source: fromRows(signal<Order[]>([]), { rowKey: (r) => r.id }) });
// F2/Enter open the type-appropriate editor; on the Customer cell, F4 opens the lookup dropdown and
// selecting "Ada Lovelace" commits the KEY "7" (not the label).
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Editor descriptor reconciliation | `editor?` is an additive **widget override**; `isEditable` (parse+set) still gates editability; no `editor` → text `Input` (ST-15 stays green) | AR #1 (plan) |
| `createCellEditor` signature | Keep column-based `createCellEditor(column, field, host, row?)`; internal `resolveSpec(column,row) → switch(kind)` | AR #1 (plan) |
| F4 value help | F4 = begin-edit **+** open the dropdown; forward a synthetic `Alt+Down` (public trigger; `open()` untouched) | AR #2 (plan) |
| Validator scope | Live keystroke `filter` only; commit-time `valid()` gate → RD-12 | AR #3 (plan) |
| Editor kinds | `text`/`integer`/`decimal`/`boolean`/`date`/`enum`/`lookup`/`readonly`/`custom`; `datetime`/`json`/`array` out; per-row function form resolved now | AR #4 (plan) |
| File structure | `cell-editor.ts` (public: types + `resolveSpec` + switch) + internal `editor-bridges.ts` (4 bridges) | AR #5 (plan) |
| Lookup commit value | Field holds the **key**; ComboBox shows the **label** via `getText`; `lookupBridge` maps key ⟷ item | req AR-32 / AR #9 (plan) |
| Headless popup test | Wire `loop.popupHost` over a full-viewport overlay (the ui `combobox.spec` pattern) → assert `popupOpen` | AR #7 (plan) |

## Related Files

**Created** (`packages/datagrid/src/`): `editor-bridges.ts` (internal typed adapters).
**Created** (`packages/datagrid/test/`): `editor-bridges.impl.test.ts`, and new/extended spec+impl for
`cell-editor` (the RD-03 kinds), plus editor kitchen-sink stories + extended smoke coverage.

**Modified** (`packages/datagrid/src/`): `cell-editor.ts` (the `CellEditorSpec`/`CellEditorKind` types +
`resolveSpec` + the `createCellEditor` widget switch + keystroke filters), `column.ts` (+`editor` field),
`editing.ts` (pass `cell.row` to `createCellEditor`; the F4 auto-open flag), `editable-grid-rows.ts` (F4
begin-edit trigger), `index.ts` (re-export the new public types).

## Reuse (no new promotion)

RD-03 reuses these **already-public** `@jsvision/ui` symbols by name — confirmed on the barrel (`src/index.ts`):
`Input` (with `validator`), `CheckGroup` (`{ labels, value: Signal<boolean[]> }`), `DatePicker`
(`{ value: Signal<CalendarDate|null> }`), `ComboBox<T>` (`{ items, getText, value: Signal<T|null>, editable }`
— opens on `Alt+Down`/`Down`, its `.input`/`.text()`/`.value()`/`.filtered()` are public), the `filter`
validator factory, the `Validator` type, and core `toISO`/`parseISO` + the `CalendarDate` type. The spike
`packages/spike-data-studio/src/editor-spec.ts` is the **reference decode** (bridges + switch), not shipped
code. See [02-current-state](02-current-state.md).
