# ADR-008: Use revisioned query sessions and sparse cell cursors

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-02, RD-09, and RD-14

## Context

The component must treat small eager boards and boards with up to 100,000 logical cards consistently.
Columns crossed with optional swimlanes form sparse cells whose counts, edges, loads, and failures can
be known independently. A flat fully materialized array cannot represent this honestly at scale.

## Options considered

### Require a complete card array

- **Pros**: Simple iteration and sorting.
- **Cons**: Forces full materialization and cannot express unknown logical edges.

### Expose unrelated pagers for every cell

- **Pros**: Lazy loading per cell.
- **Cons**: No coherent board revision and excessive lifecycle objects.

### Open one revisioned query session with sparse cell cursors

- **Pros**: Coherent query semantics, independent cell loading, cancellation, and eager adaptation.
- **Cons**: More explicit count/edge/error states in the public API.

## Decision

`KanbanDataSource` opens a board-wide revisioned query session that lazily exposes sparse cursors for
visible column/swimlane cells.

**Chosen option**: Revisioned query session with sparse cursors, because it scales without pretending
that a loaded-window boundary is an authoritative board edge.

## Consequences

### Positive

- Eager and windowed data share one rendering and interaction path.
- One failed cell can recover without discarding unrelated cells.
- Stale loads can be rejected by session/revision identity.

### Negative

- Adapters must provide explicit count and logical-edge knowledge.
- Selection and placement must tolerate unloaded cards.

### Risks

- Aggressive fetching could defeat sparsity; centralized concurrency, overscan, cancellation, and
  retained-window limits bound acquisition.
