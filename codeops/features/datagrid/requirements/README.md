# @jsvision/datagrid — Requirements Documents

> **Project**: @jsvision/datagrid — an enterprise-class editable data grid for the jsvision TUI SDK (SAP ALV / MS-Access / Paradox-class), built on `@jsvision/ui`.
> **Status**: Draft
> **Created**: 2026-07-12
> **Architecture**: New ESM-only, zero-runtime-dependency monorepo package `@jsvision/datagrid` (deps `@jsvision/core` + `@jsvision/ui`), private until `@jsvision/ui` publishes. PostgreSQL / Data Studio is a separate downstream application.
> **CodeOps Skills Version**: 3.4.1

---

## Overview

`@jsvision/datagrid` is a terminal-native, editable, enterprise data grid. It reuses the virtual-
scroll/column engine that `@jsvision/ui`'s read-only `DataGrid` already ships (promoted to public API),
and layers editing, typed cell editors, locale-aware formatting, sorting, Excel-class filtering,
column management with frozen panels, row selection and CRUD, a widget-hosting footer band with
aggregates, master-detail, and a validation/commit-safety pipeline.

The design was front-loaded through a 2026-07-12 discovery conversation and grounded in the Data
Studio feasibility spike (`packages/spike-data-studio`, Probes 0–7, verdict GO-WITH-CAVEATS), which
proved the make-or-break pieces against live PostgreSQL: the editable grid as an additive `GridRows`
subclass with an in-cell editor overlay, windowed paging at 100k rows, a shared record spine driving
grid + form, and a trusted BeforeSave veto.

The v1 target is "the enterprise datasheet": per-cell immediate write-through editing, row-oriented
selection, continuous virtual scroll, and the enterprise column/sort/filter/footer surface. Postgres
binding, cell/range selection, undo/redo, and the pager backend are explicit Phase-B follow-ups.

## Domain Glossary

| Term | Definition |
|------|-----------|
| `EditableDataGrid<T>` | The public grid component (a `Group`) composing header, editable body, and optional footer bands. |
| `GridColumn<T,V>` | A column descriptor separating `value` (typed, the sort/filter key), `format` (display string), and `parse` (edit round-trip). |
| value / format / parse | The linchpin split: sorting/filtering use `value`; the cell shows `format(value)`; editing round-trips via `parse`. |
| `GridDataSource<T>` | The read/mutate seam (`rowKey`/`length`/`rowAt`/`ensureRange`/`setSort`/`setFilter`/`distinct`) satisfied by both an in-memory and a windowed/server source. |
| `rowKey` | Required stable row identity; selection, dirty tracking, reactive reconcile, and commit target key by it. |
| `onCommit` | The per-cell commit sink; returning `false`/rejecting vetoes and reverts. |
| Cell cursor | The two-axis (row + column) focus within the grid, distinct from record selection. |
| Dirty tracking | Per-cell pending/changed state, keyed by `rowKey`+`columnId`, shown by a marker. |
| Frozen / pinned columns | Left/center/right panel split; pinned columns don't scroll horizontally. |
| Footer band | A reserved bottom band hosting column aggregates and free-form widgets (totals, buttons, pager, navigator). |
| Master-detail | A child grid whose rows are a reactive `computed` over the master's selected record. |
| Quick-filter row / value-list / funnel | The always-visible per-column filter inputs / the Excel distinct-value checkbox picker / the filtered-column indicator. |
| Push-down | Delegating sort/filter/distinct to the data source (server re-query) instead of client-side. |
| Virtual scroll / pager | Continuous windowed rendering (v1 default) / opt-in fixed-page navigation (Phase B). |
| BeforeSave veto | A trusted caller hook that can block persistence before `onCommit`. |
| Variant | A saved layout (column order/width/visibility/freeze/sort/filter). |
| sanitize boundary | The core injection boundary all rendered/pasted/imported text passes through. |

## Document Index

| # | Document | Description | Depends On |
|---|----------|-------------|------------|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (57 items, all resolved) | — |
| **RD-01** | [Foundation & Grid-Engine Exposure](RD-01-foundation.md) | Package scaffold, ui engine export, value/format/parse, data-source + rowKey + commit contracts, cell-overlay helper | — |
| **RD-02** | [Editing Engine & Commit Model](RD-02-editing-engine.md) | Cell cursor, in-cell overlay lifecycle, per-cell immediate commit, dirty tracking, keymap | RD-01 |
| **RD-03** | [Cell Editors & Value Help](RD-03-cell-editors.md) | Typed editors, custom factory, F4 lookup | RD-01, RD-02 |
| **RD-04** | [Formatting & Cell Rendering](RD-04-formatting-rendering.md) | `Intl` formatters, parse round-trip, custom renderer, conditional styling | RD-01 |
| **RD-05** | [Sorting](RD-05-sorting.md) | Single/multi/value-aware/push-down sort | RD-01, RD-04 |
| **RD-06** | [Filtering](RD-06-filtering.md) | Quick-filter row, condition + value-list filters, funnel, distinct seam, push-down | RD-01, RD-04 |
| **RD-07** | [Columns & Layout](RD-07-columns-layout.md) | Resize/reorder/hide, frozen pinned-panel columns, sticky header | RD-01 |
| **RD-08** | [Rows, Records & Selection](RD-08-rows-selection.md) | Row selection, checkbox column, gutter, insert/delete/duplicate, null policy | RD-01, RD-02 |
| **RD-09** | [Footer, Aggregation & Master-Detail](RD-09-footer-aggregation-master-detail.md) | Footer band + aggregates + master-detail | RD-01, RD-08 |
| **RD-10** | [Navigation & Interaction](RD-10-navigation-interaction.md) | Consolidated keymap, mouse, synthesized double-click | RD-02 |
| **RD-11** | [Data at Scale](RD-11-data-at-scale.md) | Virtual scroll, server paging, opt-in pager | RD-01 |
| **RD-12** | [Validation & Lifecycle](RD-12-validation-lifecycle.md) | Per-cell + per-row + BeforeSave gates, error surfacing, loading/empty/error | RD-02, RD-03 |
| **RD-13** | [Export, Import & Personalization](RD-13-export-import-personalization.md) | CSV/HTML/JSON export, import, layout variants | RD-05, RD-06, RD-07 |
| **RD-14** | [Non-Functional Requirements](RD-14-non-functional.md) | Perf, security posture, a11y, theme roles, test tiers, API governance | — |
| **RD-15** | [DataGrid Showcase App](RD-15-showcase-app.md) | Standalone datagrid showcase in `packages/examples/datagrid-showcase/`: granular one-per-capability demos for RD-01…06 + per-RD "coming soon" panels for RD-07…14; `demo:datagrid` | RD-01…RD-06 |
| **RD-16** | [Column & Variant Personalization Dialog](RD-16-personalization-dialog.md) | End-user modal for column show/hide/reorder/freeze/width + variant save/apply/delete/default; `personalizeGrid()` helper, public `grid.columns()` accessor, caller `VariantStore` | RD-07, RD-13 |

## Dependency Graph

```
RD-01 ─┬─ RD-02 ─┬─ RD-03 ─── RD-12
       │         ├─ RD-08 ─── RD-09
       │         └─ RD-10
       ├─ RD-04 ─┬─ RD-05 ─┐
       │         └─ RD-06 ─┴─ RD-13 ─── RD-16
       ├─ RD-07 ─────────────┴───────────┘
       └─ RD-11
RD-14 ── cross-cutting (governs RD-01…RD-16)
RD-15 ── showcase (consumes the shipped RD-01…RD-06 surface; placeholder panels track RD-07…RD-14)
RD-16 ── personalization dialog (end-user UI on RD-07 layout + RD-13 variant APIs)
```

No circular dependencies. RD-01 gates everything; RD-14 is cross-cutting. **RD-07 (pinned-panel layout)
is also a substrate**: RD-06 (funnel in each panel header), RD-08 (checkbox/gutter in the left panel),
RD-09 (aggregates aligned to panel columns), and RD-10 (mouse → cell via the panel split) each build on
it — those cross-edges are omitted from the tree above for readability but are recorded in each RD's
`Depends On`. The three-panel body, with the **container-owned shared cursor/selection**, is decided at
RD-02, not retrofitted in RD-07.

## Suggested Implementation Order

| Phase | Documents | Description |
|-------|-----------|-------------|
| **A: MVP — the enterprise datasheet (v1)** | RD-01 → RD-02 → RD-04 → RD-03 → RD-05 → RD-06 → RD-07 → RD-08 → RD-09 → RD-10 → RD-11(core) → RD-12 (+ RD-14 throughout) | Editable, formatted, sortable, filterable, frozen-column, row-selectable, footer-aggregating grid over virtual scroll, with validation. |
| **B: Enhanced (P2)** | Should-sections across RDs + RD-13; pager mode (RD-11); cell/range selection; concurrency/pending/retry (RD-12); master-detail drill-in (RD-09) | Export/import/variants, pager, richer selection and lifecycle. |
| **C: Later (P3)** | density/compact mode, grouped headers, **personalization dialog ([RD-16](RD-16-personalization-dialog.md) — now specified)**, row drag-reorder | Polish and long-tail parity. |

## Key Architecture Decisions

| Decision | Choice | Rationale | AR |
|----------|--------|-----------|----|
| Package boundary | New `@jsvision/datagrid`; PG separate app | Independent versioning, clean boundary | AR #1 |
| Engine reuse | Export `GridRows`/`columns.ts` from `@jsvision/ui` | Additive; avoids a dependency cycle | AR #12 |
| Value vs display | Split `value`/`format`/`parse` | Correct type-aware sort/filter/edit | AR #31 |
| Row identity | Required `rowKey` accessor | Survives sort/filter/reorder | AR #15 |
| Data source | In-memory + windowed `GridDataSource` | One body, both scales | AR #14 |
| Commit model | Per-cell immediate; gates govern persistence | Simple datasheet; veto-safe | AR #2, #16 |
| Selection | Row-oriented (v1) | SAP/Access model; cell-range is P2 | AR #3 |
| Navigation | Virtual scroll default; pager opt-in | Modern default | AR #4 |
| Freeze | Left/center/right pinned panels | Composes with Group; AG-Grid/SAP model | AR #8 |
| Callback trust | Trusted TS + draw-error isolation; all output sanitized | SDK trusted-code model | AR #25 |

## How to Use These Documents

Each requirements document is designed to be used with the make_plan skill:

1. Pick a requirements document (start with RD-01).
2. Run the make_plan skill for `datagrid`.
3. The plan system uses the RD as input to create implementation plans.
4. Run the exec_plan skill for the feature.
5. Implement iteratively, specification-first.

Suggested order: **RD-01 → RD-02 → RD-04 → RD-03 → RD-05 → RD-06 → RD-07 → RD-08 → RD-09 → RD-10 → RD-11 → RD-12 → (RD-13) → RD-14 verified throughout.**

**RD-15 (showcase)** is buildable now — it consumes only the shipped RD-01…RD-06 surface and is
independent of the remaining RDs (which it represents as "coming soon" placeholder panels until they
land). It is the living acceptance surface each future RD extends with its own demo cluster.
