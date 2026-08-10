# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Established the independently publishable `@jsvision/kanban` package boundary.
- Added generic application-owned card, identity, request, capability, observation, and revision
  contracts without a package-owned record store.
- Added eager and sparse/windowed data-source contracts with bounded sessions, cursors, queries,
  loading, honest extents, and deterministic testing fixtures.
- Added bounded card descriptors, a basic title/status renderer, `StandardCard`, semantic theme roles,
  accessibility fallbacks, and ten typed catalogs.
- Added responsive `KanbanBoard` and standalone `KanbanViewport` components with DSL composition,
  wide/compact/focused/minimum-size modes, two-axis scrolling, stable resize anchors, and bounded
  viewport projection.
- Added application-owned request dispatch and publication reconciliation without optimistic record
  mutation.
- Added configurable standard card composition with compact, comfortable, and spacious presentation
  policies; bounded metadata, badges, feedback, definition-of-done, and checklist sections; semantic
  status styling; deterministic degradation; and custom renderer/action-region seams.
- Added ordered workflow structures, transition proposals, WIP evaluation, definition-of-done
  presentation, and one-level horizontal swimlanes with visibility, collapse, summary, separator,
  background-role, rail, derived-grouping, and unassigned-card policies.
- Added a bounded sparse scene model with variable-height cards, semantic hit maps, windowed overscan,
  focused-column geometry, stable anchors, targeted damage, and reactive descriptor rebuilding.
- Added a mount-owned interaction controller and stable programmatic facade with spatial navigation,
  bounded range/toggle/select-all selection, server-selection references, focus reconciliation,
  pending-navigation cancellation, and localized feedback.
- Added mounted keyboard, click, double-click, Ctrl-click, right-click, wheel, card-action, retry, and
  scoped-action routing. Application handlers receive immutable open-card, open-context, and
  scoped-action intents without record payloads or implicit mutation authority.
- Added a reviewed `kanbanPhaseB*` overlay beside every established foundation catalog, preserving the
  exact original symbols while completing vocabulary on the existing ten locale subpaths.
- Added public production, testing, and ten locale entry points plus real packed-consumer,
  dependency, native-dependency, JSDoc, unit, and real-host E2E verification.
- Added a permanent standalone Kanban kitchen sink with an extensible story registry and initial
  rich-card, dense Dutch/German content, swimlane, responsive-layout, keyboard, pointer, and scale
  scenarios.
- Added padded workflow lanes with compact three-row framed sticky headers, per-lane start/center label
  alignment, and continuous joined separators, plus coherent card surfaces with single resting frames,
  double focused frames, bold focused titles, contained focused-card shadows, one-row gaps in every
  named density, symmetric standard-card text padding, and distinct ASCII fallbacks.

### Security

- Kept native dependencies, runtime schema adapters, editor forms, optimistic mutations, and private
  source paths outside the initial public package boundary.
- Bounded source reads, viewport work, retained descriptors, diagnostics, text, identities, and
  application request metadata.
- Required matching semantic targets and scene revisions before pointer release can commit an action;
  move/drag reports and lifecycle teardown cancel incomplete presses.
- Kept card/lane editing, drag-and-drop mutation, and application authorization outside the component;
  the board emits bounded semantic intents and accepts authoritative source publication instead.
