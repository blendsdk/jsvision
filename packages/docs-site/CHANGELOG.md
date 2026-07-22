# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
