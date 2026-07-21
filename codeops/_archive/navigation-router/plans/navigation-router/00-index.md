# Plan: Navigation / Screen Router

> **Implements**: navigation-router/GH-#26 (issue-driven; no source RD)
> **Feature**: navigation-router
> **Status**: Plan Created — awaiting preflight
> **CodeOps Skills Version**: 3.8.0

## Overview

A **navigation / screen router** for `@jsvision/ui`: a page/screen stack for full-screen
(non-windowed) apps — `push` / `back` / `replace` / `reset`, a back-stack, typed params, per-screen
chrome, and a reactive `location()`. It complements the `Desktop` window manager (overlapping
windows) with the other dominant TUI shape: **one full-screen view at a time** (wizards, installers,
drill-down browsers, dashboards).

The router is **pure composition** over verified substrate — no renderer, reactive-core, or
event-loop engine changes. The one genuinely new wiring path (a router driving the shared
`MenuBar`/`StatusLine`) and the one behavioral unknown (focus-restore fidelity across a
dispose→recreate) are retired **first**, in a headless Phase 0 de-risking spike, before any stack
logic is built.

## Reference apps (drive the API + demos)

- **Primary — multi-step wizard** (consumes `@jsvision/forms`): the clearest thing the shell can't
  express today; exercises per-screen chrome + reactive "Next greys until valid".
- **Secondary — drill-down browser** (`tig`/`lazygit`/`k9s` shape): list → item → back, exercising
  `keepAlive` (scroll survives back) and params.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — all 21 items ✅ (AR-19 middle tier finalized by the Phase 0 spike) |
| [01-requirements.md](01-requirements.md) | Requirements, scope boundaries, success criteria |
| [02-current-state.md](02-current-state.md) | Verified substrate + the exact seams to add |
| [03-01-application-shell-chromehost.md](03-01-application-shell-chromehost.md) | Body slot (D1), `ChromeHost` seam, command gating (D6), reactive enablement (AR-11) |
| [03-02-router-core.md](03-02-router-core.md) | `createRouter<Routes>`, stack ops, typed params, `location()`, keep-alive, focus |
| [03-03-chrome-contributions.md](03-03-chrome-contributions.md) | The `{view,status?,menu?}` bundle, replace-when-present, `withBase` |
| [07-testing-strategy.md](07-testing-strategy.md) | Spec test oracles ST-1…ST-17 |
| [99-execution-plan.md](99-execution-plan.md) | Phases (Phase 0 spike first), sessions, task checklist |

## Key decisions (see the register for the full set)

- **Body slot** = `createApplication({ content?: View })`, default `Desktop` (AR-2).
- **Chrome** = per-screen `{ view, status?, menu? }` bundle, replace-when-present + `withBase` (AR-3, AR-4).
- **Keep-alive** = dispose by default, opt-in `keepAlive` (AR-7).
- **Params** = generic `createRouter<Routes>`, zero-dep (AR-8).
- **Deep-link** = `location()` now; `restore()`/URL → GH #19 (AR-9).
- **Gating** = auto on content type; `app.desktop: Desktop | undefined` (AR-10).
- **Greying** = reactive command enablement (AR-11).
- **Multi-Desktop** = deferred to GH #88 (AR-6).

## Out of scope (deferred)

- Router-hosted multi-Desktop / virtual desktops → **GH #88**.
- `restore(path)` + browser URL sync + full-stack serialization → **GH #19**.
- Reactive whole-set chrome re-swap while a screen is active (AR-5).
- Keep-alive LRU cap (AR-18).
