# Changelog

All notable changes to `@blendsdk/tui` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See the README's "Versioning & stability" section for the public-API contract and
the deprecation policy.

## [Unreleased]

## [0.1.0] — 2026-06-28

### Added

- **Foundation of the SDK** — the cross-cutting non-functional baseline plus every
  landed subsystem:
  - Capability detection & auto-config (RD-02) — `resolveCapabilities` /
    `resolveCapabilitiesAsync`, with the real tty-backed `createTerminalQuery` (RD-03).
  - Input decoder (RD-06) — pure byte→event `decode` / `flush` / `createKeymap`.
  - Rendering engine (RD-04) — width-correct `ScreenBuffer`, pure damage-diff
    `serialize`, glyph fallback, `sanitize`, OSC features, `cursor`.
  - Color & styling (RD-05) — depth-aware `encode` / `encodeStyle` downsampling
    truecolor→256→16→mono, DOS-16 `PALETTE`, typed `defaultTheme`.
  - Host & lifecycle (RD-07) — native tty host with guaranteed restore on every
    exit path, behind an injectable `RuntimeAdapter`.
  - Safety (RD-08) — the essentials gate, screen-safe logger, redaction, typed
    `TuiError` model, and the canonical `sanitize` injection boundary.
  - Capability probe & survey harness (RD-03, dev-only) and the four-tier testing
    strategy + acceptance gate (RD-09).
- **Non-functional baseline (RD-10)** — a frame-budget benchmark (`npm run bench`)
  with a 16 ms ceiling test, an esbuild tree-shake check, a detection-budget test,
  NO_COLOR/ASCII-fallback golden tests, this changelog, and the versioning &
  deprecation policy.

[Unreleased]: https://github.com/blendsdk/tui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blendsdk/tui/releases/tag/v0.1.0
