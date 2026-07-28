# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-28

Added:
- Migrate review evidence to schema 2 with 45 digest-bound AI-assisted approvals.
- Implement synchronous translation service for locale-first layered messages.

Changed:
- Complete translated layout guidance documentation.
- Activate package verification for standard build, typecheck, and test processes.

Deprecated:
- None.

Removed:
- None.

Fixed:
- Audit and correct Dutch, Portuguese, and Polish locale defects.
- Restore clean-runner typechecking by relocating unchanged cross-package layout oracle.
- Close secure source review findings by binding Linux file containment to opened handles.

Security:
- Add secure catalog sources with deterministic source orchestration and sanitized diagnostics. 
- Hardening of AbortSignal handling and source loading to ensure security compliance.

## [Unreleased]

### Added

- Add the browser-safe synchronous internationalization service and typed catalog authoring API.
- Add locale fallback, interpolation, cardinal plurals, selects, number/date formatting, and
  locale-aware comparison.
- Add partial and strict catalog validation, accelerator checks, atomic runtime overlays, and
  bounded value-free diagnostics.
- Preserve the upstream BlendSDK MIT attribution in the published
  [third-party notice](THIRD_PARTY_NOTICES.md).

### Security

- Validate and copy untrusted inputs without invoking caller-defined coercion or accessors.
- Reject unsafe terminal text, invalid locale tags, malformed messages, and unsupported formatter
  options at public boundaries.
