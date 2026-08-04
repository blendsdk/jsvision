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
- Added public production, testing, and ten locale entry points plus real packed-consumer,
  dependency, native-dependency, JSDoc, unit, and real-host E2E verification.

### Security

- Kept native dependencies, runtime schema adapters, editor forms, optimistic mutations, and private
  source paths outside the initial public package boundary.
- Bounded source reads, viewport work, retained descriptors, diagnostics, text, identities, and
  application request metadata.
