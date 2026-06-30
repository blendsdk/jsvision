# Roadmap: jsvision UI

> **Feature-Set**: jsvision UI
> **Status**: In Progress
> **Created**: 2026-06-29
> **Last Updated**: 2026-06-30 (RD-04 executed — Done)
> **Progress**: 4 / 9 done (RD-01 ✅, RD-02 ✅, RD-03 ✅, RD-04 ✅)
> **CodeOps Skills Version**: 2.0.0

The `@jsvision/ui` layer — a reimagined Turbo Vision widget framework on
`@jsvision/core`, using the **disciplined hybrid** model (retained widget tree +
fine-grained signals + `Show`/`For`). Scope and triage: the component map at
[`tui-ui/01-component-map.md`](tui-ui/01-component-map.md). This roadmap is the
successor to the completed foundation feature-set (RD-01…RD-10), which is finished
and archived at [`_archive/foundation/`](_archive/foundation/00-roadmap.md).

RD numbering restarts for this feature-set; these RDs are **not** the archived
foundation RDs of the same number.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Reactive core — `signal`/`computed`/`effect` + `Show`/`For` | [RD-01](../requirements/RD-01-reactive-core.md) | [reactive-core](reactive-core/00-index.md) | Done | ✅ | 2026-06-29 | Phase 0 pillar (XL). UI-independent; every widget property binds to it. **Shipped** in `packages/ui/src/reactive/` — 20 ST (ST-01…ST-20) + impl tests green (55 ui tests), `yarn verify`/`check:deps`/`lint` clean, all public symbols importable from `@jsvision/ui`, every file ≤ 500 lines w/ JSDoc. exec_plan complete (4 phases / 4 commits). |
| RD-02 | Layout engine — cell-native flex `row`/`col` | [RD-02](../requirements/RD-02-layout-engine.md) | [layout-engine](layout-engine/00-index.md) | Done | ✅ | 2026-06-29 | Phase 0 pillar (XL). ADR-008 Accepted; built on the golden-tested `apportion`/`solveTrack` spike. **Complete**: all 4 phases / 18 spec oracles (ST-01…ST-18 ↔ AC-1…AC-18) + impl tests green. `layout(root, viewport) → parent-relative integer rects`: `row`/`col` via one axis abstraction, `fixed`/`fr`/`auto` sizing (`auto` pre-resolved via `naturalSize`), `justify`/`align`/`gap`/`padding`, overflow (extend past edge, `fr`→0), degenerate→zero rects, recursion in each box's local frame. Pure/no-mutation; `check:deps` clean; files ≤ 217 lines. Symbols re-exported from `@jsvision/ui`. |
| RD-03 | View/Group spine + `DrawContext` + theming | [RD-03](../requirements/RD-03-view-group-spine.md) | [view-group-spine](view-group-spine/00-index.md) | Done | ✅ | 2026-06-29 | Phase 0 keystone (XL). Retained `View`/`Group` tree, stateless clipped `DrawContext`, theme-role resolution. Closes the reactive seam (per-view owner scope + `bind` + injectable coalescing scheduler, AR-09/AR-02) and owns the RD-02 reflow pass. Ships the **complete** `View` shape (onEvent stub + visible/disabled/focused); dispatch/focus **logic** deferred → RD-04. 20 AC; AR-30…AR-46. **Planned** ([plan](view-group-spine/00-index.md)): 7 phases / 21 sessions / ~29–41 h; PA-1…PA-8 + 2 additive primitives (RD-01 `runWithOwner`, core `ScreenBuffer.clone()`). **Plan preflighted** ([report](view-group-spine/00-preflight-report.md)): 1 MAJOR + 2 MINOR resolved, 1 OBSERVATION recorded. **Complete** ✅ — executed all 7 phases spec-first (RED→GREEN→impl) across 8 commits. Lands `packages/ui/src/view/` (geometry, types, theme-style, draw-context, view, group, reflow, render-root) + 2 additive primitives (`runWithOwner` on reactive, `ScreenBuffer.clone()` on core) + `demo:view`. 22 spec oracles (ST-01…ST-20 + ST-21/22) + impl tests green (ui 142 unit, +3 e2e); `yarn verify`/`check:deps`/`lint` clean; files ≤ 231 lines. Runtime decisions RT-1…RT-5 recorded. |
| RD-04 | Event loop + focus + modality + commands | [RD-04](../requirements/RD-04-event-loop.md) | [event-loop](event-loop/00-index.md) | Done | ✅ | 2026-06-30 | Phase 0. Host-agnostic dispatch **mechanism** (`EventLoop`/`createEventLoop`): pure `dispatch(event)`, faithful 3-phase (pre/focus/post), per-group `current` focus chain (Tab/click), top-most-first mouse hit-test, typed command layer (registry + key→command keymap), async `execView`/`endModal` modality; drives RD-03's `RenderRoot` one frame per tick. Concrete `Application`/`run()`/shell → RD-05. 20 AC; AR-47…AR-59 (8 user choices + 5 dominant). **RD preflighted** ([report](../requirements/00-preflight-report-RD-04.md)): 3 MAJOR + 4 MINOR + 1 OBSERVATION resolved (all Option A); recorded as AR-60…AR-66. **Planned** ([plan](event-loop/00-index.md)): 5 phases / 15 sessions / ~23–33 h; PA-1…PA-9 (4 user choices) + no cross-package primitive. 20 spec oracles (ST-01…ST-20 ↔ AC-1…AC-20). New `packages/ui/src/event/` (types/dispatch/commands/focus/hit-test/modal/event-loop) + additive `view.ts`/`group.ts` + `demo:events`. **Plan preflighted** ([report](event-loop/00-preflight-report.md)): 2 MAJOR + 3 MINOR + 2 OBSERVATION resolved — single `runTick` shared by every public mutator (PF-001/PA-11), Phase-2 focus-bubble clamped to the modal scope root (PF-002/PA-12), built-in `tab`/`shift+tab`→focus traversal (PF-003/PA-10), + ST-02-wiring/flush-counter/envelope-copy notes; 33 tasks. All `file:line` code claims verified against live source. **Complete** ✅ — executed all 5 phases spec-first (RED→GREEN→impl). Lands `packages/ui/src/event/` (types · dispatch · commands · focus · hit-test · modal · event-loop · index) + additive `view.ts`/`group.ts`/`types.ts` (`focusable`/`preProcess`/`postProcess`, `onEvent(DispatchEvent)`, `Group.current`, contract types) + `demo:events`. 20 spec oracles (ST-01…ST-20) + impl tests green; full gate clean — `yarn verify` (8/8), `test:e2e` (event-demo + core), `check:deps`, `lint`; every `event/` file ≤ 227 lines. The single `runTick` (PA-11), Phase-2 bubble clamp (PA-12), and built-in Tab/Shift-Tab (PA-10) all realized; one runtime fix recorded (a pathological re-entrant impl-test handler caused an infinite cascade — corrected to emit only on key events; the faithful drain-loop has no runaway guard, per design). |
| RD-05 | App shell — Window/Frame/ScrollBar/Desktop/MenuBar/StatusLine | — | — | Backlog | ⬜ | 2026-06-29 | Phase 0 demo target: a blank windowed desktop + menu/status. |
| RD-06 | Essential controls + validators | — | — | Backlog | ⬜ | 2026-06-29 | Phase 1. Text/Label/Button/Input/Check/Radio/ListView/Dialog. Demos: `mmenu`, `palette`, `tvforms`. |
| RD-07 | High-value controls | — | — | Backlog | ⬜ | 2026-06-29 | Phase 2. History/Tree/ComboBox/Tabs/Table/Progress/Surface. Demo: **clone `tvdemo`** (north-star). |
| RD-08 | Editor family | — | — | Backlog | ⬜ | 2026-06-29 | Phase 3 (XL gap-buffer). Editor/Memo/EditWindow/Indicator/Terminal. Demo: `tvedit`. |
| RD-09 | Files package `@jsvision/files` | — | — | Backlog | ⬜ | 2026-06-29 | Phase R. Relocated fs-bound dialogs: FileDialog/FileList/DirList/ChDir. Demo: `tvdir`. |

## Notes

- **2026-06-29** — Roadmap created for the jsvision UI feature-set, seeded from the
  component map ([`tui-ui/01-component-map.md`](tui-ui/01-component-map.md)) and
  ADR-008. No `requirements/RD-*.md` or execution plans exist yet — all rows start in
  Backlog. The foundation feature-set (RD-01…RD-10) is complete and archived at
  `_archive/foundation/`; this is its successor.
- **Pre-work already landed (before formal RDs):** the model decision — **disciplined
  hybrid** (retained tree + signals + `Show`/`For`); **ADR-008 Accepted** (build a
  cell-native layout engine, flex first / grid Tier 2, as a module in `@jsvision/ui`);
  and the **integer apportionment spike** (`apportion`/`solveTrack` + golden test) that
  de-risks RD-02's central premise. `@jsvision/ui` is scaffolded and CI-green.
- **2026-06-29** — **RD-01 (Reactive core) drafted** → stage `RD Drafted`. Requirements
  set re-initialized for this feature-set: the stale foundation `requirements/` scaffolding
  (README, ambiguity-register, _draft) was moved into `_archive/foundation/requirements/`,
  and a fresh set authored at `requirements/` (README + `00-ambiguity-register.md` AR-01…AR-12
  + `RD-01-reactive-core.md`). Four design decisions locked with the user: callable+methods
  signal API, synchronous effects + `batch()`, owner-scope tree + `onCleanup`, key-function `For`.
- **2026-06-29** — **RD-01 preflighted** → stage `RD Preflighted`. Fresh-session audit
  (`requirements/00-preflight-report.md`, iteration 2) surfaced 9 findings (3 MAJOR, 6 MINOR, 0
  CRITICAL) — all under-specification at the edges, none a design flaw. User accepted every
  recommended resolution; applied to RD-01 + new register entries AR-13…AR-18 (error base class
  = `TuiError`, no-owner dev-warn, exception propagation, nested-`batch` outermost flush, `For`
  duplicate-key policy, fixed 1000-iteration runaway limit). Re-scan clean.
- **2026-06-29** — **RD-01 plan created** → stage `Plan Created`. `plans/reactive-core/` written
  (8 docs): ambiguity register (plan decisions PA-1…PA-5 over inherited AR-01…AR-18), index,
  requirements, current-state + target file layout, 3 component specs (reactive-graph, ownership,
  combinators), testing strategy (ST-01…ST-20 ↔ AC-1…AC-20), execution plan (4 phases / 11 sessions,
  spec-first). Three plan-level decisions locked with the user: dev warnings = `console.warn` gated
  `NODE_ENV!=='production'` (PA-1), multi-throw cascade = first rethrown + rest `console.error`
  (PA-2), granular file split (PA-3).
- **2026-06-29** — **reactive-core plan preflighted** → stage `Plan Preflighted`. Fresh-session,
  codebase-grounded audit (`plans/reactive-core/00-preflight-report.md`, iteration 1): all 9 plan
  docs across 13 dimensions; every structural claim verified against the real code (`TuiError` ctor,
  barrel/entry pattern, two-project vitest, `check:deps`, no-`console.*`-in-`src`); scheduler
  propagation walked for glitch-freedom — no correctness defect. 6 findings (0 critical/major; 4
  MINOR + 2 observations), all resolved: ST-15 leak check made behavioral (PF-001), `For` duplicate-key
  output pinned via new **PA-6** (PF-002), `Show` flip driver specified (PF-003), `EqualsOption` export
  reconciled (PF-004), 2 clarity fixes (PF-005/006).
- **2026-06-29** — **RD-01 executed & shipped** → stage `Done` ✅. `exec_plan reactive-core` ran all
  4 phases spec-first (RED→GREEN→impl) across 4 commits: P1 graph foundation (signal/effect/scheduler/
  owner), P2 lazy memoized computeds + glitch-free diamond, P3 Show/For combinators, P4 packaging +
  gate. Lands `packages/ui/src/reactive/` (12 files, ≤ 500 lines each, full JSDoc, zero native deps).
  All 20 specification tests ST-01…ST-20 green + impl tests (55 ui tests total); `yarn verify` /
  `check:deps` / `lint` clean; every public symbol + type importable from `@jsvision/ui`. Two
  scheduler subtleties resolved during exec (recorded in the impl): resolve **all** of a CHECK node's
  sources before running it (glitch-free diamond), and don't mark observers on a computed's first
  compute; the runaway guard relies on a self-writing effect's mid-run re-mark surviving.
- **2026-06-29** — **RD-02 (Layout engine) drafted** → stage `RD Drafted` ✏️. `add_requirement`
  authored `requirements/RD-02-layout-engine.md` on top of ADR-008 + the landed apportionment
  spike. Scope: a pure `layout(LayoutBox tree, viewport) → parent-relative integer rects` pass —
  `row`/`col` flex containers, `fixed`/`fr`/`auto` sizing (`auto` via a `measure()` seam),
  `justify` (start/center/end/space-between), `align` (start/center/end/stretch, default stretch),
  `gap`/`padding`, overflow extends-past-edge (no shrink). 11 decisions locked AR-19…AR-29; grid
  (Tier 2), stack/overlay, and min/max constraints deferred. 18 acceptance criteria.
- **2026-06-29** — **layout-engine plan preflighted** → stage `Plan Preflighted` 🔬. Codebase-grounded
  audit (`plans/layout-engine/00-preflight-report.md`): 1 MAJOR + 4 MINOR + 1 OBSERVATION, all
  resolved by applying recommended fixes — corrected the false "exports already flow to
  `src/index.ts`" claim (layout uses explicit named re-exports, not `export *`), documented the
  acyclic/distinct-instance input precondition RD-02 deferred to planning, specified the `measure`
  `available` value, and clamped justify `free` to ≥ 0 so overflow extends past the far edge for
  any `justify`. Ready for `exec_plan`.
- **2026-06-29** — **RD-02 plan created** → stage `Plan Created` 📋. `plans/layout-engine/` written
  (7 docs): ambiguity register (PA-1…PA-5 over inherited AR-19…AR-29), index, requirements,
  current-state + target layout, 2 component specs (node-model-and-sizing, layout-pass), testing
  strategy (ST-01…ST-18 ↔ AC-1…AC-18), execution plan (4 phases / 11 sessions, spec-first). Builds
  on the `apportion`/`solveTrack` spike unchanged; geometry types defined locally (core exports
  none); CSS-parity defaults confirmed.
- **2026-06-29** — **RD-02 (Layout engine) complete** → stage `Done` ✅. Executed
  `plans/layout-engine/` across all 4 phases (spec-first, RED→GREEN per phase). Added
  `packages/ui/src/layout/{types,measure,layout}.ts` on the unchanged `apportion`/`solveTrack`
  spike: `layout(root, viewport) → Map<LayoutBox, Rect>` of parent-relative integer rects —
  `row`/`col` via a single axis abstraction, `fixed`/`fr`/`auto` sizing (`auto` pre-resolved via
  `naturalSize`), `justify`/`align`/`gap`/`padding`, overflow (extend past edge, `fr`→0),
  degenerate→zero rects, recursion in each box's local frame. 18 spec oracles (ST-01…ST-18 ↔
  AC-1…AC-18) + impl tests green; `yarn verify`/`check:deps`/`lint` clean; all files ≤ 217 lines;
  symbols re-exported from `@jsvision/ui`. Commits `f9a8cae`→ (Phases 1–4).
- **2026-06-29** — **RD-03 (View/Group spine) drafted** → stage `RD Drafted` ✏️.
  `add_requirement` authored `requirements/RD-03-view-group-spine.md` — the Phase-0 keystone
  binding RD-01 + RD-02 into a retained widget tree. 13 decisions locked AR-30…AR-42 (7 user
  choices, 6 dominant): RD-03 ships the **complete** `View`/`Group` shape with an overridable
  `onEvent` stub + `visible`/`disabled`/`focused` state but defers dispatch/focus **logic** to
  RD-04 (AR-30); each `View` owns an RD-01 owner scope + a `bind()` helper that closes the AR-09
  reactive seam (AR-31); a coalescing, **injectable** scheduler closes AR-02's redraw-frame seam
  (AR-32); RD-03 owns the **reflow pass** (view tree → `LayoutBox` → `layout()` → `bounds`), with
  relayout/repaint as distinct dirty-phases (AR-33); bounds-clip + back-to-front paint, occlusion
  deferred (AR-34); one app theme via `ctx.color(role)`, per-subtree override deferred behind a
  seam (AR-35); dynamic children reuse `Show`/`For` with `N=View`, nested scopes ⇒ leak-free
  unmount (AR-36); geometry reuses RD-02's public `Rect`/`Size2D` (AR-37); single shared
  `ScreenBuffer` composition (AR-38); stateless clipped `DrawContext` (AR-39); `View` abstract /
  `Group` concrete, no leaf widgets (AR-40); `visible:false` ⇒ `display:none` (AR-41); `draw()`
  throw ⇒ isolate + log, finish the frame (AR-42). 20 acceptance criteria. README index +
  dependency graph + glossary synced.
- **2026-06-29** — **RD-03 preflighted** → stage `RD Preflighted` 🔎. Codebase-grounded audit
  against the live `@jsvision/core` (render/color/safety) + RD-01/RD-02 surfaces. 6 findings
  (2 MAJOR, 3 MINOR, 1 OBSERVATION); all resolved into the RD + register (new entries AR-43…AR-46),
  report at [`requirements/00-preflight-report.md`](../requirements/00-preflight-report.md).
  Key catches: **PF-001** — RD-01's `createRoot` nests under the *ambient* owner, so
  imperatively-added child scopes don't nest under their parent; resolved by adding a small
  **additive RD-01 `runWithOwner(owner, fn)`** primitive (AR-43), to be the RD-03 plan's first task.
  **PF-002** — `RenderRoot` lacked the required `caps: CapabilityProfile` + previous-buffer that
  core `serialize()` needs (AR-44). Plus `ThemeRoleName = keyof Theme` + role→Style adapter (AR-45),
  relative intra-package geometry import (PF-004), and `bind` repaint/relayout opt-in (AR-46).
- **2026-06-29** — **RD-03 plan created** → stage `Plan Created` 📋. `make_plan` produced
  [`plans/view-group-spine/`](view-group-spine/00-index.md) from RD-03: 9 docs, 7 spec-first
  phases / 21 sessions / ~29–41 h, gate PASSED (PA-1…PA-8 + inherited AR-30…AR-46). Three new
  plan-level decisions beyond the RD/preflight: **PA-1** `runWithOwner` API = Solid-parity
  (`runWithOwner`+`getOwner`+opaque `Owner`, additive on RD-01, doesn't touch `createRoot`);
  **PA-2** `bind` happens in `onMount` (scope exists at add-time; pre-mount bind throws
  `TuiError`); **PA-8 / clone** — partial recompose (AC-7) needs a faithful previous-frame
  snapshot, so the plan adds a second additive primitive **`ScreenBuffer.clone()`** on core
  `render`. Phase 1 builds both primitives first; the spine (geometry → tree → DrawContext →
  reflow → render-root → scheduler → dynamic children) follows; Phase 7 ships `demo:view`.
- **2026-06-29** — **view-group-spine plan preflighted** → stage `Plan Preflighted` 🔬.
  Codebase-grounded audit ([`plans/view-group-spine/00-preflight-report.md`](view-group-spine/00-preflight-report.md)):
  all 10 plan docs across 13 dimensions; every `file:line` claim re-verified against the live code
  (`reactive/owner.ts`/`scheduler.ts`/`for.ts`/`show.ts`, core `buffer.ts`/`serialize.ts`/
  `theme.ts`/`logger.ts`, both barrels, the RD-03 preflight report) — all accurate. 4 findings
  (1 MAJOR, 2 MINOR, 1 OBSERVATION; 0 CRITICAL), all resolved by applying recommended fixes:
  **PF-001** — `Group` had no API to accept a `Show`/`For` producer (`add` takes a `View`, a
  producer is an accessor); added `Group.addDynamic(producer)` wired through the existing
  `runWithOwner`/`mountView` reconcile seam. **PF-002** — corrected the draw-error log call to the
  real `Logger.error(component, msg, fields?)` signature. **PF-003** — disambiguated bare "RD-04"
  (foundation render engine, not jsvision-ui's event loop) in DoD #6. **PF-004** — recorded that
  partial recompose assumes non-overlapping siblings (a constraint RD-05 windows inherit). Plan is
  feasible, spec-first, accurately grounded; ready for `exec_plan`.
- **2026-06-29** — **RD-03 (View/Group spine) complete** → stage `Done` ✅. Executed
  `plans/view-group-spine/` across all 7 phases spec-first (RED→GREEN→impl per phase), 8 commits.
  Phase 1 added the two enabling primitives (`runWithOwner` on RD-01 reactive, `ScreenBuffer.clone()`
  on core render); Phases 2–7 built the spine under `packages/ui/src/view/`: the `View`/`Group`
  retained tree + owner-scope lifecycle, the stateless clipped `DrawContext` + theme-role adapter,
  the RD-02 reflow pass, the render root + compose walker (clip, back-to-front, bg fill, draw-error
  isolation), the coalescing scheduler + partial recompose (repaint/relayout phases), and dynamic
  children (`Group.addDynamic` over `Show`/`For`) + packaging + the runnable `demo:view`. 20 AC
  realized as ST-01…ST-20 (+ ST-21/22 primitives); ui 142 unit tests + 3 e2e green;
  `verify`/`check:deps`/`lint` clean. One latent bug fixed during exec: `View.mount` now `untrack`s
  its scope setup so the wiring-reset `onCleanup` binds to the view's own scope, not an ambient
  reconcile effect (would have leaked dynamic children). Runtime decisions RT-1…RT-5 recorded in the
  plan's `00-ambiguity-register.md`.
- **2026-06-29** — **RD-04 (Event loop + focus + modality + commands) drafted** → stage
  `RD Drafted` ✏️. `add_requirement` authored `requirements/RD-04-event-loop.md` — the
  host-agnostic dispatch **mechanism** that makes the RD-03 spine interactive. 8 design
  decisions locked with the user (AR-47…AR-54): ships the dispatch mechanism (`EventLoop`),
  deferring concrete `Application`/`run()`/shell to RD-05 (AR-47, mirrors the RD-03 boundary);
  per-group `current` focus chain (AR-48); pure injectable `dispatch(event)`, host wiring
  deferred (AR-49); top-most-first mouse hit-testing in RD-04 (AR-50); faithful 3-phase
  pre/focus/post dispatch (AR-51); typed command layer — `CommandEvent` + registry +
  key→command keymap (AR-52); modal stack + `endModal(result)` → `Promise` (AR-53); the loop
  drives `RenderRoot` frames via the injected scheduler (AR-54). 5 dominant decisions recorded
  (AR-55…AR-59): `EventLoop`/`createEventLoop` central object, additive `focusable` predicate,
  Tab/Shift-Tab traversal, `onIdle`-only (broadcast/timers → RD-05), headless `demo:events`
  vehicle. 20 acceptance criteria. README index + dependency graph synced.
- **2026-06-29** — **RD-04 preflighted** → stage `RD Preflighted` 🔎. Codebase-grounded audit
  ([report](../requirements/00-preflight-report-RD-04.md)) against the live `@jsvision/core`
  input/host surfaces + RD-03 `View`/`RenderRoot` seams: 8 findings (3 MAJOR, 4 MINOR, 1 OBS),
  all resolved Option A and applied to RD-04 (recorded AR-60…AR-66). Key corrections: the 3-phase
  `handled` flag can't live on core's **readonly** `InputEvent` → a `DispatchEvent` envelope
  (PF-401); "inject scheduler into the render root" was infeasible (construct-time/private seam) →
  the loop now **builds** the `RenderRoot` (PF-402); the bespoke `'Ctrl-Q'` keymap duplicated/
  conflicted with core's existing `createKeymap` (`'ctrl+q'`) → reuse it (PF-403); 1-based mouse
  coords vs 0-based bounds (PF-404); dispatch-tick batch model (PF-405); `focusable` default-false +
  subtree semantics (PF-406); injectable loop `logger` for AC-19 (PF-407).
- **2026-06-30** — **RD-04 plan created** → stage `Plan Created` 📋. `make_plan` produced
  [`plans/event-loop/`](event-loop/00-index.md): 5 phases / 15 sessions / ~23–33 h, spec-first
  (ST-01…ST-20 ↔ AC-1…AC-20). Zero-Ambiguity Gate passed — 4 user choices (PA-1 keymap **consume**;
  PA-2 additive `preProcess`/`postProcess` booleans; PA-3 unknown command **enabled by default**;
  PA-4 **explicit-only** `endModal`, defaults → RD-05) + 5 dominant (PA-5…PA-9). Builds entirely on
  the existing core + RD-03 surface — **no** cross-package primitive. New `packages/ui/src/event/`
  (types · dispatch · commands · focus · hit-test · modal · event-loop) + additive `view.ts`/
  `group.ts`/`view/types.ts` + `demo:events`.
- **2026-06-30** — **RD-04 plan preflighted** → stage `Plan Preflighted` 🔬. Codebase-grounded audit
  ([report](event-loop/00-preflight-report.md)) verified every `file:line` claim against live source
  (View/Group/RenderRoot/geometry + core events/keymap) and re-derived the deferring-scheduler
  frame-ownership mechanism as sound. **2 MAJOR + 3 MINOR + 2 OBSERVATION**, all resolved: **PF-001**
  — a single internal `runTick` now drives every public mutator (not just `dispatch`/`resize`), so a
  standalone `focusNext`/`emitCommand` paints and `emitCommand` actually drains (**PA-11**);
  **PF-002** — the Phase-2 focused-chain bubble is clamped to the modal scope root so capture can't
  leak to the outer tree (**PA-12**); **PF-003** — built-in `tab`/`shift+tab`→`focusNext`/`focusPrev`
  (consumed; keymap-bound `tab` overrides), user-confirmed (**PA-10**); + ST-02 focus-wiring,
  flush-counter, and `{...ev}` envelope-copy notes (PF-004/006/007); task denominator fixed 30→33
  (PF-005). No CRITICAL; AC↔ST coverage complete 1:1.
- **2026-06-30** — **RD-04 executed** → stage `Done` ✅. All 5 phases run spec-first (RED → GREEN →
  impl) the same way RD-01…RD-03 went. Lands `packages/ui/src/event/` (types · dispatch · commands ·
  focus · hit-test · modal · event-loop · index) + additive `view.ts`/`group.ts`/`view/types.ts`
  (`focusable`/`preProcess`/`postProcess`, `onEvent(DispatchEvent)`, `Group.current`, the
  `CommandEvent`/`AppEvent`/`DispatchEvent` contract types) + `event-demo` (`demo:events`). 20 spec
  oracles (ST-01…ST-20 ↔ AC-1…AC-20) + impl tests green; full gate clean (`yarn verify` 8/8,
  `test:e2e` event-demo + core, `check:deps`, `lint`); every `event/` file ≤ 227 lines, no dead code.
  PA-10/PA-11/PA-12 all realized (built-in Tab, single `runTick`, modal scope clamp); PF-008 onEvent
  spec-oracle adaptation applied. One runtime note: a pathological re-entrant impl-test handler
  caused an infinite command cascade — fixed in the test (emit only on key events); the faithful
  drain-loop has no runaway guard, per the plan design.
- **Recommended next:** **RD-05** (Application / `run()` / app-shell) — wire `createHost` to the
  loop, default Esc/cancel/ok→modal drivers, broadcast + timer queue, and the audible bell seam.
