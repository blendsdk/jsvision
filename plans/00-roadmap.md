# Roadmap: jsvision UI

> **Feature-Set**: jsvision UI
> **Status**: In Progress
> **Created**: 2026-06-29
> **Last Updated**: 2026-06-29 00:35
> **Progress**: 0 / 9 (0%)
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
| RD-01 | Reactive core — `signal`/`computed`/`effect` + `Show`/`For` | [RD-01](../requirements/RD-01-reactive-core.md) | [reactive-core](reactive-core/00-index.md) | Executing | 🔄 | 2026-06-29 | Phase 0 pillar (XL). UI-independent; every widget property binds to it. RD preflighted (AR-13…AR-18); plan = 4 phases / 11 sessions, spec-first, 20 ST↔AC. Plan preflighted ([report](reactive-core/00-preflight-report.md)): 6 findings (4 MINOR, 2 obs), all resolved; new PA-6. **exec_plan in progress** (Phase 1 — graph foundation). |
| RD-02 | Layout engine — cell-native flex `row`/`col` | — | — | Backlog | ⬜ | 2026-06-29 | Phase 0 pillar (XL). ADR-008 Accepted; apportionment core spike **landed** (`packages/ui/src/layout/`) + golden-tested — de-risked. |
| RD-03 | View/Group spine + `DrawContext` + theming | — | — | Backlog | ⬜ | 2026-06-29 | Phase 0. Retained tree, draw composition into parent buffer, named theme roles. |
| RD-04 | Event loop + focus + modality + commands | — | — | Backlog | ⬜ | 2026-06-29 | Phase 0. Async pump, 3-phase dispatch, `await execView`. |
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
- **Recommended next:** `exec_plan` for **reactive-core** (Phase 1A writes the spec tests, RED-first),
  or draft **RD-02 (layout containers)** in parallel — it shares no code with RD-01.
