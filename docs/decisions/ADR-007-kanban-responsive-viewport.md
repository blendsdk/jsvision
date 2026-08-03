# ADR-007: Compose responsively around one exact-cell viewport

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-03 and responsive layout mandate

## Context

JSVision's layout DSL supplies responsive flow, measurement, and ownership. A Kanban viewport also
needs exact cell geometry for virtual scrolling, sticky regions, hit testing, damage calculation,
drag ghosts, and insertion markers. Making either concern dominate the whole component would weaken
the other.

## Options considered

### Build the entire board with bespoke rectangles

- **Pros**: Direct control over every cell.
- **Cons**: Duplicates responsive layout behavior and makes dialogs/chrome brittle.

### Build every card and interaction solely from ordinary child views

- **Pros**: Maximum use of standard composition.
- **Cons**: A view per logical card cannot support large sparse boards or coherent drag geometry.

### Use a DSL-composed board with one measured viewport leaf

- **Pros**: Responsive ordinary UI with one isolated owner for exact virtualized geometry.
- **Cons**: Requires a carefully documented boundary between composition and projection.

## Decision

Implement `KanbanBoard<TCard>` as a layout-DSL `Group` containing one measured
`KanbanViewport<TCard>` custom leaf for exact-cell work.

**Chosen option**: DSL-composed board plus measured viewport, because it preserves responsiveness
without sacrificing bounded rendering and modern pointer interaction.

## Consequences

### Positive

- Board chrome, cards' internal layout, dialogs, and state surfaces reflow consistently.
- Exact geometry and invalidation have one owner.
- Tests can separately verify DSL responsiveness and viewport projection.

### Negative

- The viewport must translate DSL-assigned geometry into its own clipped coordinate map.
- Some visual card structure is descriptor-rendered rather than one retained view per card.

### Risks

- Exact geometry could leak outward; code review and architecture tests must keep raw rectangles
  limited to the documented viewport, window-manager, and framework-overlay exceptions.
