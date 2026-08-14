# Kanban Phase D Productivity and Editing Implementation Plan

> **Feature**: Search, views, editors, board configuration, commands, events, capabilities, and history
> **Status**: Preflighted — Ready for Execution
> **Created**: 2026-08-14
> **Implements**: kanban/RD-09, kanban/RD-10, kanban/RD-11, kanban/RD-12
> **CodeOps Artifact Schema**: 1

## Overview

Phase D turns the completed board/interaction foundation into a productive application component.
It adds an application-bindable view controller and optional responsive view chrome, versioned saved
views, generic and standard card editors, programmatic and package-provided structure configuration,
a stable action/keymap/capability layer, normalized events, and application-owned history integration.

The phase preserves the existing authority boundary: view changes are pure local transitions, while
card, structure, saved-view-store, and history mutations enter the existing request coordinator.
`KanbanViewport` remains the bounded exact-cell projection leaf; new orchestration is split into
testable modules and composed by `KanbanBoard` (AR-D03–D11).

## Planning contract

| Boundary | Value |
|---|---|
| Scope | RD-09 → RD-10 → RD-11 → RD-12 only (AR-D01) |
| Mode | Auto-design, strict scope |
| Requirements ownership | The four RDs remain the behavioral source of truth |
| Verification | `yarn verify:local` plus focused workspace gates; full repository verify remains CI-owned (AR-D16) |

## Document index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate and delegated design record |
| 00 | [Index](00-index.md) | Scope, navigation, and public shape |
| 01 | [Requirements](01-requirements.md) | Thin RD delta and phase boundary |
| 02 | [Current State](02-current-state.md) | Existing seams, gaps, risks, and target files |
| 03-01 | [View State and Projection](03-01-view-state-projection.md) | Registries, controller, query pipeline, counts, and chrome |
| 03-02 | [Saved Views](03-02-saved-views.md) | Envelope, codec, migrations, reconciliation, and store requests |
| 03-03 | [Card Editors](03-03-card-editors.md) | Generic schema, standard adapter, drafts, and dialogs |
| 03-04 | [Board Configuration](03-04-board-configuration.md) | Structural builders, validation, dialogs, and delete policies |
| 03-05 | [Actions and Capabilities](03-05-actions-capabilities.md) | Commands, keymap, routing, help, and read-only mode |
| 03-06 | [Events and History](03-06-events-history.md) | Ordered events, subscriptions, observations, undo, and redo |
| 03-07 | [Integration and Delivery](03-07-integration-delivery.md) | Board composition, i18n, examples, docs, plugin, and quality |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification oracles and verification matrix |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered task checklist |

## Public usage direction

```ts
const view = createKanbanViewController({ registries, initial: { density: 'comfortable' } });
const board = new KanbanBoard({
  source,
  query: view.query,
  view: { controller: view, chrome: 'standard' },
  card,
  editor,
  actions,
  dispatcher,
});
```

Applications may omit package view chrome, editors, configuration dialogs, or default actions and
invoke the same public controllers/builders themselves. The exact signatures are owned by the
component specifications, not this overview.

## Key decisions

| Decision | Outcome |
|---|---|
| View ownership | Dedicated controller bound into the board; viewport stays projection-only (AR-D03) |
| Saved state | Layered validated v1 codec, sequential migrations, deterministic reconciliation (AR-D04) |
| Editing | Zod-free generic protocol plus Forms/Zod standard adapter (AR-D05–D07) |
| Mutations | Pure builders and dialogs converge on the existing board authority (AR-D08) |
| Actions | One registry/keymap/capability/router path for every invocation origin (AR-D09) |
| Events/history | Ordered payload-free event hub and application-owned fresh history requests (AR-D10–D11) |
| Delivery | Main barrel, existing locale/testing subpaths, incremental showcase and plugin parity (AR-D14–D16) |
| Availability | Transactional candidate query sessions preserve the usable projection on failure (AR-D17) |
| Host input | Additive Core Primary/Meta and Web DOM pointer normalization precede Kanban commands (AR-D20) |
| Compatibility | Controller-owned facets compose explicitly over legacy board getters (AR-D22) |

## Expected modification areas

- `packages/kanban/src/{view,editor,configuration,command,event,source}/`
- `packages/kanban/src/board/`, `contract/`, `i18n/`, `locales/`, `index.ts`, and package manifest
- `packages/core/src/engine/input/` and `packages/web/src/` for the RD-12 host prerequisite
- `packages/kanban/test/` and `packages/kanban/src/testing/`
- `packages/examples/kanban-showcase/`, `packages/examples/github-project-kanban/`, and example tests
- `packages/kanban/README.md`, `docs/architecture/`, and generated plugin references

Requirements and preflight artifacts are read-only inputs. RD-13–RD-15 completion stays with
Phases E–F (AR-D02).
