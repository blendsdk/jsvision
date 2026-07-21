# Filter Entry Point Implementation Plan

> **Feature**: Make the `@jsvision/datagrid` condition-filter popup + value-list reachable on an unfiltered column — an always-visible header funnel plus an `Alt+Down` keyboard opener, scoped to filterable columns
> **Status**: Planning Complete
> **Created**: 2026-07-16
> **Implements**: datagrid/RD-06
> **Tracks**: GitHub issue #92 (area: datagrid)
> **CodeOps Skills Version**: 3.8.0

## Overview

Today the condition-filter popup and its embedded value-list — the operator filters (text
`startsWith`/`equals`, number `between`, date `before`/…) and the Excel value-list — can only be
opened by clicking a column's funnel `▽`, and the funnel is drawn (and hit-tested) **only on a column
that already has an active filter** (`sort-header.ts:265,272,460`). The single caller of
`openFilterPopup` is `onFunnelClick` (`grid.ts:380`); there is no keyboard or menu path. So on a plain
`EditableDataGrid` with no quick-filter row, the popup is **unreachable by mouse or keyboard** — the
grid's headline "Excel-class filtering" is hidden.

This is not merely an implementation gap: RD-06 **requires** the funnel-only-when-filtered behavior
(§Funnel indicator + acceptance #4), and `ST-19` faithfully encodes it. So the fix revises RD-06
itself — folded into this plan (AR-2) — and re-specs `ST-19`.

The change has three moving parts:

1. **Always-visible funnel (`SortHeader`).** Every *filterable* column reserves and paints a `▽` at
   all times — the muted `listDivider` tone when the column is unfiltered, the normal `tableHeader`
   tone when a filter is active (AR-6). The funnel-cell hit-test (`funnelColumnAt`) routes a click to
   the popup regardless of filter state. Narrow columns drop the funnel before the sort arrow (AR-7).

2. **Keyboard opener (`Alt+Down`).** From the *non-editing* grid body, `Alt+Down` opens the focused
   column's popup via a new `onOpenFilter` callback into `grid.ts`, forwarding the live dispatch
   envelope so the popup inherits the focus/popup seam (AR-9). `Alt+Down` is Excel's open-filter key;
   on the body today it falls through to the base and moves the row cursor down, so the new handler
   *repurposes* it before `super.onEvent` (PF-001) — `F4` value-help and the in-editor `Alt+Down` are untouched.

3. **Filterability + demos.** A new `filterable?: boolean` on `GridColumn` (default `true`, AR-8)
   gives "only filterable columns" real meaning; a column can opt out of all filtering. The three
   currently-broken showcase stories (Text conditions, Number & date conditions, Value list) keep
   their quick-filter row and gain the new entry point, with hints reworded to match (AR-4).

Scope is deliberately narrow — the popup, the value-list, the filter model, and push-down are
untouched; this plan only adds *ways to open* the existing popup and the column flag that gates them.
The related quick-filter width bug (#93) is fixed separately and is out of scope.

## Document Index

| #   | Document | Description |
| --- | -------- | ----------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions + the RD-06 revision (audit trail) |
| 00  | [Index](00-index.md) | This document — overview and navigation |
| 01  | [Requirements](01-requirements.md) | Scope delta over RD-06 + the folded RD-06 revision |
| 02  | [Current State](02-current-state.md) | The funnel/popup/keyboard seams this builds on + the hazards |
| 03-01 | [Always-Visible Funnel](03-01-funnel.md) | `SortHeader` draw states, reserve, and `funnelColumnAt` hit-test |
| 03-02 | [Keyboard Opener](03-02-keyboard-opener.md) | `Alt+Down` on the body → `onOpenFilter` → `grid.openFilterPopup` |
| 03-03 | [Filterable Flag, Demos & RD-06](03-03-filterable-demos-rd.md) | `GridColumn.filterable`, the three stories, and the RD-06 edit |
| 07  | [Testing Strategy](07-testing-strategy.md) | Specification test cases (ST-*) and verification |
| 99  | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Usage Examples

```ts
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Row { id: number; product: string; qty: number; }
const columns = [
  column({ id: 'product', title: 'Product', value: (r: Row) => r.product }),
  column({ id: 'qty', title: 'Qty', value: (r: Row) => r.qty, align: 'right' }),
  column({ id: 'actions', title: '', value: () => '', filterable: false }), // opt out — no funnel
];

const grid = new EditableDataGrid<Row>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
// Every filterable column now shows a muted ▽; click it (or focus a cell and press Alt+Down)
// to open the condition popup — no quick-filter row required.
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Entry point (AR-1) | **Both** — always-visible funnel **and** `Alt+Down` opener |
| RD-06 revision (AR-2) | **Folded into this plan** (§Funnel + AC#4 revised; ST-19 re-spec'd) |
| Funnel scope (AR-3, AR-8) | **Only filterable columns**, via new `GridColumn.filterable` (default true) |
| Demos (AR-4) | Keep quick-filter row **+** new entry point; hints reworded |
| Keyboard key (AR-5, AR-9) | **`Alt+Down`** from the non-editing body → focused column's popup |
| Funnel states (AR-6) | Same `▽`; `listDivider` (muted) unfiltered, `tableHeader` (normal) filtered |
| Layout cost (AR-7) | Always reserve the funnel cell; drop-first when too narrow |

## Related Files

- **Modified:** `packages/datagrid/src/sort-header.ts` (always-visible funnel draw states + reserve +
  `funnelColumnAt` hit-test; filterability gate; `funnelAnchor` helper), `packages/datagrid/src/column.ts`
  (add `filterable?: boolean` to `GridColumn`), `packages/datagrid/src/editable-grid-rows.ts` (`Alt+Down`
  handling before `super.onEvent` + `onOpenFilter` callback), `packages/datagrid/src/quick-filter-row.ts`
  (skip the `Input` for a non-filterable column, nullable slot to stay index-parallel — preflight PF-005),
  `packages/datagrid/src/grid.ts` (wire `onOpenFilter` → `openFilterPopup`; **retain `parts.headers` +
  refresh in `rebuildBody`** to reach the owning header — preflight PF-002; compute the header funnel
  anchor), `packages/datagrid/src/grid-panels.ts` (thread `onOpenFilter` + filterability to
  headers/panels).
- **Modified (demos):** `packages/examples/datagrid-showcase/stories/filtering/{condition-text,
  condition-num-date,value-list}.story.ts` + `filter-demo.ts` (hints); the `filtering` kitchen-sink
  story hint.
- **Modified (spec):** `packages/datagrid/test/sort-header.spec.test.ts` (ST-19 re-spec),
  `codeops/features/datagrid/requirements/RD-06-filtering.md` (§Funnel, §Condition, AC#4 + new AC).
- **New/updated tests:** funnel-state + hit-test spec/impl cases; `Alt+Down` opener spec/impl cases;
  a `filterable`-flag case; `security.spec.test.ts` unaffected; showcase smoke.
