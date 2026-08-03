# ADR-013: Centralize limits and progressive terminal degradation

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-13 and RD-14

## Context

Terminals vary in size, color depth, Unicode support, mouse fidelity, and host capabilities. Kanban
adapters and sources may also return large or malformed data. Scattered implicit defaults would make
behavior hard to test and unsafe to extend.

## Options considered

### Leave limits and fallbacks to each implementation site

- **Pros**: Local flexibility.
- **Cons**: Inconsistent behavior, hidden unbounded work, and compatibility drift.

### Require one rich terminal profile

- **Pros**: Smaller presentation matrix.
- **Cons**: Excludes valid JSVision hosts and weakens accessibility.

### Export centralized limits and degrade progressively

- **Pros**: Testable resource bounds and honest behavior across host profiles.
- **Cons**: Defaults and fallback ordering become public compatibility commitments.

## Decision

Export one conservative defaults/limits manifest and support progressive degradation across geometry,
color, Unicode, mouse, and async capability profiles without losing keyboard reachability.

**Chosen option**: Centralized bounded degradation, because predictable limits and fallbacks are
necessary for a safe extensible TUI component.

## Consequences

### Positive

- Performance, security, and accessibility tests share exact thresholds.
- Applications may lower permitted bounds without inventing incompatible semantics.
- Monochrome, ASCII-safe, narrow, and keyboard-only use remain first-class.

### Negative

- Changing a default may require a compatibility review.
- Rich visual states need redundant non-color cues and measured fallback designs.

### Risks

- A hard bound may be too low for a legitimate consumer; configuration can lower or selectively raise
  only documented safe bounds, and benchmarks must justify future default changes.
