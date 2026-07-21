# Footer, Aggregation & Master-Detail — Implementation Plan

> **Feature**: A footer band for `@jsvision/datagrid` — an optional sticky bottom band hosting
> column-aligned reactive aggregates (sum/avg/min/max/count over the displayed set) and a row of
> free-form widget slots (totals text, command buttons, the N-of-M / selection-count read-outs) —
> plus editable master-detail: a reactive write-through data source, `focusedRow()`/`focusedKey()`
> readouts, and a `masterDetail` helper that links a child grid to the master's focused record.
> **Status**: Planning Complete
> **Created**: 2026-07-16
> **Implements**: datagrid/RD-09
> **CodeOps Skills Version**: 3.8.0

## Overview

RD-09 adds the **summary layer** and the **record-relationship layer** on top of the grid shipped
through RD-01…RD-08. The footer is a reserved bottom band — a peer of the header/scrollbar bands —
that hosts two things: a row of **column-aligned aggregate cells** (totals that recompute reactively
as rows are edited, inserted, deleted, sorted, or filtered) and a separate row of **free-form widget
slots** (`View`s the caller supplies — totals `Text`, command `Button`s, the reactive "N of M" count
and selection count). Aggregates fold over the **loaded/in-memory** set; when a source is windowed and
not fully loaded, a total is honestly **labelled** rather than passed off as a whole-dataset grand
total (RD AR #17).

Master-detail links a child `EditableDataGrid` to the master's **focused** record via reactivity —
nearly free given the reactive core, and the highest-value relationship pattern for a terminal
(inline tree-grids are out of scope, RD AR #5). The plan builds it **editable, not read-only**: a new
reactive **write-through** source (`fromReactiveRows`, the twin of `fromRows`) so cell edits *and*
insert/delete on the detail persist into the master's owned collection (AR-4).

The plan is phased **data-plane-first** (mirroring RD-05/06/07/08): the pure aggregate fold model, then
the reactive readouts + honesty seam, then the footer band + controller, then the widget slots, then
editable master-detail, then the story + showcase + security gate. Every phase follows spec-first
ordering. Because `grid.ts` sits at the hard `< 1200`-line guard, all new logic lands in **four new
modules** (`aggregate.ts`, `footer-band.ts`, `master-detail.ts`, and `grid-footer.ts` — home of the
**`FooterController`**, twin of `GridSelection`/`RowMutations`), keeping `grid.ts` to thin delegators;
Phase 2 first frees headroom by extracting `EditorOverlay`/`PopupCatcher` (→ `overlay.ts`) and `devWarn`
(→ `dev.ts`) (AR-10).

## Document Index

| #   | Document                                              | Description                                            |
| --- | ----------------------------------------------------- | ------------------------------------------------------ |
| AR  | [Ambiguity Register](00-ambiguity-register.md)        | Zero-Ambiguity Gate decisions (audit trail)            |
| 00  | [Index](00-index.md)                                  | This document — overview and navigation                |
| 01  | [Requirements](01-requirements.md)                    | Scope delta over RD-09 + plan-local acceptance         |
| 02  | [Current State](02-current-state.md)                  | The seams RD-09 plugs into (grounded, file:line)       |
| 03-01 | [Aggregate Model](03-01-aggregate-model.md)         | Pure `aggregate.ts` — descriptor, fold, edge semantics |
| 03-02 | [Footer Band](03-02-footer-band.md)                 | `FooterBand` view + band assembly + `FooterController` + honesty |
| 03-03 | [Widget Slots](03-03-widget-slots.md)               | The widget row — flow layout + `Button`→`ev.emit` dispatch |
| 03-04 | [Master-Detail](03-04-master-detail.md)             | `fromReactiveRows` + `focusedRow`/`focusedKey` + `masterDetail` |
| 07  | [Testing Strategy](07-testing-strategy.md)            | ST-cases (spec-first) + verification                   |
| 99  | [Execution Plan](99-execution-plan.md)                | Phases, tasks, checklist                                |

## Quick Reference

### Usage Examples

```ts
import { signal } from '@jsvision/ui';
import { column, fromRows, fromReactiveRows, EditableDataGrid, masterDetail } from '@jsvision/datagrid';

interface Order { id: number; customer: string; }
interface Line  { id: number; orderId: number; sku: string; qty: number; price: number; }

const orders = signal<Order[]>([ /* … */ ]);
const lines  = signal<Line[]>([ /* … */ ]);

// --- Master grid with a footer: aggregates + widget slots ---
const master = new EditableDataGrid<Order>({
  columns: [ /* … */ ],
  source: fromRows(orders, { rowKey: (o) => o.id }),
  footer: {
    sticky: true,
    aggregates: {
      // column-aligned totals; recompute reactively over the displayed rows
      total: { fn: 'sum', format: (v) => `$${v.toFixed(2)}`, label: 'Σ' },
      id:    { fn: 'count', label: 'rows:' },
    },
    widgets: [ /* Text totals, Button({ command: 'export' }), the N-of-M read-out … */ ],
  },
});

master.displayedRows();   // readonly Order[] — the filtered+sorted loaded set
master.focusedRow();      // Order | undefined — the master's focused record (reactive)
master.focusedKey();      // Key | undefined

// --- Editable detail linked to the master's focused order ---
const { detail, dispose } = masterDetail(master, (focused) =>
  new EditableDataGrid<Line>({
    columns: [ /* … */ ],
    // reactive write-through: cell edits AND insert/delete persist into `lines`
    source: fromReactiveRows(
      () => lines().filter((l) => l.orderId === focused()?.id),
      {
        rowKey: (l) => l.id,
        insert: (row, at) => { const n = lines().slice(); n.splice(at ?? n.length, 0, row); lines.set(n); },
        remove: (keys) => { const drop = new Set(keys); lines.set(lines().filter((l) => !drop.has(l.id))); },
      },
    ),
  }),
);
// `dispose()` tears down the detail's reactive scope; also disposed with the master.
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| v1 scope | Full RD-09 Must-Have, phased data-plane-first; RD Should-Haves stay Phase B | AR-1 |
| Aggregate honesty | optional `source.complete?()` predicate; "(loaded)" qualifier when `false`; test-double proves it | AR-2 |
| Widget dispatch | footer flow-row of caller `View[]`; `Button({command})`→`ev.emit` via the loop registry | AR-3 |
| Master-detail | **editable** reactive write-through `fromReactiveRows` + `focusedRow`/`focusedKey` + `masterDetail` | AR-4 |
| Aggregate descriptor | `{ fn, format?: (v)=>string, label?: string }` (static prefix) | AR-5 |
| Fold edge semantics | skip non-finite; `avg` over numeric contributors; empty `sum`/`count`→0, `avg`/`min`/`max`→blank | AR-6 |
| Footer band | fixed band below the body (sticky-for-free); mirrors the `segs` loop; `apportionColumns`+`alignCell` | AR-7 |
| Module layout | new `aggregate.ts`/`footer-band.ts`/`master-detail.ts` + `FooterController` (in `grid-footer.ts`); `grid.ts` stays `<1200` | AR-10 |
| Showcase | kitchen-sink story + datagrid-showcase cluster (replaces RD-09 placeholder) | AR-14 |

## Related Files

**New:** `packages/datagrid/src/aggregate.ts`, `packages/datagrid/src/footer-band.ts`,
`packages/datagrid/src/master-detail.ts`, `packages/datagrid/src/grid-footer.ts` (the `GridFooter`
config interface + the `FooterController`); tests `aggregate.spec/impl.test.ts`, `grid-footer.spec.test.ts`,
`footer-band.spec.test.ts`, `master-detail.spec.test.ts`, `reactive-source.spec.test.ts`; a
kitchen-sink `footer-master-detail.story.ts`; a datagrid-showcase `footer-master-detail/` cluster.

**Modified:** `grid.ts` (the `footer` option pass-through + `displayedRows`/`focusedRow`/`focusedKey`
thin accessors), `grid-panels.ts` (the footer band assembled in `buildGridBody`), `data-source.ts`
(the optional `complete?()` seam + `fromReactiveRows`), `index.ts` (barrel), and the datagrid-showcase
`placeholders.ts` + count oracles.
