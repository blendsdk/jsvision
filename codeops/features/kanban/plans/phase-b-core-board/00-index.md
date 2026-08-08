# Kanban Phase B Core Board Implementation Plan

> **Feature**: Complete the visually rich, structured, keyboard-and-pointer-navigable Kanban core
> **Status**: Executing
> **Created**: 2026-08-04
> **Implements**: kanban/RD-04, kanban/RD-05, kanban/RD-06
> **CodeOps Artifact Schema**: 1

## Overview

Phase B turns the Phase A read-only foundation into the complete core board. It adds bounded standard
card content and reactive presentation, one optional horizontal swimlane dimension, workflow-policy
surfaces, variable-height geometry, deterministic focus/navigation/selection, and modern click,
double-click, and context targeting. The application remains authoritative for records, policy,
authorization, and mutation (PAR-B04).

The implementation retains the existing DSL shell and one exact-cell viewport, extending them through
pure bounded models rather than mounting a view per logical card or cell (PAR-B05). Later phases still
own drag/drop, mutation lifecycle, saved views, editor/configuration dialogs, formal commands/events,
complete accessibility hardening, and showcase documentation (PAR-B01–03). Phase B supplies only the
durable hooks those phases will consume, and the roadmap remains criterion-honest (PAR-B25).

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Passed Zero-Ambiguity Gate and delegated design record |
| 00 | [Index](00-index.md) | Scope, navigation, and quick reference |
| 01 | [Requirements](01-requirements.md) | Thin delta over RD-04–06 and partial-integration boundary |
| 02 | [Current State](02-current-state.md) | Phase A implementation analysis and Phase B gaps |
| 03-01 | [Presentation Contracts](03-01-presentation-contracts.md) | Public policies, budgets, adapters, intents, and ownership |
| 03-02 | [Cards and Styling](03-02-cards-styling.md) | Standard sections, checklist, summaries, degradation, and reactivity |
| 03-03 | [Structure and Workflow](03-03-structure-workflow.md) | Columns, swimlanes, WIP/DoD/transition models, and state semantics |
| 03-04 | [Scene and Geometry](03-04-scene-geometry.md) | Normalized 2-D scene, sparse heights, presentation variants, and drawing |
| 03-05 | [Interaction Model](03-05-interaction-model.md) | Single-owner focus, navigation, selection, and reconciliation |
| 03-06 | [Input and Integration](03-06-input-integration.md) | Keyboard/pointer routing, semantic intents, lifecycle, and package integration |
| 07 | [Testing Strategy](07-testing-strategy.md) | Requirements-derived specification oracles and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered specification-first task checklist |

## Quick Reference

### Intended construction

```ts
const board = new KanbanBoard({
  source,
  query, // The query owns the optional groupBy field.
  card,
  presentation: () => 'comfortable',
  onInteraction: (intent) => handleBoardIntent(intent),
});
```

The exact contracts are owned by [Presentation Contracts](03-01-presentation-contracts.md); this
snippet is an orientation example, not an additional specification.

### Key Decisions

| Decision | Outcome |
|---|---|
| Rendering topology | DSL `KanbanBoard` plus one bounded exact-cell `KanbanViewport` (PAR-B05) |
| Interaction ownership | Stable board facade over one default or mount-factory controller (PAR-B06) |
| Swimlane architecture | One canonical scene with thin geometry strategies (PAR-B07/PAR-B10) |
| Activation integration | Durable semantic intent; no mutation-dispatch misuse or temporary callback (PAR-B08) |
| Variable heights | Sparse measured/estimated prefix-height runs with stable-anchor correction (PAR-B26) |
| Later systems | Durable hooks only; integrations remain open until their owning phases (PAR-B01/PAR-B25) |

## Related Files

Primary implementation remains under `packages/kanban/src/{card,source,layout,board,interaction}/`.
Specification and implementation tests remain separated under `packages/kanban/test/`. Phase B also
updates package/architecture documentation, official catalogs and review evidence, and mapped JSVision
plugin outputs per PAR-B22–24.
