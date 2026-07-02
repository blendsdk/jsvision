# Changelog

All notable changes to `jsvision` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See the README's "Versioning & stability" section for the public-API contract and
the deprecation policy.

## [Unreleased]

### Added

- **`@jsvision/core`: probe-driven ASCII-safe chrome (glyph auto-swap).** When the
  startup Cursor-Position-Report probe measures the terminal rendering our
  ambiguous-width chrome glyphs double-width, the host now automatically degrades
  its _effective_ serialize capabilities so every frame emits aligned ASCII chrome
  (`▲▼◄►•↑↕× → ^v<>*^vx`, box → `+-|`, shades → `#`) instead of shearing — with zero
  app-code changes (the `ScreenBuffer` still stores the real Unicode; substitution
  is serialize-time). New additive `HostOptions.adaptAmbiguousWidth` (core default
  `false`; `@jsvision/ui`'s `createApplication`/`run()` default `true`, mirroring
  `warnAmbiguousWidth`). A new host-level **`JSVISION_ASCII`** env switch
  (NO_COLOR-style: presence = on, any value) forces fully ASCII-safe chrome and
  skips the probe. `GlyphCaps` gains `ambiguousWide: boolean` (default `false`);
  new exports `BOX_PROBE_GLYPHS`, `WIDTH_ADAPTED_MESSAGE`, `WidthProbeGroupResult`,
  `degradeCapsForWidth`, `degradeCapsFully`, `isAsciiSafe`. **Additive and
  non-breaking** — the default `ambiguousWide: false` is behavior-neutral.
- **`@jsvision/core`: additive `windowInactive` theme role.** `Theme` gains a
  `windowInactive` role (a sibling of `window` mirroring its `fg`/`bg`/`border`/`title`
  shape) so the UI layer's window frame can theme a background window distinctly from
  the focused one. **Additive and non-breaking** — existing `Theme` consumers are
  unaffected; `defaultTheme.windowInactive` is the classic dimmed (dark-gray) chrome.

### Changed

- **`@jsvision/core`: the ambiguous-width probe now measures two glyph groups.**
  `probeAmbiguousWidth`/`WidthProbeResult` were amended in place (pre-1.0,
  unpublished): the single aggregate measurement became a grouped result
  (`{ probed, arrows, boxes }`, each a `WidthProbeGroupResult`), so arrow/geometric
  chrome and box-drawing/shade flip only the capability flags they implicate.
  `WidthProbeOptions.glyphs` split into `arrowGlyphs?`/`boxGlyphs?`;
  `AMBIGUOUS_PROBE_GLYPHS` is now the 8 arrow/geometric glyphs and a new
  `BOX_PROBE_GLYPHS` covers the box/shade sample. `warnIfAmbiguousWide` keeps its
  signature (its `WidthWarnOptions` gains an `adapted?` message-variant flag).
- **Adopted a dedicated npm scope `@jsvision/*`.** Packages renamed
  `@blendsdk/tui-core` → **`@jsvision/core`** and `@blendsdk/tui-examples` →
  **`@jsvision/examples`** (monorepo root → `@jsvision/monorepo`); the GitHub repo
  moved to `blendsdk/jsvision`. The brand for the SDK is now **jsvision**. This
  supersedes the interim `@blendsdk/tui-core` naming noted below. Package
  directories were renamed to match: `packages/tui-core/` → `packages/core/` and
  `packages/tui-examples/` → `packages/examples/`.
- **Monorepo restructure.** The repository is now a yarn 1.x + Turborepo monorepo.
  The published package was **renamed `@blendsdk/tui` → `@blendsdk/tui-core`** and
  moved to `packages/tui-core/`; the dev examples + probe harness moved to the
  private `@blendsdk/tui-examples` package. All public packages share one lockstep
  version (`yarn sync-versions`).
- **Node floor raised to `>= 20`** (Node 18 is EOL); the CI matrix is now 20/22/24.
- **Test runner migrated `node:test` → vitest** (two projects: `unit` + `e2e`).

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
