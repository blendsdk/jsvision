# ADR-012: Persist versioned semantic saved views in the application

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-09

## Context

Users need reusable search, filters, sorting, grouping, visibility, and density. Persisting transient
viewport state makes configurations brittle, while letting the component choose a storage mechanism
would violate application authority.

## Options considered

### Persist the complete board instance state

- **Pros**: Exact visual restoration.
- **Cons**: Captures stale focus, scroll, loads, drag state, and implementation details.

### Keep views only in memory

- **Pros**: No compatibility or storage contract.
- **Cons**: Cannot support durable user workflows.

### Encode versioned semantic JSON for application storage

- **Pros**: Durable intent, explicit migrations, and storage independence.
- **Cons**: Requires strict codecs and compatibility policy.

## Decision

Provide bounded, versioned saved-view encode/decode/migration helpers while leaving persistence and
sharing to the application.

**Chosen option**: Application-stored semantic JSON, because it preserves user intent without
serializing transient component mechanics.

## Consequences

### Positive

- Saved views survive component implementation changes when semantics remain compatible.
- Applications choose local, remote, personal, or shared storage and authorization.
- Invalid or future versions can fail without corrupting the active board.

### Negative

- The schema and migration helpers become supported public surfaces.
- Restored views may need reconciliation when referenced columns or fields no longer exist.

### Risks

- Malicious JSON could exhaust resources; byte, depth, array, key, and string bounds apply before
  migration or activation.
