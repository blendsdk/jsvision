# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

## Added
- Added splitter and splitterDragging theme roles for the SplitView component.

## Changed
- Adopted flex layout on demo canvases and retired the DSL name shadows.
- Converted all layout writes in test directories to use setLayout.
- Finished layout conversion outside test directories to comply with new standards.
- Simplified the root README and refocused package READMEs to improve clarity.

## Fixed
- Tied layout-erasure resets to the interface and resolved six findings from the Phase 2 quality review.
- Corrected stale rationale in the panel witness documentation.

## Deprecated
- Retired every local binding that shadowed a layout-DSL binding.

## Chore
- Updated dependencies to latest versions across workspace packages.

## [0.2.0] - 2026-07-12

Changed:
- Upgraded all development and build dependencies while holding TypeScript at version 5.x to maintain compatibility with the type-aware toolchain.

## [0.1.1] - 2026-07-12

Fixed:

- Added repository field to package.json of theme-designer to meet provenance requirements for private packages.
