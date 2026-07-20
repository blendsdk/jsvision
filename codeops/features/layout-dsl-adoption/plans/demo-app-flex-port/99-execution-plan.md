# Execution Plan: demo-app-flex-port

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-20 (re-scoped after preflight)
> **Progress**: 0/20 tasks (0%)
> **CodeOps Skills Version**: 3.10.0

## Overview

Retire the two shadow `at()` helpers (411 call sites, two lines) and the four local placers /
`row` text-helpers in `@jsvision/examples`. Behaviour-preserving throughout; proof is the
audit table, a before/after zero diff per touched demo, and the existing e2e/smoke suites, which stay
unedited.

**Re-scope note.** Phases for GH #110 (example demos) and GH #111 (theme-designer) were removed after
preflight found that work already implemented in **PR #127** (`feat/canvas-flex-adoption`), since
merged into `feat/dsl-adoptation`.
See AR-15. This plan's six source files are verified disjoint from #127's diff.

**Branch:** from `feat/dsl-adoptation` (after PR #128 merges) or from #128's head. #128 is what makes
the ui `at()` request a reflow — on the base branch it merges but does not call `invalidateLayout()`,
so ST-4 would be unsatisfiable without it. PR opens against `feat/dsl-adoptation`.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Shadow retirement (#114 reachable slice) | 16 |
| 2 | Close-out | 4 |

**Total: 20 tasks across 2 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` — `- [~] 1.1.1 Task ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 Task ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header and Last Updated stamp after EVERY task** — never batch.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Shadow retirement

> **Phase ref**: _(recorded at phase start)_
> **Lenses**: api-surface
> **Routing**: complex — the replace→merge delta across 411 call sites

### Step 1.1: Specification tests

**Reference**: [07 §ST-1…ST-4](07-testing-strategy.md) · [03-01 §Delta A/B](03-01-shadow-retirement.md) · AR-6
**Objective**: Pin the re-exported builder's contract before the shadow is touched.

- [ ] 1.1.1 [spec-author] Write ST-1, ST-2, ST-3a, ST-3b, ST-4 — `packages/examples/test/story-at.spec.test.ts`. ST-1 uses a bare `Group`; ST-4's host double is an inline literal on `view.host`
- [ ] 1.1.2 Verify RED: ST-2, ST-3b (merge preservation, both import sites) and ST-4 (reflow) must fail against the current shadows; ST-1 and ST-3a pass. Record which failed

### Step 1.2: Audit before migration

**Reference**: [03-01 §The two behavioural deltas](03-01-shadow-retirement.md) · AR-6
**Objective**: Know every site where replace→merge or the added reflow is observable — **before** any code changes.

- [ ] 1.2.1 Run audit queries A1–A4 and B1 across all 411 call sites; fill the 03-01 audit table with the surfaced candidates and a per-row verdict
- [ ] 1.2.2 Resolve every ⛔ row via the three-way rule (explicit field write + comment / neutralise before the swap / accept and record the diff). No row left unruled
- [ ] 1.2.3 If more than a handful of ⛔ rows surface, run the optional per-story buffer sweep described in [07](07-testing-strategy.md) before proceeding. Record the decision either way

### Step 1.3: Retire the exported pair

**Reference**: [03-01 §Proposed Changes](03-01-shadow-retirement.md) · AR-6, AR-11
**Objective**: One `at()` in `@jsvision/examples`; 411 call sites unchanged.

- [ ] 1.3.1 Capture pre-conversion baselines: `yarn build`, then serialize the kitchen-sink shell and the datagrid-showcase walkthrough to the scratchpad
- [ ] 1.3.2 Replace the local body with `export { at } from '@jsvision/ui'`; drop the unused `LayoutProps` import — `packages/examples/kitchen-sink/story.ts`
- [ ] 1.3.3 Same — `packages/examples/datagrid-showcase/story.ts`
- [ ] 1.3.4 Verify GREEN (all five ST cases) and re-serialize both showcases; require a zero diff against 1.3.1, or an accepted-and-recorded diff per 1.2.2

### Step 1.4: Retire the four local placers

**Reference**: [03-01 §The four local placers](03-01-shadow-retirement.md) · AR-13
**Objective**: No hand-rolled absolute placer or DSL-name-shadowing helper survives in a touched file.

- [ ] 1.4.0 Capture pre-conversion baselines for `wizard-demo`, `themes-demo`, `tabs-demo` and the kitchen-sink `wizard` story — **before** any of 1.4.1–1.4.4 edits them
- [ ] 1.4.1 Delete `place()`, adopt `at`; rename the `row` text helper to `fieldRow` — `packages/examples/wizard-demo/main.ts:52,178`
- [ ] 1.4.2 Delete the void-returning `place()`, adopt `at` — `packages/examples/themes-demo/main.ts:37`
- [ ] 1.4.3 Delete `placed()`, adopt `at(view, x, y, 40, 1)` — `packages/examples/tabs-demo/main.ts:43`
- [ ] 1.4.4 Rename the `row` text helper to `fieldRow` — `packages/examples/kitchen-sink/stories/wizard.story.ts:113`
- [ ] 1.4.5 Zero-diff the four affected demos against 1.4.0; full verify

### Step 1.5: Type-check the untypechecked surface

**Reference**: [07 §What the type-checker does and does not cover](07-testing-strategy.md) · [02 §Gap 2](02-current-state.md)
**Objective**: Make AC-1's "411 call sites compile unchanged" a real, executed check rather than an assumption.

- [ ] 1.5.1 Run a one-shot `npx tsc --noEmit` with a scratchpad tsconfig extending `packages/examples/tsconfig.json` and adding `kitchen-sink`, `test`, `wizard-demo`, `themes-demo`, `tabs-demo` to `include`. No committed config change. Record the result — in particular that `themes-demo`'s former `place()` void return is not used in an expression position

**Deliverables**:
- [ ] `story-at.spec.test.ts` with all five ST cases green
- [ ] 03-01 audit table filled, every row ruled
- [ ] No local `at`/`place`/`placed`/`row` helper left in a file this plan touches
- [ ] The one-shot type-check sweep passes
- [ ] All verification passing

**Verify**: `yarn verify`

---

## Phase 2: Close-out

> **Phase ref**: _(recorded at phase start)_
> **Routing**: trivial

### Step 2.1: Acceptance, sync, ship

**Reference**: [01 §Acceptance Criteria](01-requirements.md)
**Objective**: Every acceptance criterion demonstrated; the register, roadmap, and issues reflect reality.

- [ ] 2.1.1 Walk AC-1…AC-9 in [01](01-requirements.md), recording evidence for each. Includes the banned-reference grep over every added comment and the `git diff --name-only` check that no test file was edited
- [ ] 2.1.2 File the follow-up issue covering the RD-01 FR-6 maximal (411 `at()` canvases across 84 story files) **and** the three deferred shadows named in [01](01-requirements.md) / AR-16 (`theme-designer` `gallery.ts:32`, `inspector-panel.ts:55`, `keyboard-mouse-playground/main.ts:126`)
- [ ] 2.1.3 `yarn lint:fix`; commit whatever it changes (CLAUDE.md prime directive — no PR-bound push before this)
- [ ] 2.1.4 Re-sync the feature roadmap and cascade to the portfolio. The re-scope itself was already synced during preflight (this plan's row covers **#114 only**; #110/#111 now point at `canvas-flex-adoption` / PR #127) — this task advances #114 to done and re-checks both roadmap files after the PR is opened. Then comment and close **#114**, referencing the follow-up issue from 2.1.2 and correcting the stale `forms/src/form-dialog.ts:58` entry (AR-12). Open the PR against `feat/dsl-adoptation`

**Deliverables**:
- [ ] All nine acceptance criteria evidenced
- [ ] Follow-up issue filed; roadmaps synced with a `canvas-flex-adoption` row; #114 closed; PR open

**Verify**: `yarn verify`

---

## Dependencies

```
PR #128 merged (View.setLayout available → ui at() requests a reflow)
    ↓
Phase 1 — Shadow retirement   ← independently shippable; highest leverage
    ↓
Phase 2 — Close-out
```

Independent of PR #127, which owns #110/#111 and touches no file in this plan.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `yarn verify` green, plus the one-shot type-check sweep
3. ✅ No warnings/errors
4. ✅ No dead code — every retired helper deleted, not orphaned; no unused imports left behind
5. ✅ Security — not applicable: no user input, network, filesystem, or auth path is touched. The
   package is dev-only and zero-runtime-dependency. Recorded as considered, not skipped.
6. ✅ Documentation — no process reference in any added comment
7. ✅ Every touched demo's before/after diff is zero (or explained and accepted)
8. ✅ Zero existing test files edited
9. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
