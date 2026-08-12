# Kanban Phase C Modern Interaction Implementation Plan

> **Feature**: Flagship pointer/keyboard moves and application-authoritative request lifecycles
> **Status**: Planning Complete
> **Created**: 2026-08-11
> **Implements**: kanban/RD-07, kanban/RD-08
> **CodeOps Artifact Schema**: 1

## Overview

Phase C turns the completed core board into a modern interactive Kanban surface. Cards, columns, and
swimlanes can be grabbed with the primary pointer, lifted into a bounded ghost, moved through substantial
drop targets with live reflow and edge autoscroll, cancelled without damage, and released as exactly one
semantic request. Keyboard and programmatic move paths use the same eligibility, placement, dispatcher,
and pending lifecycle instead of creating a second mutation path (AR-C01/C02/C06/C15).

Application data remains authoritative. The component snapshots intent, shows an immutable drag or pending
projection, dispatches through one validated application seam, and reconciles matching, contradictory,
rejected, cancelled, or superseded outcomes. A new reusable UI capture lease closes the current same-frame
capture-loss gap without breaking existing drag controls, while extracted controllers keep the already-large
viewport from becoming the operation state machine (AR-C03/C04/C05/C12/C16).

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Passed Zero-Ambiguity Gate and delegated design record |
| 00 | [Index](00-index.md) | Scope, navigation, and quick reference |
| 01 | [Requirements](01-requirements.md) | Thin delta over RD-07/RD-08 and later-producer boundary |
| 02 | [Current State](02-current-state.md) | Phase B implementation analysis and Phase C gaps |
| 03-01 | [Capture and Input](03-01-capture-input.md) | UI capture lease, pointer normalization, gesture generations |
| 03-02 | [Requests and Placement](03-02-requests-placement.md) | Standard request union, semantic proposals, eligibility |
| 03-03 | [Operation Lifecycle](03-03-operation-lifecycle.md) | Dispatch, pending state, publication, cancellation, undo seams |
| 03-04 | [Drag Interaction](03-04-drag-interaction.md) | State machine, drop map, hysteresis, autoscroll, structural drag |
| 03-05 | [Projection and Rendering](03-05-projection-rendering.md) | Ghost, placeholder, reflow, damage, theme/i18n/accessibility |
| 03-06 | [Integration and Delivery](03-06-integration-delivery.md) | Board/viewport wiring, testing subpath, host/docs/plugin delivery |
| 07 | [Testing Strategy](07-testing-strategy.md) | Requirements-derived immutable specification oracles |
| 08-01 | [Phase 1 Quality Review](08-phase-1-quality-review.md) | Independent capture-lifecycle findings and auto-design rulings |
| 08-02 | [Phase 2 Quality Review](09-phase-2-quality-review.md) | Request and placement contract findings and closure |
| 08-03 | [Phase 3 Quality Review](10-phase-3-quality-review.md) | Operation lifecycle and security findings and closure |
| 08-04 | [Phase 4 Quality Review](11-phase-4-quality-review.md) | Card drag and mounted interaction findings and closure |
| 08-05 | [Phase 5 Quality Review](12-phase-5-quality-review.md) | Projection, rendering, and bounded-work findings and closure |
| 08-06 | [Phase 6 Quality Review](13-phase-6-quality-review.md) | Structural parity, lifecycle, and scale findings and closure |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered specification-first task checklist |

## Quick Reference

### Intended construction

```ts
const board = new KanbanBoard({
  source,
  query,
  card,
  dispatcher: async (request, context) => application.dispatch(request, context),
  operationId: () => application.nextOperationId(),
});
```

The exact proposal/envelope, placement, eligibility, and lifecycle contracts are owned by 03-02 and 03-03.
The application still publishes the resulting authoritative source revision or sends an exact
operation-correlated reconciliation notice; an accepted dispatcher result alone never commits the visible
move (AR-C05/C10–C13).

### Key Decisions

| Decision | Outcome |
|---|---|
| Capture | Generation-bound UI lease with synchronous loss reason and compatibility wrappers (AR-C03) |
| Architecture | Viewport-local gesture/geometry controllers plus one board-level operation coordinator (AR-C04/C16) |
| Placement | Stable anchors/logical edges/token; no authoritative visual index or manufactured rank (AR-C06/C10) |
| Pending state | Immutable overlay until expectation-matched publication, exact correlated reconciliation, rejection, cancellation, or supersession (AR-C05/C12) |
| Bulk/structure | Ordered all-or-nothing card block and equivalent column/swimlane lifecycle (AR-C14) |
| Host evidence | Kanban-owned E2E using public `@jsvision/web`/xterm plus native PTY/ConPTY and designated Node 22 Ubuntu/macOS/Windows CI (AR-C17) |
| Later phases | RD-09–12 producers consume Phase C requests; their UI and complete command/history surfaces remain later (AR-C02/C15) |

## Related Files

- UI capture: `packages/ui/src/event/{types,event-loop,dispatch}.ts`, `packages/ui/src/view/types.ts`.
- Kanban contracts/lifecycle: `packages/kanban/src/contract/{request,authority,capability,observation}.ts`.
- Kanban interaction: `packages/kanban/src/interaction/`, including new drag, target, autoscroll, and operation modules.
- Scene/rendering: `packages/kanban/src/{layout,board}/` with extracted projection composition.
- Tests: `packages/ui/test/`, `packages/kanban/test/`, and platform-scoped Phase C E2E fixtures.
- Distribution: package docs, architecture docs, locales, generated API, plugin references, and `packages/examples/kanban-showcase/**`.
