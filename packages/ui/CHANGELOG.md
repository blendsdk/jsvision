# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-09-05

## Added
- Introduced a passive GroupBox container with reactive display-cell-aware captions, alignment, padding, theme roles, and optional shadow.

## Changed
- Enhanced documentation with kitchen-sink and template1 labs providing complete component guidance.
- Updated multiple files related to the GroupBox feature, including plans for ambiguity registration, phase reviews, and testing strategy.

## [Unreleased]

### Added

- Add the public passive `GroupBox` container with aligned reactive captions, padding, theme-role styling, and optional standard shadow.

## [1.4.0] - 2026-07-31

Added:
- Built the application shell course, covering shell chrome, body ownership, command routing, lifecycle, and failure diagnosis.
- Introduced two new template1 labs featuring geometry, interaction, restoration, and cleanup evidence.

Changed:
- Aligned statusBase and na in the application code to improve consistency and clarity.

## [1.3.0] - 2026-07-28

## Added
- Enable native clipboard by default with a lazy ordered system clipboard adapter for Application.run.
- Add host-neutral native paste by exposing optional clipboard reader and writer callbacks through the UI application shell.
- Add shared translated button geometry for precise button group measurement and composition.
- Integrate first-party internationalization (i18n) to localize UI components like buttons and modals.

## Changed
- Align host integration guidance for the event-loop clipboard as the canonical raw-text source and document permission requirements.

## Fixed
- Harden bounded paste handling to preserve exact source prefixes for malformed UTF-16 input and manage oversized custom caps.
- Enforce canonical editor ownership to synchronize clipboard operations and maintain visible projections across components.
- Establish a canonical clipboard pipeline to adopt host paste into the clipboard while isolating write failures.

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
