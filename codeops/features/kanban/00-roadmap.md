# Roadmap: JSVision Kanban

> **Feature-Set**: JSVision Kanban
> **Status**: In Progress
> **Created**: 2026-08-03
> **Last Updated**: 2026-08-14 12:16 CEST
> **Progress**: 8 / 15 (53%)
> **CodeOps Artifact Schema**: 1

> **Corrective gate cleared:** T-03 completed automated and native-terminal acceptance on 2026-08-14;
> regular Kanban roadmap planning may resume.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| RD-01 | Package and public architecture | [RD-01](requirements/RD-01-package-public-architecture.md) | [Phase A](plans/phase-a-foundation/00-index.md) | Done | ✅ | 2026-08-04 | — |
| RD-02 | Data sources and query model | [RD-02](requirements/RD-02-data-sources-query-model.md) | [Phase A](plans/phase-a-foundation/00-index.md) | Done | ✅ | 2026-08-04 | depends on RD-01 |
| RD-03 | Responsive layout and viewport | [RD-03](requirements/RD-03-responsive-layout-viewport.md) | [Phase A](plans/phase-a-foundation/00-index.md) | Done | ✅ | 2026-08-04 | depends on RD-01, RD-02 |
| RD-04 | Cards and presentation | [RD-04](requirements/RD-04-cards-presentation.md) | [Phase A slice](plans/phase-a-foundation/00-index.md), [Phase B](plans/phase-b-core-board/00-index.md) | Done | ✅ | 2026-08-14 | depends on RD-01–RD-03 |
| RD-05 | Columns, swimlanes, and workflow policy | [RD-05](requirements/RD-05-columns-swimlanes-workflow.md) | [Phase A slice](plans/phase-a-foundation/00-index.md), [Phase B](plans/phase-b-core-board/00-index.md) | Done | ✅ | 2026-08-14 | depends on RD-02–RD-04 |
| RD-06 | Focus, navigation, and selection | [RD-06](requirements/RD-06-focus-navigation-selection.md) | [Phase B](plans/phase-b-core-board/00-index.md) | Done | ✅ | 2026-08-14 | depends on RD-03, RD-05 |
| RD-07 | Pointer drag and drop | [RD-07](requirements/RD-07-pointer-drag-drop.md) | [Phase C](plans/phase-c-modern-interaction/00-index.md) | Done | ✅ | 2026-08-12 | depends on RD-03, RD-04, RD-06 |
| RD-08 | Requests, placement, and operation lifecycle | [RD-08](requirements/RD-08-requests-placement-lifecycle.md) | [Phase C](plans/phase-c-modern-interaction/00-index.md) | Done | ✅ | 2026-08-12 | depends on RD-02, RD-05–RD-07 |
| RD-09 | Search, filters, sorting, and saved views | [RD-09](requirements/RD-09-search-filters-saved-views.md) | [Phase D](plans/phase-d-productivity-editing/00-index.md) | Executing | 🔄 | 2026-08-14 | depends on RD-02, RD-05, RD-06, RD-08 |
| RD-10 | Card schema and editor dialogs | [RD-10](requirements/RD-10-card-schema-editor-dialogs.md) | [Phase D](plans/phase-d-productivity-editing/00-index.md) | Plan Preflighted | 🔬 | 2026-08-14 | depends on RD-04, RD-08 |
| RD-11 | Board configuration APIs and dialogs | [RD-11](requirements/RD-11-board-configuration-dialogs.md) | [Phase D](plans/phase-d-productivity-editing/00-index.md) | Plan Preflighted | 🔬 | 2026-08-14 | depends on RD-05, RD-08–RD-10 |
| RD-12 | Commands, events, capabilities, and history | [RD-12](requirements/RD-12-commands-events-capabilities.md) | [Phase D](plans/phase-d-productivity-editing/00-index.md) | Plan Preflighted | 🔬 | 2026-08-14 | depends on RD-06, RD-08, RD-09, RD-11 |
| RD-13 | Internationalization, theming, and accessibility | [RD-13](requirements/RD-13-i18n-theme-accessibility.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-03, RD-04, RD-10, RD-12 |
| RD-14 | Quality, scale, security, and resilience | [RD-14](requirements/RD-14-quality-scale-security.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-01–RD-13 |
| RD-15 | Documentation, examples, and distribution | [RD-15](requirements/RD-15-docs-examples-distribution.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-01–RD-14 |
| T-01 | Permanent Kanban kitchen-sink foundation | — | [Execution plan](plans/kanban-kitchen-sink-foundation/99-execution-plan.md) | Done | ✅ | 2026-08-10 | incrementally demonstrates shipped behavior, including dense localized content; does not advance RD-15 |
| T-02 | Kanban visual grouping correction | — | [Execution plan](plans/kanban-visual-grouping/99-execution-plan.md) | Done | ✅ | framed compact alignable headers, framed focus, symmetric content padding, shadows, standard card gaps, and coherent surfaces |
| T-03 | Kanban interaction and performance stabilization | — | [Execution plan](plans/kanban-interaction-performance-stabilization/99-execution-plan.md) | Done | ✅ | 2026-08-14 10:44 CEST | automated and native-terminal stabilization gates accepted; regular roadmap unblocked |
