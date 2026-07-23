# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-07-23

Added:
- Implemented a cross-platform serial performance gate for core, UI, and datagrid.

Changed:
- Updated CI and Turbo timing runs to be informational while preserving explicit skips.

Fixed:
- Isolated performance budgets from parallel verification for enhanced reliability.

## [1.2.0] - 2026-07-23

Added:
- Added application function-key fallback and normalized Alt number-row aliases before UI routing with a typed opt-out.

Changed:
- Kept direct event loops compatibility-default off and application shells on.
- Preserved numbered-window access through Ctrl+A.

## [1.0.0] - 2026-07-22

### Added
- Make the six silent layout/focus/command footguns self-teaching.
- Add `View.setLayout(patch)` to merge layout writes.
- Adopt flex on the demo canvases and retire the DSL name shadows.
- Promote `wrapText` to the public UI surface for layout calculations.
- Add `stack` placement offsets and an orphaned-tagger dev-warning.
- Add `at()`, `cover()`, and `center()` absolute-placement builders to the DSL.
- Add minimum-size support to the flex track solver.
- Add split-pane container `SplitView` and associated resizing functionality.
- Add global keymap for clipboard operations with copy/cut/select-all functionality.
- Add `Input.hasSelection` signal for tracking selection changes.

### Changed
- Convert all writable-field layout writes in packages/ui/src to `setLayout`.
- Rearrange the layout DSL structure into a cohesive `dsl/` module folder.

### Fixed
- Repair repaint mechanism for scroll bar on range change.
- Fix text wrapping logic to prevent emoji from splitting.
- Repaint the last window closing mechanism properly.
- Correctly restore placeholder caret rendering in inputs.

### Removed
- Retired classic-chord classifier from `Input`.

## [0.2.0] - 2026-07-12

### Fixed
- Repaint now occurs correctly when the last window on the desktop closes, addressing a previously missing loop tick.

### Changed
- Upgraded all development and build dependencies except for TypeScript to maintain compatibility with the current toolchain.
