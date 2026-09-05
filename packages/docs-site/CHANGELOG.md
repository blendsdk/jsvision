# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-09-05

Changed:
- Updated component documentation for Group Box in `containers/group-box.md`.
- Enhanced the example for Group Box in `examples/containers/group-box.ts`.
- Improved API mapping in `src/api/api-map.mjs`.
- Refined container component tests in `test/container-components.spec.test.ts`.
- Expanded testing for Group Box component in `test/group-box-component.spec.test.ts`.

## [Unreleased]

### Added

- Add the complete GroupBox teaching page and centered Classic-theme laboratory with responsive interaction coverage.

## [1.6.0] - 2026-08-08

### Changed
- Closed row recovery quality findings by exposing a deterministic pending revert through real public grid state.
- Updated round-trip numeric validation data to verify official German feedback.
- Refined independent Phase 2 quality closure documentation across several files.
- Enhanced documentation and examples for row recovery teaching phase with updated JSDoc examples.

### Added
- Introduced row recovery validation lab featuring real Start and End edits, asynchronous restore persistence, and observable status and cursor probes.

### Fixed
- Resolved action-adapter case preservation issues and improved self-containment of new row-revert examples in documentation.

### Test
- Strengthened implementation coverage for row recovery lab wiring including browser-style Arrow action normalization.

## [1.5.1] - 2026-07-31

Fixed:
- Removed dependency on crash guide history to prevent crashes; linked crash-safety artifacts through the stable master branch.
- Retained executable lifecycle coverage without querying rewritten Git objects.
- Verified focused crash-safety contracts and the complete re-implementation in tests.

## [1.5.0] - 2026-07-31

Added:
- Showcase runnable applications with a responsive eight-app gallery and live entry points.
- Reusable, consistently sized screenshots added for various applications.

Changed:
- Synchronized installation guide version to match the released 1.4.0 package version.
- Documented UI version will now be derived during every release preparation.

Fixed:
- Focused content related to release ownership and version drift.

## [1.4.0] - 2026-07-31

### Added
- Complete the Phase 3 lifecycle handoff by closing the 193-task component plan and marking RD-05 done.
- Pin authentic Crash safety artifacts to resolvable immutable blobs.
- Develop and validate the complete course catalog graph, including routes and evidence.
- Integrate reciprocal curriculum links to various technical hubs.
- Build multiple courses including debugging, application architecture, accessibility, crash safety, and forms.
- Establish the Guide course system with validated curriculum catalog and navigation.
- Add specialist component hubs with live examples for editing surfaces and navigation.

### Changed
- Update all curriculum-wide lab, snippet, trust, and build integrations across various courses.
- Enhance the education framework for multiple specialist and foundational courses.
- Improve documentation for various component behaviors and lifecycle tracking.

### Fixed
- Repair deployable Crash safety artifact links with specification coverage in production audits.
- Address errors in keyboard clipboard behavior and event routing, ensuring correct functionality.
- Correct renderer package commands for npm, Yarn, pnpm, and Bun invocation forms.

### Deprecated
- Mark the phased approach for specific curriculum topics and structures for future revisions.

### Removed
- N/A

### Security
- N/A

## [1.3.0] - 2026-07-28

### Added
- Enable native clipboard by default and install a lazy ordered system clipboard adapter for Application.run.

### Changed
- Preserve explicit opt-out and custom host callbacks during teardown finality.
- Document native host integration, including host callbacks, shortcut ownership, and lifecycle safety.
- Align host integration guidance by documenting the event-loop clipboard as the canonical raw-text source.

### Fixed
- Enforce canonical editor ownership for Editor paste operations, synchronizing clipboard projections across Input, Editor, and host writes.
- Skip wall-clock performance tests to retain deterministic formatter-cache coverage without a large timing workload.

## [1.2.1] - 2026-07-23

## Changed
- Isolated performance budgets from parallel verification, making CI and Turbo timing runs informational while preserving explicit skips.
- Updated architecture and decision documents to reflect recent performance gate changes.

## Added
- Introduced a cross-platform serial performance gate for core, UI, and datagrid.
- Wired the authoritative check into the acceptance criteria for performance budgets.

## [1.1.0] - 2026-07-23

## Added
- Add portable Codex marketplace integration with standalone scaffold, doctor, render, and shared JSVision guidance skills.

## Changed
- Enforce source-impact, API, distribution, and release-version synchronization.
- Stop implying the browser host is installable in documentation.
- Write the Install & packages guide, replacing placeholder with real content and retiring stale reference guides.

## Fixed
- Generate starters that typecheck and guard the templates to prevent errors.
- Give the data-grid guide a title distinct from the component page to ensure unique titles for SEO.
- Run the docs-build gate under js-yaml v5 to avoid import errors.

## [1.0.0] - 2026-07-22

### Added  
- Added three new live showcase apps: effects, calculator, and Game of Life.  
- Added amiga-clock and matrix showcase apps with animations to the Apps section.  
- Introduced JSDoc @example compile guard with a shrink-only allowlist.  

### Changed  
- Restructured the Guide sidebar into five groups and created 19 new guide stub pages.  
- Sorted the Apps sidebar list alphabetically.  
- Widened the documentation layout and uncapped the article column.  
- Rewrote the introduction to include two live examples focused on JSVision for newcomers.  
- Enhanced documentation for the framework-wide clipboard, fixing stale Editor claims.  

### Fixed  
- Restored three spec oracles and corrected misleading comments.  
- Tightened layout-erasure resets to interface specifications, closing potential issues.  
- Hardened the @example guard's cache key and build check to remove latent traps.  
- Increased the test timeout for docs-site to address cold-compiler flakes on Windows.  

### Deprecated  
- No entries.  

### Removed  
- No entries.  

### Security  
- No entries.

## [0.2.0] - 2026-07-12

Changed:
- Upgraded all development and build dependencies while retaining TypeScript at version 5.x to avoid compatibility issues with related tools.

## [0.1.1] - 2026-07-12

Fixed:

- Added `repository` field to private packages for provenance requirements.
- Aligned docs-site version to match the monorepo version 0.1.0.
