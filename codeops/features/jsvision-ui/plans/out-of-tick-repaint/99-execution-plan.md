# Execution Plan: Out-of-tick Repaint (missing-flush bug class)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-12 23:12
> **Progress**: 11/12 tasks (92%)
> **CodeOps Skills Version**: 3.4.1

## Overview

Close the systemic missing-flush bug class (#68) by replacing the event loop's no-op `schedule` seam
with a coalesced out-of-tick painter (Option A, PA-1), plus an explicit `EventLoop.stop()` gate
(PA-3) and an injectable `scheduleMicrotask` seam (PA-2). Spec-first, with painted-frame oracles.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Audit & empirical verification (DoD deliverable) | 2 |
| 2 | Specification tests (red) | 2 |
| 3 | Implement Option A + stop seam | 5 |
| 4 | Impl tests & hardening | 3 |

**Total: 12 tasks across 4 phases** (scope bounded by task-size criteria, not hour estimates)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress; each task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 3.1.2 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 3.1.2 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated** after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Audit & empirical verification

### Step 1.1: Confirm the audit and the pre-fix repros

**Reference**: [02-current-state.md](02-current-state.md) · PA-7, PA-9
**Objective**: Satisfy DoD (a) — the written site classification — and empirically confirm the
out-of-tick staleness before changing anything (so the red phase is meaningful).

- [x] 1.1.1 Verify the 41-site classification in `02-current-state.md` against the current tree (re-grep `invalidate`/`invalidateLayout`; confirm the ⚠️/(b) rows) — `codeops/features/jsvision-ui/plans/out-of-tick-repaint/02-current-state.md` ✅ (completed: 2026-07-12 22:43)
- [x] 1.1.2 Empirically reproduce two out-of-tick staleness cases pre-fix and record the observation in a scratch note: (a) a `runSpinner` frame does not repaint without incidental input; (b) a direct `desktop.cascade()` between ticks does not repaint — `packages/ui` (throwaway probe; do not commit the probe) ✅ (completed: 2026-07-12 22:43)

**Deliverables**:
- [x] Audit doc confirmed accurate
- [x] Both pre-fix repros observed and noted

**Verify**: `yarn workspace @jsvision/ui typecheck` (sanity; no code changed yet)

---

## Phase 2: Specification tests (red)

### Step 2.1: Painted-frame oracles

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) ST-1…ST-6
**Objective**: Encode the six oracles; verify they fail against the current no-op schedule.

- [x] 2.1.1 Write `out-of-tick-repaint.spec.test.ts` covering ST-1…ST-6 (shared harness: injected `scheduleMicrotask` capture + `loop.onFrame` snapshot; assert the PAINTED frame, never a manual `renderRoot.flush()`) — `packages/ui/test/out-of-tick-repaint.spec.test.ts` ✅ (completed: 2026-07-12 22:49)
- [x] 2.1.2 Run the spec suite — verify RED (ST-1…ST-4, ST-6 fail; document if ST-5 passes pre-impl) — `packages/ui` ✅ (completed: 2026-07-12 22:49)

**Deliverables**:
- [x] Spec file written from ST-cases only (no implementation logic read)
- [x] Red phase confirmed and documented — ST-1…ST-4, ST-6 fail on the missing deferred paint (`pending.length` 0); ST-5 passes pre-impl (resize paints synchronously, nothing queued), as anticipated

**Verify**: `yarn workspace @jsvision/ui test` (expect the new spec file RED)

---

## Phase 3: Implement Option A + stop seam

### Step 3.1: Coalesced painter + lifecycle gate

**Reference**: [03-01-coalesced-schedule.md](03-01-coalesced-schedule.md), [03-02-lifecycle-stop-seam.md](03-02-lifecycle-stop-seam.md) · PA-1,PA-2,PA-3,PA-5
**Objective**: Implement the painter and the gate; turn the spec suite green.

- [x] 3.1.1 Add public surface to types: `EventLoopOptions.scheduleMicrotask?` and `EventLoop.stop()` — `packages/ui/src/event/types.ts` ✅ (completed: 2026-07-12 23:02)
- [x] 3.1.2 Implement the painter in `EventLoopImpl`: replace the no-op `schedule` with the coalesced seam; extract `paint()` from the `runTick` tail (reuse at `runTick`, and clear `flushPending` in `resize`); add `flushPending` + `stopped` fields, the `scheduleMicrotask` default, and `stop()` — `packages/ui/src/event/event-loop.ts` ✅ (completed: 2026-07-12 23:02) — **PA-12 runtime correction: `mount()` must NOT clear `flushPending` (its `onMount`-bind re-schedules during the flush, so the mount microtask is the drain that clears the render root's `scheduled` flag)**
- [x] 3.1.3 Wire `ctx.loop.stop()` into `run()`'s `finally` (after `host.stop()`, before nulling the sinks) — `packages/ui/src/app/run.ts` ✅ (completed: 2026-07-12 23:02)
- [x] 3.1.4 JSDoc both new public symbols with a copy-pasteable `@example` (per the project's non-negotiable doc rule); no `codeops/`/RD refs in shipped code — `packages/ui/src/event/{types,event-loop}.ts` ✅ (completed: 2026-07-12 23:02)
- [x] 3.1.5 Run the spec suite — verify GREEN (ST-1…ST-6). If any fails, fix the implementation, never the test — `packages/ui` ✅ (completed: 2026-07-12 23:02)

**Deliverables**:
- [x] Painter + `stop()` implemented; additive-only public surface
- [x] ST-1…ST-6 green

**Verify**: `yarn workspace @jsvision/ui test`

---

## Phase 4: Impl tests & hardening

### Step 4.1: Edge cases + full verify

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) §Implementation Tests
**Objective**: Cover internals/edges and prove no regression across the monorepo.

- [x] 4.1.1 Write `out-of-tick-repaint.impl.test.ts` (bursts across turns; partial vs full recompose out-of-tick; caret cell after a deferred paint; `stop()` idempotent; in-tick `dispatch` before `stop()` still paints; default `queueMicrotask` path via `await Promise.resolve()`) — `packages/ui/test/out-of-tick-repaint.impl.test.ts` ✅ (completed: 2026-07-12 23:12) — 5/5 green
- [x] 4.1.2 Confirm the exact-`onFrame`-count regression tests stay green (`desktop-removewindow-repaint.impl` `toBe(1)`, `app-shell.lifecycle.impl`, `app-shell.seams.spec`) — `packages/ui/test/` ✅ (completed: 2026-07-12 23:12) — 24/24 green
- [~] 4.1.3 Full monorepo verify — `yarn verify` (lint + typecheck + build + test + check:docs) — repo root ⏳ (implemented: 2026-07-12 23:12) — **all #68-related phases green (lint/prettier/eslint on touched files, typecheck, build, ui tests, check:docs). Blocked ONLY by two PRE-EXISTING failures from the v0.2.0 release `[skip ci]` commit (9a3b71a4), unrelated to #68: (1) prettier drift in the 7 generated `CHANGELOG.md` + `RELEASE_NOTES.md`; (2) `@jsvision/core` `packaging.spec` ST-3 rejects the packed `CHANGELOG.md` (npm force-includes it; it is not in the allowlist). Awaiting user decision on scope.**

**Deliverables**:
- [x] Impl suite green (5/5); regression suites green (24/24)
- [~] `yarn verify` green — blocked on pre-existing release-artifact failures (see 4.1.3 note)

**Verify**: `yarn verify`

> **Commit** (owned by the exec_plan skill / the user): commit with `/gitcm` (or `/gitcmp` to push),
> message referencing `closes #68`. No raw git in this plan.

---

## Dependencies

```
Phase 1 (audit + repros)
    ↓
Phase 2 (spec tests, red)
    ↓
Phase 3 (implement, green)
    ↓
Phase 4 (impl tests + full verify)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `yarn verify` passing (full monorepo)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused parameters/fields (the `stopped`/`flushPending` flags are all read)
5. ✅ Security — no new input path; the painter re-runs the existing sanitized pipeline only
6. ✅ Documentation — both new public symbols carry `@example` JSDoc; `check:docs` green; no `codeops/`/RD refs in shipped code
7. ✅ The 3 exact-`onFrame`-count regression tests remain green
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
