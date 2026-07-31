# Changelog

All notable changes to this package will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-07-31

Added:
- Completed migration of flagship lesson with distinct syntax-aware teaching workbenches and capability-specific actions.

Changed:
- Enhanced compact rendering and improved language switching reliability.

## [1.3.0] - 2026-07-28

### Added
- Enable native clipboard by default by installing a lazy ordered system clipboard adapter for Application.run.
- Export a UTF-8-safe bounded paste-text helper from core.
- Add localized diagnostic, degradation, invisible warnings, status, and search projectors.
- Add ten-locale catalogs and isolated I18n injection for the editor/window chrome.
- Handle shared clipboard command events for copy, cut, paste, and select-all.
- Add selection-aware indent and dedent with smart tab stops and auto-indent.
- Implement terminal editor UI with controller-backed commands and styled terminal cells.
- Add bounded live language journeys, host lifecycle controls, and isolated peer editors.
  
### Changed
- Preserve explicit opt-out, custom host callbacks, and teardown finality.
- Merge develop into feature branch; integrate i18n package changes and preserve API catalog coverage.

### Fixed
- Enforce canonical editor ownership ensuring synchronization of visible projections.
- Route host paste through the editor transaction and clipboard pipeline.
- Restore viewport and mouse interaction, maintaining caret and scroll state.
- Harden keyboard navigation for Unicode-aware Ctrl+word progress and smart Tab alignment.
- Make assistance caret-aware by anchoring popups to projected caret geometry.

### Deprecated
- Remove the TextMate fallback, supporting only Lezer grammars for language features. 

### Security
- Centralize runtime limits, degradation, observability, and retained-resource disposal, enhancing overall security guarantees.

## [Unreleased]

### Added

- Initial public package skeleton with isolated JavaScript, TypeScript, PostgreSQL, and Node entry
  points.
- Headless architecture probes for document state, parsing, protocol types, scheduling,
  performance, dependencies, and licenses.
- Terminal-native `CodeEditor` and `CodeEditorWindow` surfaces with line numbers, status,
  selection, search, folding, syntax presentation, diagnostics, completion, and snippets.
- Bounded document lifecycle, JavaScript, TypeScript, PostgreSQL, and plain-language support.
- Transport-neutral Language Server Protocol coordination and optional Node JSON-RPC transport.
- Hybrid dark, light, classic, application-derived, monochrome, and ASCII-safe themes.
- Degradation, observability, hostile-input containment, reference benchmarks, and a standalone
  Code Editor kitchen sink.
- Executable kitchen-sink evidence for simulated protocol requests, host save decisions,
  shared-session editor isolation, terminal profiles, fixture edge cases, and the repository-wide
  representative story.
- Dedicated manual-QA scenarios for completion, hover, signature help, diagnostics, symbols,
  formatting, definition navigation, recovery, and host save outcomes, with F5 invocation,
  expected-result guidance, and capability-specific live evidence.
- A compact single-line frame and terminal-safe drop shadow for completion and assistance popups,
  anchored to the projected caret and clamped or flipped within the current editor viewport.
