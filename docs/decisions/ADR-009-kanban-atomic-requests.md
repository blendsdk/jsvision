# ADR-009: Route mutation intent through one atomic dispatcher

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-08, RD-11, and RD-12

## Context

Cards can be moved by pointer, keyboard, commands, dialogs, or programmatic UI. Columns and swimlanes
can also be configured, and bulk operations must succeed or fail coherently. Independent callbacks
for each gesture would fragment authorization, pending state, errors, history, and observability.

## Options considered

### Mutate supplied records in the component

- **Pros**: Immediate local changes.
- **Cons**: Violates application authority and cannot enforce remote policy safely.

### Provide independent callbacks for every control

- **Pros**: Familiar event-handler style.
- **Cons**: Duplicates lifecycle semantics and permits partial multi-step operations.

### Dispatch one discriminated request union

- **Pros**: One atomic lifecycle for every invocation path and one authorization boundary.
- **Cons**: The union is a substantial public compatibility surface.

## Decision

Route all mutation intent through one discriminated `KanbanRequest` dispatcher, using bounded opaque
placement tokens for ordering.

**Chosen option**: Atomic request dispatcher, because it unifies behavior and keeps durable policy in
the host application.

## Consequences

### Positive

- Mouse, keyboard, dialogs, commands, and programmatic actions behave consistently.
- Pending, commit, rejection, stale-revision, undo, and observation semantics have one owner.
- Multi-card moves and structural reassignment can remain atomic.

### Negative

- Adding a request discriminator requires compatibility and exhaustive-handler work.
- Applications must reconcile published source state rather than relying on hidden component mutation.

### Risks

- A capability check may be mistaken for authorization; documentation and tests require the dispatcher
  to authorize every request independently.
