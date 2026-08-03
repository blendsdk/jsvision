# ADR-010: Model columns plus one optional swimlane dimension

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-05

## Context

Mainstream Kanban boards use workflow columns and often benefit from horizontal grouping for teams,
projects, epics, or sprints. Deep nested grouping consumes terminal rows and makes focus, scrolling,
headers, and drag destinations difficult to understand.

## Options considered

### Workflow columns only

- **Pros**: Smallest geometry and simplest navigation.
- **Cons**: Cannot show important cross-column grouping in one board.

### Arbitrarily nested row groups

- **Pros**: Maximum hierarchy.
- **Cons**: Unbounded visual and interaction complexity in a TUI.

### Columns plus zero or one swimlane dimension

- **Pros**: Supports useful horizontal grouping with predictable geometry and navigation.
- **Cons**: Consumers must flatten deeper hierarchies before presentation.

## Decision

Use ordered workflow columns as the primary axis and support zero or one configurable swimlane
dimension with separators, labels, background distinction, collapse, hide, and filtering.

**Chosen option**: One optional swimlane dimension, because it adds meaningful grouping without
turning the terminal board into a nested tree.

## Consequences

### Positive

- Teams, projects, epics, or sprints can be compared across workflow columns.
- Drag targets and spatial navigation remain two-dimensional and explainable.
- Visual separation can use lines, backgrounds, titles, or combined non-color cues.

### Negative

- Nested organizational structures require application-side projection.
- Collapsed and filtered swimlanes need explicit placement and focus policies.

### Risks

- Labels can consume narrow widths; responsive hybrid/focused modes and display-cell clipping keep all
  mandatory state reachable.
