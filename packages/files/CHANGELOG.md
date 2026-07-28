# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-28

Changed:
- Updated package.json for improved dependency management.  
- Refactored chdir-dialog.ts for better usability and performance.  
- Enhanced error-dialog.ts with additional error handling features.  
- Improved file-dialog.ts layout for a more intuitive user experience.  
- Updated i18n catalog.ts and label.ts for better internationalization support.  
- Added new locale files for Italian and Portuguese (PT) to expand language options.  
- Enhanced file-info-pane.ts to display additional file metadata.  
- Improved openers.ts for better handling of file opener logic.  
- Revised test files for file-info-pane, i18n, and dialog layouts to ensure better coverage and reliability.

## [1.0.0] - 2026-07-22

Changed:
- Converted all test-directory layout writes from `x.layout` to `x.setLayout`, affecting 259 files without changing any test assertions.
- Updated typecheck configurations for additional packages: docs-site, files, theme-designer, web, and forms.
- Modified button strip's border gap assertion to ensure correct layout behavior.
- Guarantied additional edge scenarios in resize oracles to enhance corner case coverage.
- Renamed flex-elimination spec markers to prevent conflicts with other spec identifiers.
- Captured Tab-traversal witnesses for FileDialog, ChDirDialog, and errorBox to ensure expected behavior post-flex architecture changes.
- Simplified root README and focused package READMEs on documentation site to improve clarity.

Removed:
- Deleted the grow-mode reflow machinery as it was no longer in use; removed related grow.ts file.

Fixed:
- Resized the error box to fit its message, preventing text clipping in error dialogs.

## [0.2.0] - 2026-07-12

Changed:
 - Upgraded all development and build dependencies, excluding TypeScript to maintain compatibility with the toolchain.
