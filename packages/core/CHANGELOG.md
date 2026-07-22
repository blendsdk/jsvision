# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

### Changed
- Let `roleOverrides` patch a single field, aligning with documentation claims.
- Restore README versioning section and allow shipped CHANGELOG in packaging spec.
  
### Fixed
- Stop an explicit undefined `roleOverride` from erasing a generated value.
- Gate `render()` until `start()` completes to prevent premature rendering.
- Release stdin on `stop()` to ensure the process exits after quit.
  
### Added
- Add `splitter` and `splitterDragging` theme roles for enhanced SplitView component.
- Include optional `ctrl`, `alt`, and `shift` modifiers on `MouseEvent`.
- Add `accelerator` and `menuAccelerator` theme aliases to the color role vocabulary.

### Deprecated
- Mark regular `roleOverrides` as deprecated in favor of surgical patching with single roles/fields.

### Removed
- Remove the deprecated `brightWhite` key from PALETTE JSDoc examples.

## [Unreleased]

### Added
- New theme role `gridInvalid` — a solid band marking a data-grid cell whose edit failed validation,
  distinct from the `gridDirty` pending-commit marker. It is additive: every existing theme keeps its
  roles, generated themes derive it from the `danger` seed (`rolesFromAliases`), and `defaultTheme` /
  `monochromeTheme` pin it directly. Themes serialized before this release parse unchanged; a
  hand-built `Theme` literal must add the one new role.
- `MouseEvent` now carries optional `ctrl`/`alt`/`shift` modifier flags, decoded from the SGR button
  byte (the same bits already surfaced on `WheelEvent`). Button/motion events now report held
  modifiers, letting a handler distinguish e.g. a plain click from a Ctrl+click. The fields are
  optional and backward-compatible: existing `type: 'mouse'` literals keep compiling, and a synthetic
  event that omits them reads as an unmodified press.

## [0.2.0] - 2026-07-12

### Fixed
- Released stdin on stop() to ensure the process exits properly after quit.

### Changed
- Upgraded all dependencies except TypeScript to maintain compatibility with the current type-aware toolchain.
