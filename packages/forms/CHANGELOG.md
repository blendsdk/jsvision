# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

Added:
- New `formDialog(host, options): Promise<z.output<S> | null>` for creating modal dialogs.
- Introduced `Form.submitting()` accessor to signal submission state.
- Feature for opt-in per-field async validation with adjustable debounce time.
- Added styled text severity and input placeholder roles for enhanced UI presentation.
- Implemented `Form.load(loader): Promise<boolean>` for async loading with batch rebase.

Changed:
- Updated README and documentation to reflect new public structure, including licensing.
- Refined layout and positioning of the `formDialog` buttons for improved UX.

Fixed:
- Resolved issue of shadowing clicks in the `formDialog` button band by resizing it.
- Stopped flash of validation on cancel button click in `formDialog`.
- Clarified reset hint and rendered the `formDialog` body without zero-width collapse. 

Security:
- Added security test to ensure control-byte values do not leak into the screen buffer.

## [Unreleased]

Added:
 - Initial headless form/field store (`createForm`) with synchronous Zod validation:
   per-field and form-level accessors, dirty tracking, `reset`, and `submit`.
