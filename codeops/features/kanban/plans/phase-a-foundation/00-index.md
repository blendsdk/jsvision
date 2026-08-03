# Kanban Phase A Foundation implementation plan

> **Feature**: `@jsvision/kanban` Phase A Foundation
> **Status**: Planning Complete
> **Created**: 2026-08-03
> **CodeOps Artifact Schema**: 1
>
> **Implements**: kanban/RD-01, kanban/RD-02, kanban/RD-03, kanban/SPEC-A-CARD-SLICE, kanban/SPEC-A-COLUMN-SLICE

## Overview

This plan establishes the publishable `@jsvision/kanban` specialist package and its durable public
foundation. It delivers pure validated contracts, eager and custom/windowed data-source seams, a
responsive visually read-only `KanbanBoard<TCard>` with a raw application-dispatched request seam,
composed around one bounded `KanbanViewport<TCard>`, basic
generic and standard card rendering, zero/populated ordered columns, and two-axis scrolling.

Phase A completes RD-01, RD-02, and RD-03. It implements only RD-04 acceptance criteria 1–2 and RD-05
acceptance criteria 1 and 18; neither RD-04 nor RD-05 becomes complete. Navigation/selection commands,
drag/drop, component-generated mutations, editors, configuration dialogs, saved views, swimlane presentation, complete
themes/accessibility, teaching labs, the kitchen sink, and the showcase remain later-phase work.

## Document index

| # | Document | Purpose |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | User and auto-design decisions; Zero-Ambiguity Gate |
| 00 | [Index](00-index.md) | Scope, navigation, and quick reference |
| 01 | [Requirements](01-requirements.md) | Exact owning RDs and Phase A slice contract |
| 02 | [Current State](02-current-state.md) | Repository-grounded starting point and integration inventory |
| 03-01 | [Package and Public Contracts](03-01-package-public-contracts.md) | Package topology, identities, limits, errors, and exports |
| 03-02 | [Query, Session, and Cursors](03-02-query-session-cursors.md) | Semantic query snapshots and sparse source lifecycle |
| 03-03 | [Eager Source and Validation](03-03-eager-source-validation.md) | Reactive eager indexing, counts, placement, and failure isolation |
| 03-04 | [Cards, Descriptors, Theme, and i18n](03-04-cards-descriptors-theme-i18n.md) | Durable presentation contracts and Phase A renderer |
| 03-05 | [Responsive Board and Viewport](03-05-responsive-board-viewport.md) | DSL shell, exact-cell leaf, width solver, projection, and scrolling |
| 03-06 | [Distribution and Integration](03-06-distribution-integration.md) | Docs/API/i18n/plugin/package registration and release checks |
| 07 | [Testing Strategy](07-testing-strategy.md) | Complete criterion-to-oracle map and verification tiers |
| 99 | [Execution Plan](99-execution-plan.md) | Specification-first task checklist |

## Phase A contract

| Area | Delivered now | Explicitly deferred |
|---|---|---|
| Package | Main, testing, and ten locale exports; package metadata; public JSDoc | Additional subpaths |
| State ownership | Application-authoritative records; raw programmatic request/capability seam; publication-only commitment | Component-generated mutations, optimistic visuals, undo/history |
| Data | Validated queries, sessions, sparse cursors, eager helper, custom/windowed source contract | Built-in network/storage adapters |
| Cards | Generic adapter; durable descriptor and `StandardCard` types; basic title/status/focus rendering | Optional sections, checklist rendering, card actions, editors |
| Structure | Zero and populated ordered workflow columns | Full WIP/DoD, collapse, workflow, and swimlane UI |
| Layout | DSL board shell, bounded exact-cell viewport, responsive widths, focused-column fallback, identity reconciliation, scrolling | Navigation commands, drag reveal, sticky swimlane variants |
| i18n/theme | Phase A vocabulary in ten reviewed catalogs; durable semantic role surface | Complete later-phase vocabulary and final contrast matrix evidence |
| Docs/examples | Package docs, architecture reference, generated API and canonical skill integration | Component teaching page, live labs, kitchen sink, showcase |

## Architectural invariants

1. Application records are never mutated by the package.
2. `KanbanBoard` is a DSL-composed `Group`; only `KanbanViewport` owns sanctioned exact-cell work.
3. Logical card count never determines mounted `View` count.
4. The active board owns one query generation; retained cursors and descriptors remain bounded by
   visible, overscan, and explicit prefetch ownership.
5. Query values and public extension output are validated, bounded, sanitized, and snapshotted before
   use. Trusted callbacks receive no implicit host capability.
6. Runtime extension failure degrades one scope and retains the last valid publication; construction
   misuse raises a typed sanitized error.
7. Every in-place semantic card change must publish a cursor or presentation revision before cached
   descriptors may be reused.
8. Source-hosted and window-hosted boards behave identically inside equal content rectangles; frame,
   position, and shadow are host concerns.

## Verification contract

Implementation closes only after package build, typecheck, unit/specification, E2E, dependency,
packed-consumer, and JSDoc checks; affected docs and i18n checks; `yarn verify:local`; source-impact
review; `yarn plugin:update`; and `yarn plugin:check`. CI owns the authoritative full `yarn verify`.
