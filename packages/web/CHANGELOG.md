# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-23

Changed: Dropped `@xterm/xterm` optional peer dependency as it was not used in the codebase.  
Changed: Recorded `@jsvision/web` as an internal package in the project structure.

## [1.0.0] - 2026-07-22

Added  
- No entries.

Changed  
- Updated all layout writes in tests to use setLayout for consistency across test files.  
- Simplified the root README and refocused package READMEs to direct users to the documentation site.  
- Upgraded development/build dependencies, while excluding TypeScript to avoid compatibility issues.

Deprecated  
- No entries.

Removed  
- No entries.

Fixed  
- No entries.

Security  
- No entries.

## [0.2.0] - 2026-07-12

Changed:
- Upgraded all development and build dependencies while holding TypeScript at version 5.x to maintain compatibility with type-aware tools.

## [0.1.1] - 2026-07-12

Fixed:

- Added repository field to private packages for provenance to address the lockstep requirement.
