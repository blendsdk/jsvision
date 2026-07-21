# Columns & Layout Implementation Plan

> **Feature**: Column & layout management for `@jsvision/datagrid` — interactive resize, within-panel reorder, show/hide, frozen (pinned) L/C/R columns, frozen rows, density mode, and the sticky header
> **Status**: Planning Complete
> **Created**: 2026-07-15
> **Implements**: datagrid/RD-07
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-07 makes a wide table usable on a large terminal: pin the identity columns, scroll the rest,
resize/reorder/hide columns live, and keep the header sticky. It builds directly on the promoted
`@jsvision/ui` column-geometry engine (RD-01) and the pointer-capture seam the framework already
uses for window-resize grips — so the gesture layer needs **no core/ui change**. The **one** small ui
touch is an additive *optional* divider-count param on `apportionColumns` for compact mode (AR-17,
decided at preflight PF-001); every existing caller is byte-identical when it is omitted.

The load-bearing architecture is the **pinned-panel model** (RD-07 AR#8): when freeze is
configured, the body splits into **left-pinned | center-scrolling | right-pinned** panels — three
`EditableGridRows` over the same source, sharing one row cursor, one vertical scroll position, one
`selected` state, and a single global column cursor; only the center panel binds the horizontal
`indent`. A `│` in the `frozen-divider` role marks each freeze boundary. When **no** column is
frozen (the common case) the grid keeps today's single-body path unchanged — zero regression risk
for RD-01…06 (AR-5).

Beneath the panels sits a pure, view-free **`column-model.ts`** — the reactive-ready state (column
order, per-column width overrides, hidden set, freeze partition) and its pure operations
(partition into L/C/R slices, within-panel reorder, min/max width clamp, visible-column
projection). It is the data-plane twin of `sort.ts`/`filter.ts` (AR-8), and the container owns it
through injected signals exactly as it owns `sortKeys`/`filters` (AR-13).

On top sit the gestures — column **resize** (drag a header divider grip; live; clamps to the
column's min/max) and **reorder** (drag a header; drop indicator; constrained to its panel,
RD-07 AR#22) — both driven through the existing `ev.setCapture`/`releaseCapture` seam that
`Desktop` uses for window resize (AR-12). Plus **auto-fit** (double-click a border / `autoFitColumn`),
**show/hide** (`setColumnVisible`), **frozen rows** (pin the first N data rows; AR-14), and a
**density/compact** mode (drop the divider; AR-15).

This plan ships the **complete RD-07** in one plan (AR-1) — the user pulled the RD's Phase B/C
extras (frozen rows, density) forward — phased data-plane-first so acceptance criteria land
incrementally. The cross-panel keyboard cursor is **linear left→center→right** (AR-2), a deliberate
override of the RD's literal boundary wording.

## Document Index

| #   | Document                                       | Description                                              |
| --- | ---------------------------------------------- | ------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail)             |
| 00  | [Index](00-index.md)                           | This document — overview and navigation                 |
| 01  | [Requirements](01-requirements.md)             | Scope delta over RD-07                                   |
| 02  | [Current State](02-current-state.md)           | The datagrid/ui seams RD-07 builds on + the hazards      |
| 03-01 | [Column Model](03-01-column-model.md)        | `column-model.ts` — order/width/visibility/freeze state + pure ops |
| 03-02 | [Frozen Panels & Sticky Header](03-02-frozen-panels.md) | The L/C/R panel split, shared cursor/scroll, per-panel headers, cross-panel navigation, over-pin guard |
| 03-03 | [Resize & Reorder Gestures](03-03-resize-reorder.md) | `SortHeader` divider-grip resize + header-drag reorder via the capture seam; auto-fit |
| 03-04 | [Container Wiring](03-04-container-wiring.md) | `grid.ts` — the column-layout API, panel assembly, options, overlay panel-awareness |
| 03-05 | [Frozen Rows & Density](03-05-frozen-rows-density.md) | Pinned data-row band + compact/dense mode |
| 07  | [Testing Strategy](07-testing-strategy.md)     | Specification test cases (ST-*) and verification        |
| 99  | [Execution Plan](99-execution-plan.md)         | Phases, sessions, and task checklist                    |

## Quick Reference

### Usage Examples

```ts
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Emp { id: number; name: string; dept: string; salary: number; }
const columns = [
  column({ id: 'id', title: 'ID', value: (r: Emp) => r.id, width: 6, minWidth: 4 }),
  column({ id: 'name', title: 'Name', value: (r: Emp) => r.name, minWidth: 8 }),
  column({ id: 'dept', title: 'Dept', value: (r: Emp) => r.dept }),
  column({ id: 'salary', title: 'Salary', value: (r: Emp) => r.salary, align: 'right' }),
];

const grid = new EditableDataGrid<Emp>({
  columns,
  source: fromRows(rows, { rowKey: (r) => r.id }),
  freeze: 2,            // pin the first two columns to a left panel (or freezeLeft: ['id','name'])
  freezeRows: 1,        // pin the first data row (frozen-rows band)
  density: 'compact',   // drop the inter-column divider for a denser view
});

// Reactive column-layout API (drives the same container signals the gestures do):
grid.columnOrder();                    // ['id','name','dept','salary'] (visible order)
grid.setColumnOrder(['id','name','salary','dept']);
grid.columnWidth('name');              // resolved width in cells
grid.setColumnWidth('name', 14);       // clamped to the column's minWidth/maxWidth
grid.setColumnVisible('dept', false);  // omit from layout; sortBy('dept') still works
grid.frozen();                         // { left: ['id','name'], right: [] }
grid.autoFitColumn('name');            // size to the widest visible cell (bounded by maxWidth ?? 60)
grid.autoFitAll();
```

### Key Decisions

| Decision                              | Outcome                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Plan scope (AR-1)                     | **Everything** — Must-Haves + auto-fit + frozen rows + density, one plan         |
| Cross-panel cursor (AR-2)             | **Linear** left→center→right; overrides the RD's literal boundary wording        |
| Showcase (AR-3)                       | Kitchen-sink story **+** datagrid-showcase RD-07 placeholder → live demos        |
| Width limits (AR-4)                   | Per-column `minWidth?`/`maxWidth?`; defaults min 3 / auto-fit max 60             |
| Panel model (AR-5)                    | 3 sliced `EditableGridRows`, **only when frozen**; no-freeze keeps single body   |
| Shared cursor/scroll (AR-6)           | One `focused`/`selected`/vertical position + one global `focusedCol` + per-panel range |
| Indent ownership (AR-7)               | Center panel binds scrollable `indent`; frozen panels pin 0                       |
| Module split (AR-8)                   | New pure `column-model.ts` (twin of `sort.ts`/`filter.ts`)                        |
| Gesture seam (AR-12)                  | `SortHeader` grips via existing `ev.setCapture`/`releaseCapture` — no core touch  |

## Related Files

- **New:** `packages/datagrid/src/column-model.ts` (order/width/visibility/freeze state + pure ops),
  `packages/datagrid/src/grid-panels.ts` (the L/C/R panel builder, if `grid.ts` would exceed cap).
- **Modified:** `packages/datagrid/src/column.ts` (add `minWidth?`/`maxWidth?` to `GridColumn`;
  thread through `toEngineColumn`), `packages/datagrid/src/sort-header.ts` (divider-grip resize +
  header-drag reorder hit-zones + gesture routing via the capture seam; density divider), 
  `packages/datagrid/src/editable-grid-rows.ts` (panel column-slice + range-limited cursor + shared
  vertical window + frozen-rows band + density divider), `packages/datagrid/src/grid.ts`
  (column-layout signals + API, panel assembly, freeze/freezeRows/density options, overlay
  panel-awareness), `packages/datagrid/src/index.ts` (barrel exports).
- **New tests:** `column-model.spec.test.ts` / `column-model.impl.test.ts`,
  `grid-layout.spec.test.ts`, `frozen-panels.spec.test.ts`, `resize-reorder.spec.test.ts`,
  additions to `security.spec.test.ts`, a `columns-layout` kitchen-sink story + smoke coverage,
  datagrid-showcase demo cluster + its smoke/walkthrough coverage.
