# Execution Plan: demo-app-flex-port

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-20 14:14
> **Progress**: 20/20 tasks (100%) ✅ COMPLETE
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

> **Phase ref**: `a434912a`
> **Lenses**: api-surface
> **Routing**: complex — the replace→merge delta across 411 call sites

### Step 1.1: Specification tests

**Reference**: [07 §ST-1…ST-4](07-testing-strategy.md) · [03-01 §Delta A/B](03-01-shadow-retirement.md) · AR-6
**Objective**: Pin the re-exported builder's contract before the shadow is touched.

- [x] 1.1.1 [spec-author] Write ST-1, ST-2, ST-3a, ST-3b, ST-4 — `packages/examples/test/story-at.spec.test.ts`. ST-1 uses a bare `Group`; ST-4's host double is an inline literal on `view.host` ✅ (completed: 2026-07-20 13:39)
- [x] 1.1.2 Verify RED: ST-2, ST-3b (merge preservation, both import sites) and ST-4 (reflow) must fail against the current shadows; ST-1 and ST-3a pass. Record which failed ✅ (completed: 2026-07-20 13:39) — **3 failed / 2 passed, exactly as specified.** ST-2 + ST-3b: `expected { position: 'absolute' } to deeply equal { direction: 'col', padding: 1, … }` (both shadows wipe the unnamed props). ST-4: `expected +0 to be 1` (no `markRelayout`). ST-1 + ST-3a green before and after, as intended

### Step 1.2: Audit before migration

**Reference**: [03-01 §The two behavioural deltas](03-01-shadow-retirement.md) · AR-6
**Objective**: Know every site where replace→merge or the added reflow is observable — **before** any code changes.

- [x] 1.2.1 Run audit queries A1–A4 and B1 across all 411 call sites; fill the 03-01 audit table with the surfaced candidates and a per-row verdict ✅ (completed: 2026-07-20 13:47) — A1 **1** · A2 0 · A3 0 · A4 0 · B1 **0**. Table filled in 03-01. B1 empty repo-wide: every `at()` runs in `build(ctx)`, pre-mount, so the added reflow is unobservable. A2's single candidate (`tabs.story.ts:61`) cleared — the `override layout` at `tab-view.ts:138` belongs to internal `TabBody` (:136), not `TabView` (:208)
- [x] 1.2.2 Resolve every ⛔ row via the three-way rule (explicit field write + comment / neutralise before the swap / accept and record the diff). No row left unruled ✅ (completed: 2026-07-20 13:47) — the one ⛔ (`layout.story.ts:31`→`:35`) resolved by rule **(iii) accept as a deliberate fix**, user-ruled; recorded as AR-17 (runtime) and in 03-01
- [x] 1.2.3 If more than a handful of ⛔ rows surface, run the optional per-story buffer sweep described in [07](07-testing-strategy.md) before proceeding. Record the decision either way ✅ (completed: 2026-07-20 13:47) — run anyway despite only 1 ⛔, since the machinery was already built: **234 renders** (49 kitchen-sink + 68 datagrid-showcase stories × 72×16 and 100×30), before vs after. Result: 1 differing line, in the accepted ⛔ story; datagrid-showcase **zero diff** across all 136

### Step 1.3: Retire the exported pair

**Reference**: [03-01 §Proposed Changes](03-01-shadow-retirement.md) · AR-6, AR-11
**Objective**: One `at()` in `@jsvision/examples`; 411 call sites unchanged.

- [x] 1.3.1 Capture pre-conversion baselines: `yarn build`, then serialize the kitchen-sink shell and the datagrid-showcase walkthrough to the scratchpad ✅ (completed: 2026-07-20 13:47) — full-sweep baselines captured to the scratchpad (superset of the two named showcases)
- [x] 1.3.2 Replace the local body with `export { at } from '@jsvision/ui'`; drop the unused `LayoutProps` import — `packages/examples/kitchen-sink/story.ts` ✅ (completed: 2026-07-20 13:47) — body + JSDoc replaced with the re-export; `LayoutProps` dropped from the type import
- [x] 1.3.3 Same — `packages/examples/datagrid-showcase/story.ts` ✅ (completed: 2026-07-20 13:47) — same
- [x] 1.3.4 Verify GREEN (all five ST cases) and re-serialize both showcases; require a zero diff against 1.3.1, or an accepted-and-recorded diff per 1.2.2 ✅ (completed: 2026-07-20 13:47) — all five ST cases green (were 3 red / 2 green). Re-serialized: datagrid-showcase zero diff; kitchen-sink one accepted line per 1.2.2

### Step 1.4: Retire the four local placers

**Reference**: [03-01 §The four local placers](03-01-shadow-retirement.md) · AR-13
**Objective**: No hand-rolled absolute placer or DSL-name-shadowing helper survives in a touched file.

- [x] 1.4.0 Capture pre-conversion baselines for `wizard-demo`, `themes-demo`, `tabs-demo` and the kitchen-sink `wizard` story — **before** any of 1.4.1–1.4.4 edits them ✅ (completed: 2026-07-20 13:54) — all four captured
- [x] 1.4.1 Delete `place()`, adopt `at`; rename the `row` text helper to `fieldRow` — `packages/examples/wizard-demo/main.ts:52,178` ✅ (completed: 2026-07-20 13:54) — 24 call sites; `at` added to the ui import, the now-unused `type View` import dropped
- [x] 1.4.2 Delete the void-returning `place()`, adopt `at` — `packages/examples/themes-demo/main.ts:37` ✅ (completed: 2026-07-20 13:54) — **plan correction**: the helper also did `g.add(view)`, so call sites became `g.add(at(…))`, not a bare `at(…)`. Recorded in 03-01
- [x] 1.4.3 Delete `placed()`, adopt `at(view, x, y, 40, 1)` — `packages/examples/tabs-demo/main.ts:43` ✅ (completed: 2026-07-20 13:54) — 1 call site; `at` added to the ui import
- [x] 1.4.4 Rename the `row` text helper to `fieldRow` — `packages/examples/kitchen-sink/stories/wizard.story.ts:113` ✅ (completed: 2026-07-20 13:54) — 5 uses
- [x] 1.4.5 Zero-diff the four affected demos against 1.4.0; full verify ✅ (completed: 2026-07-20 13:54) — **all four ZERO DIFF** across 528 lines of rendered output (wizard 80 · themes 381 · tabs 67) plus the wizard story at two viewport sizes. Only yarn’s own "Done in Xs" timing lines differed and were excluded

### Step 1.5: Type-check the untypechecked surface

**Reference**: [07 §What the type-checker does and does not cover](07-testing-strategy.md) · [02 §Gap 2](02-current-state.md)
**Objective**: Make AC-1's "411 call sites compile unchanged" a real, executed check rather than an assumption.

- [x] 1.5.1 Run a one-shot `npx tsc --noEmit` with a scratchpad tsconfig extending `packages/examples/tsconfig.json` and adding `kitchen-sink`, `test`, `wizard-demo`, `themes-demo`, `tabs-demo` to `include`. No committed config change. Record the result — in particular that `themes-demo`'s former `place()` void return is not used in an expression position ✅ (completed: 2026-07-20 13:54) — **46 pre-existing errors before, 46 after, 0 introduced** — AC-1 evidenced. The sweep loads 54 kitchen-sink files + the new spec test that the standing build never compiles. The 46 are latent errors in never-typechecked files (`shell.ts` optional-chaining, `.mjs` script imports lacking types, implicit `any` in test callbacks) — untouched by this plan and worth a separate cleanup. First baseline attempt via a git worktree was **invalid** (no `node_modules` there, so it hit the `tsc` placeholder package and reported a bogus 0); redone in-repo by restoring the shadows, measuring, and restoring the re-export

**Deliverables**:
- [ ] `story-at.spec.test.ts` with all five ST cases green
- [ ] 03-01 audit table filled, every row ruled
- [ ] No local `at`/`place`/`placed`/`row` helper left in a file this plan touches
- [ ] The one-shot type-check sweep passes
- [ ] All verification passing

**Verify**: `yarn verify`

### Post-phase quality review

Reviewer + perf auditor dispatched in parallel on the phase diff (`a434912a..HEAD`).

- **perf-auditor: no findings.** Verified the added `invalidateLayout()` is a null check pre-mount
  (`view.ts:215-217`, `host` set only by `mount()`), and that even a mounted burst is harmless
  because `markRelayout()` sets a flag and `scheduleFlush()` self-coalesces
  (`render-root.ts:321-324`) — N calls in a tick collapse to one frame, so the "411 relayouts" shape
  does not exist. The one extra object spread per call measured 0.12 ms across all 411.
- **phase-reviewer: 2 🟡 MINOR, both applied** (spec-test integrity PASS — the only `*.spec.test.*`
  entry in the diff is the added `story-at.spec.test.ts`).
  - **RV-001** (maintainability): the re-export doc block closed with a retrospective note about what
    the retired helper "got wrong" — maintainer-facing framing on the import surface 84 story files
    read, duplicated across two files, and paraphrasing semantics authoritatively specified on `at()`
    itself. It also never reaches a consumer: for `export { at } from '…'` TypeScript resolves hover
    docs from the original declaration. Trimmed to the forward-looking half.
  - **RV-002** (correctness): the oracle's mounted-view case never mounts. Closed with a new
    `story-at.impl.test.ts` rather than by touching the immutable oracle.
- The reviewer independently reproduced the Delta-A sweep and reached the same single site, and
  additionally cleared `ColorPicker` (`color-picker.ts:220` sets `direction:'row'`, which is the
  engine default per `layout/types.ts:213`, so preserving it is inert).
- Two bare replace-style layout writes remain in touched files — `themes-demo/main.ts:63` and
  `kitchen-sink/stories/status-bar.story.ts:47`. They are individual write sites, not the *helpers*
  this plan retires, so they are out of scope here and go on the follow-up issue (task 2.1.2).

---

## Phase 2: Close-out

> **Phase ref**: _(recorded at phase start)_
> **Routing**: trivial

### Step 2.1: Acceptance, sync, ship

**Reference**: [01 §Acceptance Criteria](01-requirements.md)
**Objective**: Every acceptance criterion demonstrated; the register, roadmap, and issues reflect reality.

- [x] 2.1.1 Walk AC-1…AC-9 in [01](01-requirements.md), recording evidence for each. Includes the banned-reference grep over every added comment and the `git diff --name-only` check that no test file was edited ✅ (completed: 2026-07-20 14:12) — all nine evidenced. **AC-1** both files re-export, no shadow body, 0 type errors introduced (46 pre-existing before and after). **AC-2** table filled, 410 ✅ / 1 ⛔ ruled. **AC-3** no placer or field-row helper in any touched file; the remaining repo-wide grep hits triaged into 5 genuine deferred shadows + 6 false positives (a placement-*mode* selector, a `Placed[]` array, `const row = …` data vars, a `placeholders` prefix collision). **AC-4** four demos zero-diff over 528 rendered lines. **AC-5** audit complete + showcases zero-diff + smoke green and unedited. **AC-6** `git diff --name-status` shows only *added* test files. **AC-7** issue #129. **AC-8** `yarn verify` green, `lint:fix` run. **AC-9** banned-reference grep over the added diff: clean
- [x] 2.1.2 File the follow-up issue covering the RD-01 FR-6 maximal (411 `at()` canvases across 84 story files) **and** the three deferred shadows named in [01](01-requirements.md) / AR-16 (`theme-designer` `gallery.ts:32`, `inspector-panel.ts:55`, `keyboard-mouse-playground/main.ts:126`) ✅ (completed: 2026-07-20 14:12) — **#129** — the FR-6 Tier-3 maximal + the five residual name shadows, with the cleared false positives and the 46-pre-existing-type-error warning recorded so the next agent does not re-derive them. Count corrected here: the register said three shadows, the acceptance grep found five
- [x] 2.1.3 `yarn lint:fix`; commit whatever it changes (CLAUDE.md prime directive — no PR-bound push before this) ✅ (completed: 2026-07-20 14:14) — run before each PR-bound push; it rewrapped `wizard-demo` (`at(` is shorter than `place(`) and the four demos were re-diffed after the reformat — still zero
- [x] 2.1.4 Re-sync the feature roadmap and cascade to the portfolio. The re-scope itself was already synced during preflight (this plan's row covers **#114 only**; #110/#111 now point at `canvas-flex-adoption` / PR #127) — this task advances #114 to done and re-checks both roadmap files after the PR is opened. Then comment and close **#114**, referencing the follow-up issue from 2.1.2 and correcting the stale `forms/src/form-dialog.ts:58` entry (AR-12). Open the PR against `feat/dsl-adoptation` ✅ (completed: 2026-07-20 14:14) — roadmaps synced (#114 → ✅ with the executed result); #114 commented and closed with two body corrections; **PR #130** open against `feat/dsl-adoptation`

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
