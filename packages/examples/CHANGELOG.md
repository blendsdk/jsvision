# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-07-31

Changed:
- Improved type checking in the commit attribution checker to declare exports for TypeScript tests.
- Aligned release verification contract with the attribution gate requirements.
- Implemented verification process with yarn verify and updated repository commit hooks.

Fixed:
- Enforced single-author commits through commit-message and pre-push hooks to reject additional authors.
- Enhanced CI and local verification gates to scan reachable history and cover various identity scenarios, including malformed input.

Added:
- New tests to verify commit attribution functionality in various scenarios in the test suite.

## [1.5.0] - 2026-07-31

Added:
- Lightweight local verification to check only staged, unstaged, and untracked files.

Changed:
- Preserved the complete yarn verify command for GitHub Actions.
- Updated README with live-linked screenshots, status badges, and current package catalog.
- Derived documented UI version during every release preparation.

Fixed:
- Synchronized installation guide version to 1.4.0 in the teaching manifest.

## [1.4.0] - 2026-07-31

## Fixed
- Updated the standalone showcase oracle to point at the replacement component hub.  
- Documented the showcase facets and hashed every external artifact read by the examples test.

## Changed
- Modified the `code-editor-demo.spec.test.ts` file to align with Code Editor documentation hub requirements.  
- Updated the `turbo.json` file for improved configuration consistency.

## [1.3.0] - 2026-07-28

### Added
- Enable native clipboard by default with a lazy ordered system clipboard adapter for Application.run.
- Add multilingual QA harness for ten-locale interactive and headless registry across all translated framework packages.
- Showcase modern code editor shortcuts with a dedicated editing scenario and visible shortcut guide.

### Changed
- Split the authoritative gate into workspace preparation and test waves to prevent racing during package dist creation.

### Fixed
- Build workspaces before verification tests to ensure proper setup.
- Serialize native adapter operations to order reads and writes safely for copy and paste operations.
- Enforce canonical editor ownership for clipboard synchronization across components.
- Restore code editor demo window behavior to enable movement and resizing.
- Use terminal size in i18n demo to improve visual representation.
- Isolate code editor performance budgets during CI runs to keep measurements informational.
- Skip wall-clock performance tests in CI for timing-dependent specifications.

## [1.2.1] - 2026-07-23

Added:
- Added a cross-platform serial performance gate for core, UI, and datagrid.

Changed:
- Isolated performance budgets from parallel verification; CI and Turbo timing runs are now informational while preserving explicit skips.
- Aligned preflight oracle with automatic releases; merged master pull requests are the only publishing trigger.

Removed:
- Removed manual-dispatch and dry-run configuration from the release process.

Fixed:
- Verification is now performed with yarn verify for consistency.

## [1.1.0] - 2026-07-23

### Fixed
- Trigger the release workflow after successful merges into master.
- Share version and plugin artifact preparation between release and CI.
- Remove duplicate timed plugin gate to maintain focus in examples suite.
- Normalize generated workspace imports to use stable @jsvision package imports.
- Make API snapshots platform deterministic with explicit lexical ordering.
- Generate starters that typecheck and guard the templates.

### Added
- Add portable Codex marketplace integration with standalone scaffold, doctor, render, and shared JSVision guidance skills.
- Document the Codex plugin and update relevant configuration files.

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
