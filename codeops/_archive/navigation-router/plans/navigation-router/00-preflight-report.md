# Preflight Report: Navigation / Screen Router

> **Artifact**: `codeops/features/navigation-router/plans/navigation-router/` (9 docs)
> **Scanned**: 2026-07-15 · git ref bec39b74
> **Status**: ✅ PASSED — all 8 findings resolved (3 MAJOR + 3 MINOR fixed in the plan; 2 OBS handled)
> ⚠️ **SAME-SESSION REVIEW** — the plan was authored this session. Findings are weighted toward
> direct code evidence over authoring rationale; consider a fresh-session re-scan for independence.

## Codebase Context Summary

Verified the substrate citations in `02-current-state.md` against source — **all accurate**:
`application.ts:212` (`new Desktop()`), `:254` (`attachLoop`), `:300` (returned `desktop`);
`statusline.ts:92-97` (attach `isEnabled` wiring), `:161` (seam.emitCommand); `menubar.ts:59-61`
(controller built once at attach); `controller.ts:148` (closes over `tops`); `commands.ts:56-57`
(`enable` sets a Map override, no repaint); `status-item.ts:73-78` (live-label `bind` on mount),
`:119` (isEnabled at draw); `run.ts` content-agnostic; `reactive/{show,for,owner}.ts`,
`modal.ts` save/restore — all confirmed. `Group.add` sets `child.parent = this` (`group.ts:89`);
View is single-parent (`view.ts:144`). `render-root.ts:166` calls `draw()` **bare** (no tracking
scope); reactive repaint is via `view.bind(accessor)` (`view.ts:207-237`).

## Findings

| PF | Sev | Dimension | Summary |
|----|-----|-----------|---------|
| PF-001 | 🟠 MAJOR | Codebase Alignment | Plan says AR-11 touches `@jsvision/core`; the command registry is `@jsvision/ui` (`event/commands.ts`) |
| PF-002 | 🟠 MAJOR | Feasibility | "Bars read the version signal in draw()" won't subscribe — `draw()` isn't tracked; must `bind()` |
| PF-003 | 🟠 MAJOR | Feasibility / Edge | `withBase([...liveBaseViews, extra])` re-parents single-parent Views → corrupts the base bar |
| PF-004 | 🟡 MINOR | Testability | ST-6 mixes a fixed oracle (warm) with a spike-decided one (disposed) — split for spec-first |
| PF-005 | 🟡 MINOR | Completeness | No ST asserts `location()`/`canGoBack()` are *reactive*, only their values |
| PF-006 | 🟡 MINOR | Edge Cases | AR-17 navigate-while-modal-open: a modal's `savedFocus` can point into a disposed screen; untested |
| PF-007 | 🔵 OBS | Consistency | `createRouter` "is both a View and the API" — clarify it's `class Router extends Group` |
| PF-008 | 🔵 OBS | Testability | R-10 (JSDoc/@example) has no ST; covered by the `check:docs` verify gate — acceptable, noted |

### PF-001 🟠 — AR-11 mislabeled as a `@jsvision/core` change
`01-requirements.md` Constraints: *"Changes to `@jsvision/core` (the command registry's reactive
enablement, AR-11) must be additive"*; `03-01` §4 hedges *"(+ `@jsvision/core` re-export if the
registry is core-side)"*. **Verified**: the registry is `packages/ui/src/event/commands.ts`
(`@jsvision/ui`); no core registry exists. The reactive core is UI-internal (`view.ts:14` imports
`signal` from `../reactive/index.js`), so AR-11 is entirely a `@jsvision/ui` change. The hedge could
send an executor to add a needless core re-export, and it misrepresents blast radius for the
published package. **Rec:** correct `01`, `02`, `03-01` to state AR-11 is UI-internal (import `signal`
from `../reactive/index.js`); drop the core-re-export hedge. *Confidence: high — code-verified.*

### PF-002 🟠 — reactive-greying mechanism, as written, reproduces the bug
`03-01` §4: *"`StatusLine` and `MenuBar` read the version signal in `draw()`."* **Verified**:
`render-root.ts:166` calls `view.draw(ctx)` with no tracking scope, so reading a signal in `draw()`
does **not** subscribe — exactly why greying is non-reactive today. The working pattern is
`view.bind(() => version())` in `onMount` (`view.ts:207-237`), as live labels (`status-item.ts:77`)
and `focusSignal` (`view.ts:126`) already do. **Rec:** rewrite §4 to require the bars to `bind()` the
commands-version signal in `onMount`; add an impl note citing the `focusSignal` precedent. ST-5
already asserts the observable behavior, so the oracle stands. *Confidence: high — code-verified.*

### PF-003 🟠 — `withBase` single-parent hazard
`03-03` defines `withBase(base: View[], extra: View[]) => [...base, extra]` with `app.statusBase`
exposing the base items. **Verified**: `Group.add` sets `child.parent = this` (`group.ts:89`) and a
View holds one `parent` (`view.ts:144`). The base items are the live fallback bar's children;
splicing the **same instances** into a screen's status (which `setStatus` then re-parents) corrupts
the base for later fallback and double-parents a View. Menu contributions are `MenuItem` **data**, so
they're safe — status (Views) is the hazard. **Options:** (a) `statusBase` becomes a **factory**
`() => View[]` producing fresh items per compose (Rec); (b) compose from **item specs** (data) and
build Views at swap time; (c) document base+extra as unsupported for status, drop `withBase`.
*Confidence: high — code-verified.*

### PF-004 🟡 — split ST-6
ST-6 fixes warm-screen exact restore (a real up-front oracle) and the disposed-screen tier (decided
by the Phase 0 spike) in one oracle, bending spec-first immutability. **Rec:** ST-6a (fixed: warm
exact restore) + ST-6b (spike-decided: disposed tier). Register AR-19's deferral already covers the
rationale.

### PF-005 🟡 — assert reactivity, not just values
ST-7/ST-8 check `location()`/`canGoBack()` **values**; nothing asserts an `effect` re-runs on
navigation. **Rec:** add a reactivity assertion (an effect reading `location()` fires on `push`/`back`).

### PF-006 🟡 — modal-open navigation edge
AR-17 allows navigation while a modal is open, documented-not-guarded. A modal's `savedFocus`
(`modal.ts`) can reference a screen the navigation disposes → focus-into-disposed on modal close.
**Rec:** add an impl test for the stale-focus case and either a minimal guard or an explicit
documented behavior (`focusView` on an unmounted view is a no-op).

### PF-007 🔵 / PF-008 🔵 — see table. Precision + acknowledged-gap notes; non-blocking.

## Resolutions (applied to the plan 2026-07-15)

| PF | Decision | Edits |
|----|----------|-------|
| PF-001 | AR-11 is `@jsvision/ui`-internal; drop the core-re-export hedge | `01` Constraints; `03-01` §4 + files table + Constraints |
| PF-002 | Bars **`bind()`** the commands-version signal in `onMount` (not read-in-draw) | `03-01` §4 rewritten (cites `focusSignal`/live-label precedent) |
| PF-003 | `app.statusBase` becomes a **factory** `() => View[]` (fresh items); menu base stays data | `03-03` withBase section + note; `03-02` ref; `99` task 2.2.2 |
| PF-004 | Split ST-6 → **ST-6a** (warm, fixed) / **ST-6b** (disposed, spike-decided) | `07` oracle table; `99` tasks 0.1.4, 0.3.1, 0.3.2 |
| PF-005 | Add **ST-18** asserting `location()`/`canGoBack()` reactivity | `07` ST-18; `99` task 1.1.4 |
| PF-006 | Add a **modal-open stale-focus impl test** (Phase 2); `focusView` on an unmounted view is a documented no-op | `99` task 2.3.1 |
| PF-007 | Clarify `createRouter` returns a `Router<Routes>` (a `Group` subclass) | `03-02` |
| PF-008 | Accepted as noted — R-10 is a `check:docs` verify gate, not a behavioral oracle | none |

**Confidence: high — every finding was code-verified (`file:line`).** Hardening: same-session review
counteracted by re-reading all cited source this scan and checking each proposed fix's own feasibility
(PF-002/003 were fixes that would themselves fail); no independent challenger spawned because each
MAJOR rests on a direct code citation rather than judgment. A fresh-session re-scan remains available.

## Adversarial checklist (same-session safeguard)
- Did I verify every code claim, not reason from memory? **Yes** — all citations re-read this scan.
- Did I check the fix's own feasibility, not just the target's? **Yes** — PF-002/003 are fixes that
  would themselves fail; caught by reading `render-root`/`group`/`view`.
- Any finding invented to justify the review? **No** — 3 MAJOR are code-verified; MINORs are real
  discipline/coverage gaps.
