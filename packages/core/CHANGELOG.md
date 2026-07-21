# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
