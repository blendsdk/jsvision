# Changelog

All notable changes to `jsvision` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See the README's "Versioning & stability" section for the public-API contract and
the deprecation policy.

## [Unreleased]

### Added

- **Global clipboard & selection — framework-wide `Ctrl+A`/`C`/`X`/`V` (`@jsvision/ui`).**
  Select-all, copy, cut, and paste now work in every editable widget (`Input`, `Memo`/`Editor`,
  `ComboBox`, `History`, and anything built on them) with no per-widget wiring. The app shell
  installs a default keymap that turns those chords into commands the focused editor consumes; the
  classic `Ctrl+Ins` / `Shift+Ins` / `Shift+Del` aliases are included by default. Copy and cut fill a
  loop-owned in-app buffer **and** the OS clipboard (OSC-52, when the terminal supports it), so text
  copied in one field pastes into another — or between an `Input` and an `Editor`. A new
  `clipboardKeys?: 'modern' | 'classic' | 'both' | 'none'` option on `createApplication` /
  `createEventLoop` (default `'both'`) selects which chord sets are bound — use `'none'` (or
  `'classic'`) to free `Ctrl`-letter keys for an app with its own bindings (e.g. a WordStar-style
  editor). New public exports: `buildKeymap` + the `ClipboardKeys` type, the `Commands.selectAll`
  command, and `Input.hasSelection` (a `Signal<boolean>` an app binds to grey a Cut/Copy item when
  nothing is selected). A `controls/clipboard` kitchen-sink story ships with it.

- **`Switch` — an on/off toggle control (`@jsvision/ui`).** A focusable single-boolean control bound
  two-way to a `Signal<boolean>` (the `Slider` idiom): `new Switch({ value, label?, onLabel?,
offLabel?, disabled? })`. Toggle it with `Space`/`Enter`, a click, or — when `label` marks a `~X~`
  letter — that `Alt`+hotkey from anywhere in the dialog. It draws a bracketed 4-cell track with a
  sliding `●` knob (ASCII `o` fallback), green when on / dim when off, reusing existing theme roles
  (**no new `@jsvision/core` role**). A `controls/switch` kitchen-sink story ships with it.

- **`Tree` marker styles (`@jsvision/ui`).** `TreeOptions` gains `markerStyle?: 'tv' | 'brackets' |
'triangle'` (new public `MarkerStyle` type). The default `'tv'` (`+`/`─`) is **byte-unchanged**;
  `'brackets'` draws `[+]`/`[-]` (pure ASCII, most legible) and `'triangle'` draws `▸`/`▾`, degrading
  to `'brackets'` on a terminal without Unicode. The mouse toggle hit-zone tracks the wider bracket
  graphic automatically.

- **Duplicate-accelerator dev-warning (`@jsvision/ui`).** A new public pure validator
  `findDuplicateAccelerators(chars)` (+ `DuplicateAccelerator` type and the
  `reportDuplicateAccelerators` reporter) flags two widgets that claim the same `~X~` `Alt`+hotkey
  within one focus scope — where only the first is reachable. It runs automatically (development-only,
  silent under `NODE_ENV=production`) over submenu items and menu-bar titles at build time, a
  `Dialog`'s controls on mount (via an additive `View.accelerators()` seam), and a `TabView`'s tab
  strip on mount. `StatusLine` chord collisions remain a documented fast-follow.

- **Theming — a tiered color theme system for `@jsvision/core`.** A layer below the flat 63-role
  `Theme` so a whole coherent theme falls out of a handful of seeds, plus lossless serialization and
  runtime hot-swap. All additive — the flat `Theme` stays the widget contract and `defaultTheme` is
  byte-unchanged. New public `@jsvision/core` exports:
  - **Perceptual color math** — `ramp`, `lighten`, `darken`, `mix` (OKLab; throw on an unresolvable
    `'default'` seed) and `contrastRatio` (WCAG 2.x; `NaN`, never a throw, when a color is
    unresolvable).
  - **The semantic alias tier** — the `ThemeColors` type (16 tokens) plus `createTheme(options)`
    (required `mode` + `accent`, optional neutral/status seeds, alias-level `overrides`, and
    role-level `roleOverrides`) and `rolesFromAliases(colors)` (the canonical 16-alias → 63-role
    expansion). `ThemeOptions` type.
  - **An optional `ThemeRole.attrs` axis** — a per-role text-attribute mask (dim/bold/italic/…),
    passed through `themeRoleToStyle`; absent on every `defaultTheme` role.
  - **Serialization** — `serializeTheme`/`parseTheme` (a versioned `{ version, roles }` envelope,
    field-kind validation, single-printable-cell pattern check, no partial theme, pure `JSON.parse`,
    no filesystem) and `InvalidThemeError`.
  - **13 tree-shakeable presets** — `turboVisionTheme` (= `defaultTheme`), the attribute-driven
    `monochromeTheme`, `slateTheme`, the curated `nordTheme`/`draculaTheme`/`solarizedDarkTheme`/
    `gruvboxDarkTheme`, and six retro-desktop themes: `janusTheme` (early-90s PC), `warpTheme` (OS/2
    Workplace Shell), `solsticeTheme` (Unix CDE/OpenWindows), `platinumTheme` (classic Mac),
    `workbenchTheme` (Amiga Workbench 1.x), and `horizonTheme` (enterprise). The curated palettes now
    override all 16 aliases from each palette's published spec (authentic surfaces/borders/status, not
    a generic ramp); the seed sets live in a tree-shakeable `preset-seeds.ts`.
  - **Runtime hot-swap** (`@jsvision/ui`) — `RenderRoot.setTheme`, `EventLoop.setTheme`, and
    `Application.setTheme` replace the active theme and repaint in one coalesced frame from any call
    site. A live `demo:themes` designer + a kitchen-sink `Theming` story demonstrate it.

- **`Slider` control + the `@jsvision/theme-designer` app.** `@jsvision/ui` gains **`Slider`** — a
  horizontal/vertical value slider (keyboard/mouse/drag/wheel, `onInput`/`onChange`) that shares its
  value↔position math with `ScrollBar` (extracted to an internal shared helper; `ScrollBar` behavior
  is unchanged). `@jsvision/core` gains two derived theme roles `sliderTrack`/`sliderThumb`
  (byte-frozen in `defaultTheme`, attribute-driven in `monochromeTheme`) plus three additive exports
  the app needs — `aliasesFromSeeds`, a re-exported `rgb256`, and the `PRESET_SEEDS` data. A new
  private **`@jsvision/theme-designer`** application authors `@jsvision/core` themes end-to-end: a
  three-pane designer (roles rail · live preview · inspector) with R/G/B sliders + a `#rrggbb` hex
  field + a DOS-16 swatch, live WCAG contrast + color-depth readouts, the 7 presets, and JSON
  import/export via a real file dialog. The inspector edits both a role's **background and
  foreground** (a bg/fg toggle); the **View menu previews the whole theme at a chosen color depth**
  (the live preview is downsampled via the nearest-256/DOS-16 mapping while the exported theme keeps
  its authored truecolor); and the live preview is a **broad, scrollable gallery** — buttons, input,
  check/radio groups, a list + scroll bar, progress/spinner/slider, tabs, a data grid, a tree, and a
  calendar — so most theme roles show a visible change as they are edited. The inspector shows a
  **solid swatch of the exact edited color** directly under the hex field (the true truecolor value,
  not just its DOS-16 approximation in the picker grid), and **selecting a role/alias briefly flashes
  every cell painted in that color** across the live preview, so the widgets it affects stand out
  (implemented as a pure `flashColor` recolor toggled by an injectable timer; the flash is app-wide by
  color, most visible in the preview). It dogfoods `@jsvision/ui`/`@jsvision/files`; piped, it runs a
  narrated headless walkthrough.

- **Declarative layout builders + engine `position:'fill'`.** `@jsvision/ui` gains an
  expression-oriented layer over the view tree so a whole screen composes in one nested
  call instead of imperative `new`/`.add()`/`.layout =` mutations: **`col`**/**`row`**
  flex containers (optional `Flex` props then children), **`grow`**/**`fixed`** size
  shorthands (mutate + return the view for inline chaining), **`spacer`** (a flexible or
  `{ fixed: n }` gap), and a **`stack`** z-overlay with **`place`**/**`centered`**/
  **`topRight`**/**`bottomRight`**/**`topLeft`** placement helpers. New public exports:
  `col`, `row`, `grow`, `fixed`, `spacer`, `stack`, `place`, `centered`, `topRight`,
  `bottomRight`, `topLeft` + the `Flex`/`Placement` types. Fill and centered overlay
  layers re-solve lag-free on resize; corner/edge layers self-correct in one extra frame
  (a change-gated recompute that always converges). Backing this is one additive layout-
  engine change: a new **`position: 'fill'`** mode — a child takes its parent's whole
  content box, overlaps siblings, reserves no flow space, and is excluded from the
  parent's intrinsic size. **All additive and non-breaking** (existing `'flow'`/
  `'absolute'` behavior is unchanged).

- **DX ergonomics — zero-config caps, `onCommand`, and async modal helpers.** Three
  additive, backward-compatible convenience-layer improvements to `@jsvision/ui`:
  - **Zero-config capabilities + single-package imports.** `ApplicationOptions.caps`
    is now optional (`caps?: CapabilityProfile | 'auto'`, default `'auto'`):
    `createApplication({ menuBar })` starts with no capability plumbing —
    `createApplication` resolves the profile once via `resolveCapabilities().profile`
    and threads the concrete profile to the loop and `run()`. An explicit profile is
    still honored verbatim. The `@jsvision/ui` barrel now re-exports the seven
    `@jsvision/core` essentials a UI developer needs so a hello-world app imports from
    one package: `resolveCapabilities`, `resolveCapabilitiesAsync`, `createKeymap`,
    `Attr` (values) and `CapabilityProfile`, `Style`, `Keymap` (types).
  - **First-class command handling.** `EventLoop.onCommand(name, handler)` and the
    forwarding `Application.onCommand(name, handler)` register a handler for a named
    command and return an unsubscribe function — no more hand-rolling an invisible
    `View`. Many handlers may register for one command; all fire (in registration
    order, each isolated in its own try/catch), and a handled command is consumed. The
    framework's own quit is now one internal registration through the same mechanism
    (the bespoke quit sink is gone); the numeric exit code and the open-modal quit
    cascade are preserved. General handlers run in pre-process and stay dormant while a
    modal owns the dispatch scope.
  - **Async modal helpers.** New `messageBox`/`confirm`/`inputBox` over the existing
    `Dialog`, taking the minimal `{ loop, desktop }` host (an `Application` satisfies it
    directly): `messageBox` → `'ok' | 'cancel'`, `confirm` → `boolean`, `inputBox` →
    `string | null` (honoring an optional validator via the dialog's `valid()` gate).
    New public exports: `messageBox`/`confirm`/`inputBox` + `ModalDialogHost`/
    `MessageBoxOptions`/`InputBoxOptions`. The editor's `infoBox`/`confirmBox` now
    delegate to the shared engine (no behavior change; `confirmBox` keeps its
    three-button contract). **All additive and non-breaking.**

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

- **`@jsvision/ui`: a focused editable widget now consumes `Ctrl+C` (and `Ctrl+A`/`X`/`V`).**
  Behavioral change from the global clipboard feature: under the default `clipboardKeys: 'both'`,
  these chords are captured as copy/select-all/cut/paste when an `Input`/`Editor`/etc. holds focus,
  so they no longer fall through to an app-level command or the terminal. An app that needs those
  keys for its own bindings sets `clipboardKeys: 'classic'` (frees the `Ctrl`-letter chords, keeps
  `Ctrl`/`Shift`+`Ins`/`Del`) or `'none'` (frees them all; each widget's own raw `Ctrl+A` select-all
  still works). Unfocused or non-editable views are unaffected.
- **Minimum Node version raised to 22 (`engines.node: ">=22"`).** Node 20 "Iron" reached
  end-of-life on 2026-04-30, so it is dropped from the supported set and the CI matrix (now
  Node 22 + 24 across all three OSes). Supported runtimes are the maintenance LTS (22) and the
  active LTS (24); consumers still on Node 20 should upgrade.
- **`@jsvision/ui`: `RadioGroup`/`CheckGroup` now take an options object.** Breaking
  (pre-1.0, unpublished): `new RadioGroup(labels, value)` → `new RadioGroup({ labels,
value })`, and the same for `CheckGroup`. New exported option types `RadioGroupOptions`
  / `CheckGroupOptions`, matching the sibling `MultiCheckGroup`'s options-object shape.
  No positional overload is kept.
- **`@jsvision/ui`: color callbacks unified to `onInput` (live) / `onChange` (commit).**
  Breaking (pre-1.0): `ColorSwatch`/`ColorPicker` retire `onCommit`. `onChange` now means
  the discrete commit (Enter / Space / mouse-up) framework-wide, and the former live
  `onChange` is renamed `onInput` (fires on every arrow / click / drag) — matching the
  text `Input` convention. `ColorPicker` exposes both and forwards them to its hosted
  swatch (a commit fires the picker's `onChange` and then closes the popup; no callback is
  left unwired).
- **`@jsvision/ui`: `run()` requires an interactive TTY by default.** New
  `ApplicationOptions.requireTty?: boolean` (default `true`): `run()` asserts the terminal
  essentials before taking over the screen and throws `EssentialsNotMetError` when there
  is no interactive terminal at all — a cron/CI job, a container with no tty, or stdin and
  stdout both redirected with no controlling terminal — instead of silently starting a
  keyboard-less app. Piped output backed by a controlling terminal still runs (the host
  binds `/dev/tty`). Pass `requireTty: false` for headless/automated runs that drive the
  loop without a real terminal.
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

- **`createTheme` dark-mode surfaces sit deeper on the ramp.** A generated dark theme took its
  background from the ramp's mid-gray, so it read washed-out and flat. The dark surfaces now sit near
  the ramp floor (background one step up, the input/editor well at the floor) for a genuinely dark
  backdrop with clear raised/sunken separation. Affects generated themes and `slateTheme`; the curated
  presets pin their own surfaces and are unaffected.

- **`monochromeTheme` no longer underlines the whole menu/status bar.** `menuBar` and
  `statusBar` had `underline` as their base attribute, which painted under every fill cell
  and read as a continuous thin line beneath every item. Underline is now reserved for the
  accelerator-letter convention (the `*Shortcut` roles) and the calendar-today marker; the
  bars stand out by their inverted colors and selection still shows via `reverse`.

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
