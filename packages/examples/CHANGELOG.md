# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

### Added
- Added a reactive grab-mark toggle to SplitView, allowing for customizable grab mark behavior.
- Introduced the `split-panes` kitchen-sink story, completing the showcase of this feature.
- Added comprehensive kitchen-sink stories for the `@jsvision/forms` showcasing server-connected forms.
- Added input selection capabilities with `Input.hasSelection` signal and corresponding kitchen-sink story.
- Implemented a `Matrix` digital-rain demo featuring falling green code.
- Enhanced app-linter with `/jsvision-doctor` command to improve developer experience.

### Changed
- Updated documentation to reflect the layout DSL as the default option for screen composition.
- Refactored the layout guidance to promote using col/row/stack DSL over absolute positions.
- Adjusted example demos to consistently utilize the layout DSL.

### Deprecated
- Deprecated the old DSL name shadows in favor of the new layout system.

### Removed
- Removed outdated local placement helpers to streamline the codebase.
- Deleted the throwaway `data-studio` spike package as per project decision.

### Fixed
- Resolved issues with Tab cell-traversal in the datagrid showcase shell.
- Fixed overflow of the aggregate label in master-detail demos to improve UI alignment.

### Security
- No security changes were made in this update.

## [0.2.0] - 2026-07-12

Added:
- A new Matrix digital-rain demo, featuring falling green code with multiple view streams.

Changed:
- Upgraded all development and build dependencies, excluding TypeScript, for compatibility with the toolchain.

## [0.1.1] - 2026-07-12

Fixed:

- Added repository field to private packages to ensure provenance compliance during publishing.
