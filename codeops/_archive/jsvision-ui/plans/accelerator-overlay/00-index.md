# accelerator-overlay — Plan Index

> **Feature**: jsvision-ui · **Plan**: accelerator-overlay · **CodeOps Skills Version**: 3.3.0
> **Implements**: jsvision-ui/#40 (reliability remainder) + #41 (discoverability) — no RD (AR-6)
> **TV-derived**: no — this is a modern discoverability affordance with no Turbo Vision counterpart
> (TV/DOS had physical Alt key-state; the terminal byte layer does not). The GATE-1/2 drawing gate
> does not apply; the underline emphasis extends TV.
> **Status**: Plan Created · **Last Updated**: 2026-07-07

## Overview

An **F12 "accelerator mode"** for `@jsvision/ui` that solves the two remaining halves of the
"hotkeys feel inconsistent" report:

1. **Discoverability (#41)** — while armed, every reachable `~X~` accelerator in the current dispatch
   scope **lights up** (the hot glyph gains an underline on its existing accent color).
2. **Reliability (#40 remainder)** — while armed, pressing the **bare letter** (no Alt) fires the
   matching accelerator. This is the always-works path on terminals that mangle Alt (Option-as-Meta
   off, VTE menu-grab, tmux lag). Alt still works as the power-user shortcut.

One flag, one state (AR-1): F12 toggles the mode; it both reveals and arms. Sticky until an
accelerator fires, Esc, F12 again, a click, or a non-accelerator key (AR-3).

## Key design (grounded)

- **Arm-to-fire = synth-alt (AR-4/AR-16).** 6 of 7 accelerator handlers already match
  `inner.alt && key === hotkey` (Button/Label/Cluster/MenuBar/TabView). So the router, when armed,
  synthesizes `alt:true` onto the next plain letter and dispatches it normally — every existing
  handler fires as-is, collisions resolve exactly like `Alt+letter`. Intercept sits in `route()`
  after the keymap block (`dispatch.ts:129`), before any view.
- **Reveal = a `revealAccelerators` boolean threaded like `caps` (AR-15/AR-17).** Mirrors the
  `DrawContext.caps` seam (`draw-context.ts:69,190`); each `~X~` drawer adds `Attr.underline` to its
  accent when set. **Zero `@jsvision/core` changes** (underline is `Attr.underline`; the flag is
  UI-owned). Flipping the flag forces a full recompose in `runTick` (AR-14).

## Documents

| Doc | Contents |
|-----|----------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — AR-1…AR-17, all resolved ✅ |
| [01-requirements.md](01-requirements.md) | Requirements, scope (IN/OUT), success criteria |
| [02-current-state.md](02-current-state.md) | The accelerator/dispatch/DrawContext mechanism map |
| [03-01-reveal-overlay.md](03-01-reveal-overlay.md) | Component: the reveal seam + per-widget underline emphasis |
| [03-02-armed-mode.md](03-02-armed-mode.md) | Component: F12 mode + router synth-alt intercept + lifetime |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-1…ST-N spec cases + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases + task checklist (spec-first) |

## Verify

`yarn verify` + `yarn lint` (AR-12).
