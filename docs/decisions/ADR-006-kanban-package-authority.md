# ADR-006: Isolate Kanban while retaining application authority

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-01, RD-08, and RD-15

## Context

Kanban is large enough to need its own models, interaction engine, dialogs, localization, tests, and
documentation. At the same time, consumers have different records, persistence systems, workflow
rules, and authorization models. A reusable component must not become an accidental database or
policy engine.

## Options considered

### Add Kanban directly to `@jsvision/ui`

- **Pros**: One dependency and familiar imports.
- **Cons**: Expands the general widget package with specialist data and workflow contracts.

### Publish a self-persisting Kanban package

- **Pros**: More built-in application behavior.
- **Cons**: Imposes storage, authorization, and record schemas that cannot serve general consumers.

### Publish an application-owned specialist package

- **Pros**: Matches Data Grid and Code Editor precedent while keeping persistence and policy pluggable.
- **Cons**: Consumers must provide adapters and a request dispatcher.

## Decision

Publish `@jsvision/kanban` as a standalone specialist package whose records, persistence,
authorization, and mutation authority remain application-owned.

**Chosen option**: Application-owned specialist package, because it provides a complete UI without
claiming domain authority it cannot safely generalize.

## Consequences

### Positive

- General UI consumers do not pay for Kanban-specific contracts.
- The same component can front local, remote, eager, or windowed application data.
- Package-owned dialogs remain optional input collectors rather than persistence owners.

### Negative

- Integrators must implement or adapt data and mutation interfaces.
- The package must document ownership boundaries carefully.

### Risks

- Convenience helpers could drift into hidden persistence; public reviews must reject any helper that
  mutates durable records outside the dispatcher.
