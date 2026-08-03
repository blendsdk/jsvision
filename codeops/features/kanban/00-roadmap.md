# Roadmap: JSVision Kanban

> **Feature-Set**: JSVision Kanban
> **Status**: In Progress
> **Created**: 2026-08-03
> **Last Updated**: 2026-08-04
> **Progress**: 0 / 15 (0%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| RD-01 | Package and public architecture | [RD-01](requirements/RD-01-package-public-architecture.md) | [Phase A](plans/phase-a-foundation/00-index.md) | Executing | 🔄 | 2026-08-04 | — |
| RD-02 | Data sources and query model | [RD-02](requirements/RD-02-data-sources-query-model.md) | [Phase A](plans/phase-a-foundation/00-index.md) | Executing | 🔄 | 2026-08-04 | depends on RD-01 |
| RD-03 | Responsive layout and viewport | [RD-03](requirements/RD-03-responsive-layout-viewport.md) | [Phase A](plans/phase-a-foundation/00-index.md) | Executing | 🔄 | 2026-08-04 | depends on RD-01, RD-02 |
| RD-04 | Cards and presentation | [RD-04](requirements/RD-04-cards-presentation.md) | [Phase A slice](plans/phase-a-foundation/00-index.md) | RD Preflighted | 🔎 | 2026-08-03 | only AC 1–2 planned; depends on RD-01, RD-03 |
| RD-05 | Columns, swimlanes, and workflow policy | [RD-05](requirements/RD-05-columns-swimlanes-workflow.md) | [Phase A slice](plans/phase-a-foundation/00-index.md) | RD Preflighted | 🔎 | 2026-08-03 | only AC 1/18 planned; depends on RD-02–RD-04 |
| RD-06 | Focus, navigation, and selection | [RD-06](requirements/RD-06-focus-navigation-selection.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-03, RD-05 |
| RD-07 | Pointer drag and drop | [RD-07](requirements/RD-07-pointer-drag-drop.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-03, RD-04, RD-06 |
| RD-08 | Requests, placement, and operation lifecycle | [RD-08](requirements/RD-08-requests-placement-lifecycle.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-02, RD-05–RD-07 |
| RD-09 | Search, filters, sorting, and saved views | [RD-09](requirements/RD-09-search-filters-saved-views.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-02, RD-05, RD-06, RD-08 |
| RD-10 | Card schema and editor dialogs | [RD-10](requirements/RD-10-card-schema-editor-dialogs.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-04, RD-08 |
| RD-11 | Board configuration APIs and dialogs | [RD-11](requirements/RD-11-board-configuration-dialogs.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-05, RD-08–RD-10 |
| RD-12 | Commands, events, capabilities, and history | [RD-12](requirements/RD-12-commands-events-capabilities.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-06, RD-08, RD-09, RD-11 |
| RD-13 | Internationalization, theming, and accessibility | [RD-13](requirements/RD-13-i18n-theme-accessibility.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-03, RD-04, RD-10, RD-12 |
| RD-14 | Quality, scale, security, and resilience | [RD-14](requirements/RD-14-quality-scale-security.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-01–RD-13 |
| RD-15 | Documentation, examples, and distribution | [RD-15](requirements/RD-15-docs-examples-distribution.md) | — | RD Preflighted | 🔎 | 2026-08-03 | depends on RD-01–RD-14 |
