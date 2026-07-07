# Ambiguity Register — accelerator-overlay

> **Feature**: jsvision-ui / accelerator-overlay · **CodeOps Skills Version**: 3.3.0
> **Status**: ✅ GATE PASSED (all items Resolved, user-confirmed 2026-07-07)
> **Tracks**: GH [#40](https://github.com/blendsdk/jsvision/issues/40) (reliability remainder) + [#41](https://github.com/blendsdk/jsvision/issues/41) (discoverability)

Zero-Ambiguity Gate register. Every design/behavior/scope decision below was presented with grounded
options and decided by the user. `(runtime)` tags mark items surfaced during authoring/execution.

| # | Item | Category | Options considered | Resolution (user decision) | Status |
|---|------|----------|--------------------|----------------------------|--------|
| AR-1 | Mode model | Architecture | (a) single F12 "accelerator mode" = reveal+arm one state; (b) two separate reveal/arm toggles | **(a) single mode** — F12 toggles one state that both lights up hotkeys and arms bare-letter firing | ✅ Resolved |
| AR-2 | Reveal emphasis | UX/visual | underline / reverse / `[ ]` box / brighten-only | **Underline** the existing accent glyph (`Attr.underline`) — no layout shift, no new theme role (box shifts layout; brighten too subtle; reverse noisy) | ✅ Resolved |
| AR-3 | Dismiss / lifetime | Behavior | sticky-until-action vs one-shot next-key | **Sticky** — stays lit until an accelerator fires, Esc, F12 again, a click, or a non-accelerator key | ✅ Resolved |
| AR-4 | Arm-to-fire mechanism + collision | Architecture/Behavior | (a) synth `alt:true` + normal dispatch (reuse handlers, first-in-dispatch-order wins); (b) dedicated registry + focus-cycling | **(a) synth-alt** — behaviorally identical to `Alt+letter`; zero per-widget fire code | ✅ Resolved |
| AR-5 | Reveal/arm scope | Behavior | active dispatch scope (modal-aware) vs whole screen always | **Active dispatch scope** — `scopeRoot()`: a modal `Dialog` ⇒ only its accelerators; else the whole tree (menubar + focused window + status) | ✅ Resolved |
| AR-6 | Tracking (RD vs GH) | Process | new RD-22 vs track GH issues directly | **Track #40 (remainder) + #41 directly**, no new RD (roadmap RD-01…21 are complete); add a follow-up roadmap note | ✅ Resolved |
| AR-7 | Menu-open precedence | Behavior | menu owns plain letters vs arm-mode intercepts them | **Menu owns them** — the open menu's `controller.itemHotkey` already matches bare letters; opening a menu auto-dismisses accelerator mode | ✅ Resolved |
| AR-8 | Disabled / invisible | Behavior | reveal+fire all vs skip disabled/hidden | **Skip** — a disabled or `visible:false` widget's accelerator neither lights up nor fires | ✅ Resolved |
| AR-9 | StatusLine chords | Scope | full parity vs partial | **Reveal shows the `~X~` accent; arm fires only Alt-letter items** (synth-alt cannot match a Ctrl/F-key chord like `Ctrl+Q`/`F1`) — documented limitation | ✅ Resolved |
| AR-10 | Trigger key | Config | hard-coded F12 vs configurable | **F12 default + an option seam** (`revealKey`) to override or disable; F10 is taken by the menu | ✅ Resolved |
| AR-11 | Kitchen-sink story | Deliverable | required (non-negotiable gate) | **A dialog story** (buttons/labels + a menu) whose smoke asserts that arming emphasizes the hot segments | ✅ Resolved |
| AR-12 | Verify command | Process | — | **`yarn verify` + `yarn lint`** (per CLAUDE.md) | ✅ Resolved |
| AR-13 | Kitty/hold-Alt future | Scope | build now vs seam only | **Seam only** — the trigger is designed so real hold-Alt can replace F12 once Kitty/CSI-u (DEF-1, `keys.ts:8-9`) lands; out of scope now | ✅ Resolved |
| AR-14 | Repaint trigger on flag flip | Design (runtime) | Signal subscription vs explicit recompose | **Explicit** — toggling the reveal flag forces a full recompose (`RenderRoot.markRelayout`/`fullCompose`) inside the loop's `runTick`; `revealAccelerators` is a plain re-read field like `caps` (nothing subscribes), so it needs the trigger | ✅ Resolved |
| AR-15 | Core (`@jsvision/core`) surface | Scope (runtime) | new theme role vs none | **Zero core changes** — underline is `Attr.underline` (`render/types.ts:47`, already SGR-encoded `encode.ts:30`); `DrawContext` + the reveal flag are UI-owned (`view/types.ts`) | ✅ Resolved |
| AR-16 | Router intercept location | Architecture (runtime) | router-level vs a preProcess view | **Router-level** — in `route()` after the keymap-consume block (`dispatch.ts:129`), before `ev2` enrichment, so it sees the plain key before **any** view (incl. preProcess MenuBar/TabView); additive optional `RouteContext`/`DispatchEvent` seam mirroring the `ev.emit` pattern (`dispatch.ts:135-145`) | ✅ Resolved |
| AR-17 | Reveal flag ownership | Architecture (runtime) | view-level vs root/loop | **Loop owns the mode flag** (armed on/off); the **RenderRoot holds `revealAccelerators` + `revealScope`** (it calls `composeView`), toggled via `setRevealAccelerators(on, scope)` the loop invokes in `runTick`; threaded to `makeDrawContext` alongside `caps`. Reveal is modal-scoped via an `insideScope` flag in the compose walk (effective = `flag && (revealScope===null \|\| insideScope)`) so it matches the `scopeRoot()`-clamped fire (03-01 "Reveal scoping") | ✅ Resolved |

**Gate status:** every row ✅ Resolved with an explicit user decision; user confirmed the complete
register 2026-07-07. Zero deferred. **✅ GATE PASSED.**
