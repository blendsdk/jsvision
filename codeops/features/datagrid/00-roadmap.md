# Roadmap: DataGrid

> **Feature-Set**: DataGrid (`@jsvision/datagrid`)
> **Status**: In Progress
> **Created**: 2026-07-12
> **Last Updated**: 2026-07-12
> **Progress**: 0 / 14 (0%)
> **CodeOps Skills Version**: 3.4.1

Enterprise-class editable data grid for the jsvision TUI SDK (SAP ALV / MS-Access / Paradox-class),
built on `@jsvision/ui`. A new zero-dependency package `@jsvision/datagrid` (PostgreSQL / Data Studio
is a separate downstream app). Grounded in the Data Studio feasibility spike (Probes 0–7,
GO-WITH-CAVEATS). v1 = "the enterprise datasheet": per-cell immediate editing, row-oriented selection,
virtual scroll, and the enterprise column/sort/filter/footer surface. Zero-Ambiguity Gate PASSED
(AR-01…AR-32). Preflighted 2026-07-12 — codebase-grounded audit PASSED, all 10 findings resolved
(see requirements/00-preflight-report.md).

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Foundation & grid-engine exposure | [RD-01](requirements/RD-01-foundation.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Package scaffold · ui exports `GridRows`/`GridHeader`/`columns.ts` · value/format/parse · `GridDataSource`+`rowKey` · `onCommit` · cell-overlay helper. Gates all others. |
| RD-02 | Editing engine & commit model | [RD-02](requirements/RD-02-editing-engine.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Cell cursor, in-cell overlay lifecycle, per-cell immediate commit, dirty tracking, keymap. Depends RD-01. |
| RD-03 | Cell editors & value help | [RD-03](requirements/RD-03-cell-editors.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Typed editors + custom factory + F4 lookup. Depends RD-01, RD-02. |
| RD-04 | Formatting & cell rendering | [RD-04](requirements/RD-04-formatting-rendering.md) | — | RD Preflighted | 🔎 | 2026-07-12 | `Intl` formatters, parse round-trip, custom renderer, conditional styling. Depends RD-01. |
| RD-05 | Sorting | [RD-05](requirements/RD-05-sorting.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Single/multi/value-aware/push-down. Depends RD-01, RD-04. |
| RD-06 | Filtering | [RD-06](requirements/RD-06-filtering.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Quick row + condition + value-list + funnel/"N of M" + distinct + push-down. Depends RD-01, RD-04. |
| RD-07 | Columns & layout | [RD-07](requirements/RD-07-columns-layout.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Resize/reorder/hide + frozen pinned-panel columns + sticky header. Depends RD-01. |
| RD-08 | Rows, records & selection | [RD-08](requirements/RD-08-rows-selection.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Row selection, checkbox column, gutter, insert/delete/duplicate, null policy. Depends RD-01, RD-02. |
| RD-09 | Footer, aggregation & master-detail | [RD-09](requirements/RD-09-footer-aggregation-master-detail.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Footer band + aggregates + master-detail. Depends RD-01, RD-08. |
| RD-10 | Navigation & interaction | [RD-10](requirements/RD-10-navigation-interaction.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Consolidated keymap, mouse, synthesized double-click. Depends RD-02. |
| RD-11 | Data at scale | [RD-11](requirements/RD-11-data-at-scale.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Virtual scroll, server paging, opt-in pager (backend deferred AR-28). Depends RD-01. |
| RD-12 | Validation & lifecycle | [RD-12](requirements/RD-12-validation-lifecycle.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Per-cell + per-row + BeforeSave gates, error surfacing, loading/empty/error. Depends RD-02, RD-03. |
| RD-13 | Export, import & personalization | [RD-13](requirements/RD-13-export-import-personalization.md) | — | RD Preflighted | 🔎 | 2026-07-12 | CSV/HTML/JSON export (+ formula-injection escaping), import, layout variants. Phase B. Depends RD-05, RD-06, RD-07. |
| RD-14 | Non-functional requirements | [RD-14](requirements/RD-14-non-functional.md) | — | RD Preflighted | 🔎 | 2026-07-12 | Perf, security posture, a11y, theme roles, test tiers, API governance. Cross-cutting. |

## Notes

- 2026-07-12: **RD-01…RD-14 drafted** ✏️ via `make_requirements`, front-loaded from the same-day design
  conversation and grounded in the Data Studio feasibility spike (Probes 0–7). Zero-Ambiguity Gate
  PASSED — 30 items (AR-01…AR-27 resolved; AR-28 pager offset/keyset, AR-29 cell/range selection,
  AR-30 undo/redo confirmed named deferrals). Deferred items: pager backend (Phase-B RD-11), cell/range
  selection (Phase B), undo/redo (Phase B). Next: `preflight` the set, or `make_plan` starting at RD-01.
- 2026-07-12: **Preflighted** 🔎 via `preflight datagrid` — a codebase-grounded audit (5 read-only recon
  agents against the real `@jsvision/ui`/`@jsvision/core` source). 10 findings (3 major / 6 minor / 1 obs),
  **all resolved**; register grew to 32 items (AR-31 value/format/parse split + AR-32 lookup-commits-key).
  Key amendments: container-owned shared cursor/selection (RD-02, so RD-07's 3-panel freeze composes),
  the explicit `GridColumn → engine Column` adapter (RD-01), and the RD-07-as-substrate dependency edges.
  Next: `make_plan` starting at RD-01. See requirements/00-preflight-report.md.
