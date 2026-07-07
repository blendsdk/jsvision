# Changelog

All notable changes to `jsvision` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See the README's "Versioning & stability" section for the public-API contract and
the deprecation policy.

## [Unreleased]

### Added

- **jsvision-ui RD-15 tree/outline — `Tree<T>`.** `@jsvision/ui` gains a new `tree/`
  subsystem: a focusable, virtual-scrolling **`Tree<T>`** — a faithful Turbo Vision
  `TOutlineViewer`/`TOutline` — that flattens a **forest** of expandable `TreeNode<T>`
  (`{ value, children }`, plain data; the view owns expand state via an object-identity
  `Set` in a version `Signal`) into an ordered row list, virtual-scrolls it (RD-11
  `clampIndex`/`keepVisible` + an owned vertical `ScrollBar`, laid out `[rows fr | bar 1]`
  like `ListView`), and draws each row with **faithful `│├└─`+`+`/`─` tree-line graphics**
  (`toutline.cpp` `graphChars`, `levelWidth`=`endWidth`=3, no brackets) and **two-tone
  collapsed text** (a collapsed node's text in `outlineNotExpanded`, the TV `color >> 8`
  high byte). Navigation: `↑↓`/`PgUp`/`PgDn`/`Home`/`End`/`Ctrl+Pg`/wheel, `+`/`-`/`*`
  expand/collapse/expand-subtree, and **`←`/`→` collapse-or-parent / expand-or-child**
  (a modern override of TV's up/down); a graph-zone click toggles expand while a text
  click (or Enter) selects and emits an optional `command` (no double-click in the input
  model). Also `guides?` (hide the connectors) + `expandAll()`/`collapseAll()`. New public
  exports: `Tree` + `TreeNode`/`TreeOptions`. Additive core surface: four decoded
  `cpOutlineViewer` `Theme` roles (`outlineNormal`/`outlineFocused`/`outlineSelected`/
  `outlineNotExpanded`) — **blue-window** resolved (`0x1E`/`0x71`/`0x1A`/`0x1F`; the
  faithful `TOutlineViewer` host, since the gray-dialog chain degenerates to Normal==Focus).
  Ships a kitchen-sink `Tree` story + a headless `demo:tree`. **All additive and non-breaking.**

- **jsvision-ui RD-14 input dropdowns — `History` + `ComboBox<T>`.** `@jsvision/ui`
  gains a new `dropdown/` subsystem: a faithful Turbo Vision `THistory` (`History`) —
  a `▐↓▌` button linked to an `Input` that drops that field's bounded MRU list into a
  shared anchored popup — and a fresh `ComboBox<T>` selector (no TV counterpart, but
  drawing like its siblings): **editable** (free text + case-insensitive filter, with
  `value` tracking the exact match else `null`) or **select-only** (read-only field +
  type-ahead picker), over a two-signal `value: Signal<T | null>` ⟂ `text: Signal<string>`
  binding. New public exports: `History` + `HistoryOptions`, `ComboBox` +
  `ComboBoxOptions`, the global MRU store functions `historyAdd`/`historyStr`/
  `historyCount`/`historyEntries`/`clearHistory` + `HISTORY_MAX_ENTRIES`, and the
  `PopupHost` seam (so a bare `Dialog` can host a dropdown). Additive Phase-0 seams:
  core gains five decoded `history*` `Theme` roles (`historyButtonSides`/
  `historyButtonArrow`/`historyWindow`/`historyViewer`/`historyViewerFocused`);
  `@jsvision/ui` gains `Input.getValueSignal()`/`getMaxLength()` + public `selectAll()`,
  the `EventLoop.popupHost` + `DispatchEvent.popupHost`/`getFocused` envelope seam, the
  `syncOverlayVisible` helper, and an additive `roles` override on `ListView`/`ListRows`
  (so the History viewer uses the `cpHistoryViewer` palette). The anchored popup casts the
  TV-faithful `shadowSize {2,1}` drop shadow (`THistoryWindow` is a `TWindow`), and its hosted
  list is built inside the popup's own reactive owner (`AnchoredPopupOptions.buildList`) so its
  computeds are disposed with the popup and never leak. **All additive and non-breaking.**

- **RD-13 runtime hardening — additive public surface.** `@jsvision/core` gains
  `KEY_NAMES` (value export) + the `PasteState` type (HR-23), and
  `CapabilityResolution.passthrough?: Uint8Array` so a captured layer-2 query
  passthrough can be re-injected (HR-22). `@jsvision/ui` gains
  `EventLoop.onResize?` + `EventLoopOptions.quitCommand?` (the HR-36/HR-41 resize
  seam + the HR-38 TV-faithful quit-cascade command), and `ScrollBar.pageStep()` is
  now public (HR-53). Backfill of previously-unlogged core `Theme` additions across
  RD-06/RD-10/RD-11 (`staticText`/`label*`/`button*`/`cluster*`/`input*`,
  `statusSelected`, `scrollBar*`/`list*`/`dialog.icon`). **All additive and
  non-breaking.**

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

- **`@jsvision/core`: additive `inputSelection` theme role (RD-07).** `Theme` gains an
  `inputSelection` role (white-on-green, `getColor(3)` in the `TInputLine` palette chain,
  `tinputli.cpp:84`) so the UI layer's `Input` can paint a text selection band distinctly
  from the field. **Additive and non-breaking** — existing `Theme` consumers are unaffected;
  `defaultTheme.inputSelection` is the classic DOS selection colour.

### Changed

- **RD-13: env switches renamed `BLENDTUI_*` → `JSVISION_*`.** The screen-safe
  logger's debug/log env switches are now `JSVISION_DEBUG` / `JSVISION_LOG`
  (was `BLENDTUI_DEBUG` / `BLENDTUI_LOG`), matching the `@jsvision` brand +
  `JSVISION_ASCII` (HR-26). Pre-1.0/unpublished.
- **RD-13: OSC-52 clipboard is now byte-exact base64 (PA-7).** The clipboard write
  no longer runs the payload through the injection `sanitize()` before base64 — it
  encodes the exact UTF-8 bytes (base64 is already injection-safe), so round-tripped
  text is preserved verbatim (HR-21). Updated the ST-8 clipboard oracle.
- **RD-13: `ESC ESC` decodes to Alt+Escape (PA-3), and a track click on a
  `ScrollBar` jumps the thumb to the clicked position** instead of page-stepping
  (TV `tscrlbar.cpp:193-207`, HR-49) — the ST-02 page-step oracle was a mis-decode,
  corrected against the C++. `picture` autoFill is trailing-literal only (HR-55, doc
  correction — no behavior change).

- **`@jsvision/core`: `defaultTheme.inputSelected` corrected to TV-faithful (RD-07).**
  Pre-1.0 (unpublished) fix: `inputSelected` changed from white-on-green (`0x2F`) to
  white-on-blue (`0x1F`) — Turbo Vision draws a focused `TInputLine` identically to an
  unfocused one (`getColor(1) == getColor(2) == 0x1F`, `tinputli.cpp:84,139`); the green was
  a mis-decode of the text-**selection** colour, now carried by the new `inputSelection` role.
  Focus is instead marked by the RD-07 visible caret.
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

### Fixed

- **RD-13 runtime hardening — a 5-agent audit's confirmed backlog (3 critical + 12
  major + ~25 minor), spec-first per HR-NN, TV-derived items behind GATE-1/GATE-2
  decodes.** Highlights:
  - **Critical:** hostile-UTF-8 stdin no longer crashes the decoder (`RangeError`
    DoS, HR-01); modal mouse hit-testing uses the absolute origin so dialogs mounted
    below a `MenuBar` are no longer off-by-one (HR-02); reactive disposal neutralizes
    queued-but-disposed effects (use-after-dispose, HR-03).
  - **Major:** DCS/CSI replies no longer leak as keystrokes (HR-04); C0 control
    chars are kept out of the cell grid (HR-05); the screen-safe logger guards the
    UI stream by device identity (HR-06); a UTF-8 locale enables box/half-block
    glyphs (HR-07); `Commands.close` closes the active window (HR-08); an inactive
    window's close/zoom/grip zones are inert until it is raised (HR-09,
    `tframe.cpp`); removing the focused child re-homes focus (HR-10); `isFocusable`
    requires mounted (HR-11); `flush()` snapshots pending work first (HR-12);
    `addDynamic` disposes its `Show`/`For` on unmount (HR-13); a stale drag gesture
    is cleared on capture loss (HR-14).
  - **Minor (TV fidelity + editor correctness):** host-restart baseline reset,
    combining-mark composition, wide-glyph fallback, comprehensive EAW width table,
    `Input` paste/caret/word-delete/transient-revert/maxLength-clamp/drag-guard, the
    disabled-button hot-run color, `Text` verbatim whitespace, `ScrollBar`
    jump-to-position, the list unfocused highlight + `<empty>` inset + click-clamp,
    and the `Scroller` reserved corner. Each cites the decoded `t*.cpp` `file:line`.

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

[Unreleased]: https://github.com/blendsdk/jsvision/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blendsdk/jsvision/releases/tag/v0.1.0
