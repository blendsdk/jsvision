# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add the browser-safe synchronous internationalization service and typed catalog authoring API.
- Add locale fallback, interpolation, cardinal plurals, selects, number/date formatting, and
  locale-aware comparison.
- Add partial and strict catalog validation, accelerator checks, atomic runtime overlays, and
  bounded value-free diagnostics.

### Security

- Validate and copy untrusted inputs without invoking caller-defined coercion or accessors.
- Reject unsafe terminal text, invalid locale tags, malformed messages, and unsupported formatter
  options at public boundaries.
