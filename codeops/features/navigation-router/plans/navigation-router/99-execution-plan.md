# Execution Plan: Navigation / Screen Router

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Progress**: 12/43 tasks (28%)
> **Last Updated**: 2026-07-15 (Phase 0 de-risking spike complete — `yarn verify` green)
> **CodeOps Skills Version**: 3.8.0

## Overview

Build a navigation / screen router for `@jsvision/ui` (GH #26) as pure composition over verified
substrate. **Phase 0 is a mandatory headless de-risking spike** that retires the two real unknowns —
the router↔chrome wiring seam and focus-restore fidelity — before any stack logic is built.
Everything after Phase 0 stands on proven ground. Spec-first ordering throughout; each phase ends
green and is committed (via /gitcm).

> **Sequencing rationale:** the walking skeleton (Phase 0) proves `createApplication` can host
> non-Desktop content, drive the shared bars live, and restore focus — the highest-risk, most-novel
> paths — with the smallest possible surface. If it renders right headlessly, the rest is stack
> bookkeeping.

**🚨 Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Est. Time |
|-------|-------|-----------|
| 0 | De-risking spike (walking skeleton) — body slot, ChromeHost, reactive greying, focus evidence | 3–4 h |
| 1 | Router core — stack ops, typed params, `location()`, error isolation | 3–4 h |
| 2 | Keep-alive + chrome contributions + full focus restore | 2.5–3.5 h |
| 3 | Barrel + JSDoc + demos (wizard, drill-down) + kitchen-sink stories | 2.5–3.5 h |
| 4 | Hardening + full verify + docs governance | 1–2 h |

**Total: ~12–17 hours**

---

## Phase 0: De-risking Spike (walking skeleton)
**Reference**: [03-01](03-01-application-shell-chromehost.md) · AR-2, AR-10, AR-11, AR-19, AR-21

### Session 0.1 — Spec tests (red) ✅
| # | Task | File |
|---|------|------|
| 0.1.1 | `[x]` Write ST-1/ST-2 spec: non-Desktop `content` body + gating + `app.desktop` undefined; Desktop regression | `packages/ui/test/router.shell.spec.test.ts` |
| 0.1.2 | `[x]` Write ST-3/ST-4 spec: `ChromeHost.setStatus`/`setMenu` swap + base-restore (headless render assertions) | `packages/ui/test/router.chromehost.spec.test.ts` |
| 0.1.3 | `[x]` Write ST-5 spec: `enableCommand` toggles status greying live with no other trigger | `packages/ui/test/router.greying.spec.test.ts` |
| 0.1.4 | `[x]` Write ST-6a spec (warm-frame **exact** restore — fixed oracle) + the ST-6b disposed-frame harness for the tier experiment | `packages/ui/test/router.focus.spec.test.ts` |

### Session 0.2 — Implementation (green) ✅
| # | Task | File |
|---|------|------|
| 0.2.1 | `[x]` Generalize `createApplication`: `content?: View` (default `Desktop`), body layout/insert, `attachLoop` only when Desktop | `packages/ui/src/app/application.ts` |
| 0.2.2 | `[x]` Gate window commands + widen `Application.desktop` to `Desktop \| undefined` (via `CreatedApplication<O>` conditional return — AR-22, keeps it additive) | `packages/ui/src/app/application.ts` |
| 0.2.3 | `[x]` `MenuBar.setItems(items)` (retain overlay/seam at attach; rebuild controller) | `packages/ui/src/menu/menubar.ts` |
| 0.2.4 | `[x]` Extract + reuse the `isEnabled` wiring on `StatusLine` swap; add the `ChromeHost` seam + wiring in `createApplication` | `packages/ui/src/status/statusline.ts`, `packages/ui/src/app/application.ts`, `packages/ui/src/router/types.ts` |
| 0.2.5 | `[x]` Reactive command enablement: version-signal bump on enable/disable; bars **`bind()`** it in `attach` (PF-002 — `draw()` is untracked) | `packages/ui/src/event/commands.ts` (+ loop wiring, both bar attaches) |
| 0.2.6 | `[x]` Focus-tier helpers: `focusPath`/`viewAtPath` (exact + index-path) + `firstFocusableLeaf` floor | `packages/ui/src/router/focus.ts` |

### Session 0.3 — Decide + harden ✅
| # | Task | File |
|---|------|------|
| 0.3.1 | `[x]` Ran the ST-6b experiment; **AR-19 middle tier decided = automatic index-path**; finalized ST-6b in `07` + `03-02` §Focus + register AR-19 | `03-02-router-core.md`, `07-testing-strategy.md`, `00-ambiguity-register.md` |
| 0.3.2 | `[x]` ST-1…ST-5 + ST-6a/6b green; `yarn verify` green (full repo regression-clean; plugin API reference regenerated for the 3 additive app-type exports) | — |

**Exit criteria**: non-Desktop content hosts + gates correctly; `ChromeHost` live swap + base-restore proven; greying reactive; focus-restore contract finalized. **Verify**: `yarn verify`; commit via /gitcm.

---

## Phase 1: Router Core
**Reference**: [03-02](03-02-router-core.md) · AR-3, AR-8, AR-9, AR-12, AR-13, AR-14, AR-16

### Session 1.1 — Spec tests (red)
| # | Task | File |
|---|------|------|
| 1.1.1 | Write ST-7/ST-8/ST-9 spec: push/back/replace/reset, `location()`, `canGoBack()`, back-at-root no-op | `packages/ui/test/router.stack.spec.test.ts` |
| 1.1.2 | Write ST-10/ST-11 spec: param flow + typed generic (compile-time `@ts-expect-error`) + structured `initial` | `packages/ui/test/router.params.spec.test.ts` |
| 1.1.3 | Write ST-12/ST-13 spec: `build` throw isolation; `serialize`/`parse` round-trip | `packages/ui/test/router.errors.spec.test.ts`, `packages/ui/test/router.location.spec.test.ts` |
| 1.1.4 | Write ST-18 spec: `location()`/`canGoBack()` **reactivity** — an `effect` re-runs on `push`/`back` | `packages/ui/test/router.location.spec.test.ts` |

### Session 1.2 — Implementation (green)
| # | Task | File |
|---|------|------|
| 1.2.1 | Pure stack model + navigation reducers (view-free) | `packages/ui/src/router/stack.ts` |
| 1.2.2 | Route/bundle/context/location types + `createRouter<Routes>` generic | `packages/ui/src/router/types.ts` |
| 1.2.3 | `createRouter`: the `Group` body swapping the top screen (via `addDynamic`/`Show`), push/back/replace/reset through the loop tick seam | `packages/ui/src/router/router.ts` |
| 1.2.4 | `location()`/`canGoBack()` reactive accessors; per-route `serialize`/`parse` storage; `build` error isolation | `packages/ui/src/router/router.ts` |

### Session 1.3 — Impl tests & hardening
| # | Task | File |
|---|------|------|
| 1.3.1 | Impl tests: empty-stack edges, rapid push/back coalescing, re-entrant-nav note (AR-16) | `packages/ui/test/router.stack.impl.test.ts` |
| 1.3.2 | ST-7…ST-13 green; `yarn verify` green | — |

**Verify**: `yarn verify` green; commit via /gitcm.

---

## Phase 2: Keep-alive + Chrome Contributions + Focus
**Reference**: [03-02](03-02-router-core.md), [03-03](03-03-chrome-contributions.md) · AR-4, AR-5, AR-7, AR-19

### Session 2.1 — Spec tests (red)
| # | Task | File |
|---|------|------|
| 2.1.1 | Write ST-14/ST-15 spec: dispose-on-pop vs `keepAlive` warm-state survival | `packages/ui/test/router.keepalive.spec.test.ts` |
| 2.1.2 | Write ST-16 spec: replace-when-present + base fallback + `withBase` | `packages/ui/test/router.chrome.spec.test.ts` |

### Session 2.2 — Implementation (green)
| # | Task | File |
|---|------|------|
| 2.2.1 | Keep-alive: keyed-`For` + `visible` toggle for warm frames; dispose path for default frames | `packages/ui/src/router/router.ts` |
| 2.2.2 | Chrome apply-on-activation via `ChromeHost` (cache `bundle.status`/`menu` per frame); `withBase` helper + `app.statusBase(): View[]` **factory** (fresh items — PF-003) + `app.menuBase(): MenuItem[]` | `packages/ui/src/router/router.ts`, `packages/ui/src/router/chrome.ts`, `packages/ui/src/app/application.ts` |
| 2.2.3 | Full focus restore per the finalized AR-19 tiers (exact / `focusKey` / floor) | `packages/ui/src/router/focus.ts` |

### Session 2.3 — Impl tests & hardening
| # | Task | File |
|---|------|------|
| 2.3.1 | Impl tests: warm chrome re-apply, disposed-frame focus floor, **modal-open stale-focus test (PF-006)** — navigating while a modal is open must not focus into a disposed screen on modal close (`focusView` on an unmounted view is a documented no-op) | `packages/ui/test/router.keepalive.impl.test.ts` |
| 2.3.2 | ST-14…ST-16 green; `yarn verify` green | — |

**Verify**: `yarn verify` green; commit via /gitcm.

---

## Phase 3: Barrel + JSDoc + Demos + Stories
**Reference**: [01](01-requirements.md) R-9, R-10 · AR-15

### Session 3.1 — Spec tests (red)
| # | Task | File |
|---|------|------|
| 3.1.1 | Write ST-17 smoke additions: wizard + drill-down stories mount, paint, unique id + metadata | `packages/examples/test/kitchen-sink.smoke.spec.test.ts` |
| 3.1.2 | Write the router walkthrough e2e (headless ASCII render of a push/back flow) | `packages/examples/test/router-demo.e2e.test.ts` |

### Session 3.2 — Implementation (green)
| # | Task | File |
|---|------|------|
| 3.2.1 | `router/index.ts` barrel; EXPLICIT named re-exports from `src/index.ts` (createRouter, withBase, types) | `packages/ui/src/router/index.ts`, `packages/ui/src/index.ts` |
| 3.2.2 | Public JSDoc + `@example` on every export; no CodeOps/TV-C++ refs (check:docs green) | `packages/ui/src/router/*.ts` |
| 3.2.3 | Multi-step **wizard** demo (consumes `@jsvision/forms`) + kitchen-sink story | `packages/examples/router-demo/`, `packages/examples/kitchen-sink/stories/wizard.story.ts`, `stories/index.ts` |
| 3.2.4 | **Drill-down browser** demo + kitchen-sink story (keepAlive list) | `packages/examples/kitchen-sink/stories/drill-down.story.ts`, `stories/index.ts` |

### Session 3.3 — Impl tests & hardening
| # | Task | File |
|---|------|------|
| 3.3.1 | ST-17 + router-demo.e2e green; stories pass the smoke gate | — |
| 3.3.2 | `yarn verify` green | — |

**Verify**: `yarn verify` + `yarn workspace @jsvision/examples demo:kitchen` (smoke) green; commit via /gitcm.

---

## Phase 4: Hardening + Docs Governance
**Reference**: [01](01-requirements.md) R-10 · AR-20

| # | Task | File |
|---|------|------|
| 4.1 | Line-count audit (all router + touched files ≤500; split if needed) | `packages/ui/src/router/*`, `app/application.ts` |
| 4.2 | Confirm additive-only: full `@jsvision/core` + `@jsvision/ui` suites green; ST-2 Desktop path unchanged | — |
| 4.3 | `check:docs` (JSDoc governance) + `check:deps` (no native dep) green | — |
| 4.4 | Update CLAUDE.md Project structure with the `packages/ui/src/router/` line + the `content`/`ChromeHost` shell additions | `CLAUDE.md` |
| 4.5 | Prime directive: `yarn lint:fix` before the PR push; commit any changes | — |
| 4.6 | Full `yarn verify` + `yarn gate` green | — |

**Verify**: `yarn verify && yarn gate` green; commit via /gitcm.

---

## Deferred (tracked elsewhere — do NOT implement here)

- Router-hosted multi-Desktop / virtual desktops → **GH #88** (AR-6).
- `restore(path)` + browser URL sync + full-stack serialization → **GH #19** (AR-9).
- Reactive whole-set chrome re-swap while active (AR-5); keep-alive LRU cap (AR-18); transitions → **GH #28**.
