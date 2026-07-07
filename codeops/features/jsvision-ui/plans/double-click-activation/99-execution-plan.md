# 99 — Execution Plan

> **Feature**: jsvision-ui / double-click-activation · Tracks GH [#39](https://github.com/blendsdk/jsvision/issues/39)
> **CodeOps Skills Version**: 3.3.0
> **Progress**: 3/14 tasks (21%) · **Last Updated**: 2026-07-07 18:51

**Verify command (every phase):** `TUI_SKIP_PERF=1 yarn verify` then `yarn lint` (AR-12).

Spec-first ordering is enforced within each phase: **spec tests → RED → implement → GREEN → impl
tests → verify**. A task is `[x]` only after its verify passes. TV-derived row activation carries the
GATE-1 BEFORE decode (done in [02-current-state.md](02-current-state.md)) + a GATE-2 AFTER task.

## Phase 1 — The multi-click primitive (03-01)

- [x] **1.1** Spec tests (RED): add `event.multiclick.spec.test.ts` with ST-1…ST-4 — loop with
      injected `now`, two/three `down`s, assert `clickCount` increments on same-cell-within-500ms and
      resets on time-elapsed / different-cell. Also ST-2 (propagation to a leaf's `onEvent`). Run;
      confirm RED. ✅ (completed: 2026-07-07 18:47 — 4/4 RED then GREEN)
- [x] **1.2** Implement the primitive: add `DispatchEvent.clickCount` (`view/types.ts`) +
      `EventLoopOptions.now` (`event/types.ts`) + the loop state (`clock`/`lastClickTime`/
      `lastClickCell`/`clickCount`) and the compute-on-mouse-`down` wrap in `event-loop.ts` (per
      03-01). No `@jsvision/core` change. Verify ST-1…ST-4 GREEN. ✅ (completed: 2026-07-07 18:47)
- [x] **1.3** Impl tests + hardening (`event.multiclick.impl.test.ts`): count wraps past 3;
      move/drag/up/wheel/key carry `undefined`; captured-target down still carries the count; `now`
      defaults to `Date.now`. Full verify + lint. ✅ (completed: 2026-07-07 18:51 — 5/5 pass; full verify 1324 ui + all pkgs green, lint clean)

## Phase 2 — Row consumers + TV fidelity (03-02)

- [ ] **2.1** Spec tests (RED): ST-5 (`ListRows`), ST-6 (`GridRows`), ST-7 (`TreeRows` — single text
      click no emit / double-click activate / graph single-click toggle), ST-8 (File dialog
      double-click enter/resolve), ST-9 (`ComboBox` no regression). Bare-widget envelopes set
      `clickCount` directly (AR-14). Run; confirm RED (ST-7's "single text click does not emit" fails
      against today's emit).
- [ ] **2.2** Implement `ListRows` (`list-rows.ts`) + `GridRows` (`grid-rows.ts`): `if (ev.clickCount
      === 2) this.activate(ev)` after the existing focus+select. Verify ST-5/ST-6/ST-8/ST-9 GREEN
      (File dialog + ComboBox cascade automatically).
- [ ] **2.3** Implement `TreeRows` (`tree-rows.ts`): drop the single-click text emit; focus always,
      graph-zone toggles, `clickCount === 2` on text → activate. Update the class JSDoc (`:223`).
      Verify ST-7 GREEN.
- [ ] **2.4** **GATE-2 AFTER-diff**: re-open `tlstview.cpp:271-277` + `toutline.cpp:465-472`, diff
      branch-for-branch against the implemented behavior, record the decode in the `ListRows`/`TreeRows`
      JSDoc + the commit body — **list text path ✅; graph-zone double-click = accepted AR-15 deviation**
      (do not certify a clean match; document the deviation per AR-15).
- [ ] **2.5** Impl tests (`*.impl.test.ts`) for the three consumers: different-cell 2nd click does
      not activate; a 3rd click (`clickCount === 3`) does not re-fire; single-click focus+select
      intact. Full verify + lint.

## Phase 3 — Kitchen-sink + final gate

- [ ] **3.1** Extend the `listview.story.ts` / `data-grid.story.ts` / `tree.story.ts` /
      `file-dialog.story.ts` **blurbs** to mention double-click-to-activate (AR-11). Confirm
      `kitchen-sink.smoke.spec` stays green (mount check).
- [ ] **3.2** Full `TUI_SKIP_PERF=1 yarn verify` + `yarn lint` + `yarn check:deps` across all
      packages (ui/core/files/examples). Confirm zero `@jsvision/core` change (NFR-1). Update this
      plan's progress + the feature roadmap Notes entry.

## Task ledger

| # | Task | Status | Implemented | Verified |
|---|------|--------|-------------|----------|
| 1.1 | Primitive spec tests (RED) | [x] | 2026-07-07 18:47 | 2026-07-07 18:47 |
| 1.2 | Implement `clickCount` + `now` + loop compute | [x] | 2026-07-07 18:47 | 2026-07-07 18:47 |
| 1.3 | Primitive impl tests + hardening | [x] | 2026-07-07 18:47 | 2026-07-07 18:51 |
| 2.1 | Consumer spec tests (RED) | [ ] | | |
| 2.2 | `ListRows` + `GridRows` double-click | [ ] | | |
| 2.3 | `TreeRows` fidelity fix (drop emit + double-click) | [ ] | | |
| 2.4 | GATE-2 AFTER-diff recorded | [ ] | | |
| 2.5 | Consumer impl tests | [ ] | | |
| 3.1 | Kitchen-sink blurbs + smoke | [ ] | | |
| 3.2 | Final full verify + roadmap sync | [ ] | | |

## Notes / risks

- **Exact wrap site (1.2):** `dispatch(event)` (`event-loop.ts:121-125`) — it wraps every `AppEvent`
  in `{ event, handled: false }` and **enqueues it onto `this.queue`** inside `runTick` (`route()`
  drains later, `:264-267`); it does **not** call `this.route` directly. Compute the count there,
  narrowed to `type:'mouse' & kind:'down'`, and carry it on the enqueued envelope (set at construction —
  `clickCount` is `readonly`), not inside `route()` (keeps the accelerator synth-Alt key path clear).
- **Propagation (1.2):** rely on the existing `{ ...ev }` (`dispatch.ts:183`) and `{ ...ev, local }`
  (`hit-test.ts:157/192/208`, the param `ev` bound to `ev2`) spreads; ST-2 guards it. If a spread is
  found to drop the field, that is the defect to fix (not the test).
- **Out of scope:** editor/input local detectors (AR-6) — do not touch their suites.
