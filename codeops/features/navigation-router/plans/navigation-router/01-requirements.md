# Requirements: Navigation / Screen Router

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: GitHub issue #26 (no source RD)

## Problem

`@jsvision/ui` today expresses exactly one on-screen shape: the `Desktop` window manager
(overlapping windows). The other dominant TUI shape — **one full-screen view at a time, navigated as
a stack** — has no first-class support. Wizards, installers, drill-down browsers, and full-screen
dashboards must be hand-rolled. This is the highest-leverage remaining `area: primitive` issue.

## In scope (v1)

| # | Requirement | AR |
|---|-------------|----|
| R-1 | A `content?: View` body slot on `createApplication` (default `Desktop`), so any view — including a router — can be the app body. | AR-2 |
| R-2 | `createRouter<Routes>({ initial, routes })` with `push`/`back`/`replace`/`reset`, a back-stack, and typed per-route params. | AR-8, AR-14 |
| R-3 | Per-screen chrome: a route's `build(ctx)` returns `{ view, status?, menu? }`; the router swaps the shared bars on activation (replace-when-present, base fallback). | AR-3, AR-4, AR-21 |
| R-4 | Reactive `location() → { name, params }` and `canGoBack()`; a designed per-route `serialize`/`parse` codec (no `restore()` yet). | AR-9 |
| R-5 | Dispose-on-navigate-away by default; opt-in `keepAlive` keeps a screen warm (state survives a round-trip). | AR-7 |
| R-6 | Focus restore on `back()` — tiered: exact for warm screens, `focusKey`/first-focusable for disposed screens. | AR-19 |
| R-7 | Window-management commands + `app.desktop` auto-gate on content type. | AR-10 |
| R-8 | Command-enablement greying becomes reactive (a repaint on `enable`/`disable`). | AR-11 |
| R-9 | Kitchen-sink stories: a multi-step **wizard** (primary) and a **drill-down browser** (secondary), each with a smoke test. | AR-15 |
| R-10 | Public JSDoc with `@example` on every export; no CodeOps/TV-C++ refs in shipped code; `yarn verify` green. | AR-20 |

## Out of scope (deferred, with owners)

- **Router-hosted windows / multi-Desktop / virtual desktops** → GH #88 (AR-6).
- **`restore(path)`, browser URL sync, full-stack serialization** → GH #19 (AR-9).
- **Reactive whole-set chrome re-swap while active** (AR-5) — static set + reactive enablement/labels cover v1.
- **Keep-alive LRU cap** (AR-18).
- **Screen transitions/animations** — the router exposes an instant swap; animation belongs to GH #28.

## Success criteria (definition of done)

1. Every ST oracle (ST-1…ST-17 in [07](07-testing-strategy.md)) passes; spec-first ordering honored.
2. Phase 0 spike exit criteria met (see [99](99-execution-plan.md)); AR-19 middle tier decided by evidence + encoded as ST-6b (ST-6a = the fixed warm-restore oracle).
3. A router app runs headlessly and on a real TTY; a Desktop app is byte-unchanged (regression).
4. Wizard + drill-down stories mount in the kitchen-sink smoke test.
5. `yarn verify` green; files target 200–500 lines; JSDoc governance (`check:docs`) green.

## Constraints

- `@jsvision/ui` is **zero-runtime-dependency** — typed generics only, no Zod (AR-8).
- The reactive-enablement change (AR-11) is **`@jsvision/ui`-internal** — the command registry lives at
  `packages/ui/src/event/commands.ts` and imports `signal` from `../reactive/index.js`. It touches **no**
  `@jsvision/core` code, must be **additive**, and must keep every existing `@jsvision/ui` test green.
- `Application.desktop` widening to `Desktop | undefined` must not break existing apps that never pass
  `content` (they still get a `Desktop`).
