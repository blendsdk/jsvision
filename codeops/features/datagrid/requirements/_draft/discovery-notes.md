# Discovery notes — @jsvision/datagrid (resume state)

> Front-loaded discovery happened in the 2026-07-12 design conversation. This captures the
> confirmed scope so a fresh session can resume. Resume with "make_requirements --continue".

## Current state

- **Phase**: COMPLETE + PREFLIGHTED — all 14 RDs + README + register authored; roadmaps synced; codebase-grounded preflight PASSED (10 findings, all resolved; requirements/00-preflight-report.md).
- **Gate status**: ✅ PASSED — 32 items (AR-01…AR-27 + AR-31/AR-32 resolved; AR-28/29/30 confirmed named deferrals).
- **Next step**: `make_plan` starting at RD-01 (preflight done).

## Locked decisions (see register AR-01…AR-11)

- New package `@jsvision/datagrid` (deps `@jsvision/core` + `@jsvision/ui`), private until ui releases, lockstep version. Data Studio / PostgreSQL = a separate downstream app (the throwaway `packages/spike-data-studio` gets deleted).
- `@jsvision/ui` promotes its grid engine to public API (`GridRows`/`GridHeader`/`columns.ts` helpers+types); ui's read-only `DataGrid` stays as-is.
- Edit/commit: per-cell immediate write-through; per-row gate + BeforeSave veto govern persistence.
- Selection: row-oriented for v1 (cell/range = P2).
- Navigation: virtual scroll default; opt-in pager = P2.
- Removed from scope: collapsible grouping, drag-to-group panel, inline tree-grid, pivot/crosstab.
- Kept in v1: Excel value-list filter, master-detail, frozen columns.

## RD decomposition (approved)

| RD | Capability | Phase | Depends on |
|----|-----------|-------|-----------|
| RD-01 | Foundation & engine exposure (package, ui engine export, value/format/parse, data-source interface, cell-overlay helper, story/test harness) | A | — |
| RD-02 | Editing engine & commit model | A | RD-01 |
| RD-03 | Cell editors & value help | A | RD-01, RD-02 |
| RD-04 | Formatting & cell rendering | A | RD-01 |
| RD-05 | Sorting | A | RD-01, RD-04 |
| RD-06 | Filtering | A | RD-01, RD-04 |
| RD-07 | Columns & layout (resize/reorder/hide/freeze) | A | RD-01 |
| RD-08 | Rows, records & selection | A | RD-01, RD-02 |
| RD-09 | Footer, aggregation & master-detail | A | RD-01, RD-08 |
| RD-10 | Navigation & interaction | A | RD-02 |
| RD-11 | Data at scale (virtual scroll/paging/pager) | A/B | RD-01 |
| RD-12 | Validation & lifecycle | A | RD-02, RD-03 |
| RD-13 | Export, import & personalization | B | RD-05, RD-06, RD-07 |
| RD-14 | Non-functional (perf/security/a11y/testing/API governance) | A | — |

## Phasing

- **Phase A (MVP v1)**: RD-01…12 Must sections + RD-14 — the enterprise datasheet.
- **Phase B (Enhanced P2)**: Should sections + RD-13, pager mode, cell/range selection.
- **Phase C (P3)**: density mode, grouped headers, personalization dialog.

## Grounding / evidence

Data Studio feasibility spike (`packages/spike-data-studio`, Probes 0–7, decision-memo GO-WITH-CAVEATS): Probe 4 editable grid as a `GridRows` subclass + in-cell overlay; Probe 3b/7 windowed paging at 100k; Probe 5 shared RecordSet spine (grid + form); Probe 6 trusted BeforeSave veto; Probe 2 CRUD/txn/concurrency; Probe 1 introspection→editor (that PG layer belongs to the separate Data Studio app). TV fidelity applies to the engine (TListViewer/`tlstview.cpp`); the editable multi-column grid is a documented TV extension.
