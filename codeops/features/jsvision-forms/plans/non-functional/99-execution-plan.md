# Execution Plan: Non-Functional (RD-04)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-15 14:47
> **Progress**: 10/15 tasks (67%)
> **CodeOps Skills Version**: 3.7.0

## Overview

Close the remaining RD-04 acceptance criteria: ship the NON-NEGOTIABLE kitchen-sink `forms/*` story,
add the render-path security oracle, lock the barrel surface, audit RD-01/02/03 spec coverage, and
land `yarn verify` green with `yarn lint:fix` clean. Most of RD-04 already ships (package/deps/docs);
this plan is narrow and reconciliation-heavy.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Kitchen-sink `forms/*` story (FR-4.6) | 7 |
| 2 | Render-path security oracle (FR-4.3) | 3 |
| 3 | Reconciliation, surface lock & gate (FR-4.2/4.5/4.8) | 5 |

**Total: 15 tasks across 3 phases** (scope bounded by the task-size criteria; no hour estimates)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated** after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]` resumed first, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Kitchen-sink `forms/*` story (FR-4.6)

### Step 1.1: Spec first — pin the story before it exists

**Reference**: `03-01 §Story metadata` · `07` ST-N1 · AR-P5
**Objective**: A failing smoke case that asserts `forms/form` is registered and paints.

- [x] 1.1.1 Add ST-N1 case (`forms/form` present in `STORIES` + paints a forms-specific signal — the `valid · dirty` echo — beyond the generic smoke loop) to `packages/examples/test/kitchen-sink.smoke.spec.test.ts` ✅ (completed: 2026-07-15 14:37)
- [x] 1.1.2 Red phase: run `yarn workspace @jsvision/examples test` and confirm ST-N1 fails (no such story) ✅ (completed: 2026-07-15 14:37)

### Step 1.2: Enable + implement the story

**Reference**: `03-01 §Implementation Details` · `02 §Code Analysis` (story contract, binding APIs)
**Objective**: The live server-connection form, registered and green.

- [x] 1.2.1 Add `zod` + `@jsvision/forms` to `packages/examples/package.json`; run `yarn install`; confirm examples still builds — `packages/examples/package.json` ✅ (completed: 2026-07-15 14:38)
- [x] 1.2.2 Implement the story (all five binding paths, touched-gated errors, `valid · dirty` echo, submit-echo) — `packages/examples/kitchen-sink/stories/forms.story.ts` ✅ (completed: 2026-07-15 14:41)
- [x] 1.2.3 Register `formsStory` under a new `Forms` category — `packages/examples/kitchen-sink/stories/index.ts` ✅ (completed: 2026-07-15 14:41)
- [x] 1.2.4 Green phase: ST-N1 + the generic smoke tests pass — `yarn workspace @jsvision/examples test` ✅ (completed: 2026-07-15 14:41)

### Step 1.3: Docs discipline

**Reference**: `03-02 §Green build & lint gate` · repo JSDoc rule (examples follows the spirit)
**Objective**: The new story file carries user-facing JSDoc; no banned refs.

- [x] 1.3.1 JSDoc the story's export + module (plain language, no CodeOps/TV/plan ids) — `packages/examples/kitchen-sink/stories/forms.story.ts` ✅ (completed: 2026-07-15 14:44)

**Deliverables**:
- [x] `forms/form` story registered and passing the headless smoke test
- [x] All verification passing

**Verify**: `yarn verify`

---

## Phase 2: Render-path security oracle (FR-4.3)

### Step 2.1: Spec the render-path contract

**Reference**: `03-02 §Render-path security` · `07` ST-N2 · AR-P2 / AR-22
**Objective**: An oracle proving a control-byte value is sanitized when rendered through a bound `Input`.

- [x] 2.1.1 Add the render-path oracle (bind field → `Input` → `RenderRoot`; assert no cell `< 0x20`) — `packages/forms/test/security.spec.test.ts` ✅ (completed: 2026-07-15 14:47)
- [x] 2.1.2 Observe: run `yarn workspace @jsvision/forms test`; confirm the oracle exercises the render path and its verdict (expected green — sanitization ships in `@jsvision/ui`) ✅ (completed: 2026-07-15 14:47 — painted `ab[31mc`; NUL/ESC/BEL/CR/LF/CSI all stripped, non-vacuous)

### Step 2.2: Close any gap

**Reference**: `03-02 §Render-path security` (design notes)
**Objective**: Green oracle; if a real escape is found, fix the path (not the oracle).

- [x] 2.2.1 If ST-N2 fails, fix the render/bind path and re-verify; else confirm green and pin the contract — `packages/forms/*` ✅ (completed: 2026-07-15 14:47 — no gap; oracle green on first run, contract pinned)

**Deliverables**:
- [x] `security.spec.test.ts` green (render-path sanitization proven)
- [x] All verification passing

**Verify**: `yarn verify`

---

## Phase 3: Reconciliation, surface lock & gate (FR-4.2 / 4.5 / 4.8)

### Step 3.1: RD-01/02/03 spec-coverage audit

**Reference**: `07 §Coverage audit matrix` · `03-02 §Coverage audit` · AR-P3
**Objective**: Every RD-01/02/03 AC traces to a passing spec test; genuine gaps filled.

- [ ] 3.1.1 Complete the coverage matrix in `07` — map each RD-01/02/03 AC → covering spec test (file + `should…`) — `codeops/features/jsvision-forms/plans/non-functional/07-testing-strategy.md`
- [ ] 3.1.2 For each gap found, add a spec case (spec-first) to the matching existing `*.spec.test.ts` and confirm green; if zero gaps, record "zero gaps" in the matrix — `packages/forms/test/*.spec.test.ts`

### Step 3.2: Surface lock

**Reference**: `03-02 §Surface lock` · `07` ST-N3 · AR-P6
**Objective**: The barrel's runtime exports are locked to exactly the FR-4.2 set.

- [ ] 3.2.1 Add the surface-lock test (`Object.keys` equals exactly the five value exports) — `packages/forms/test/surface.impl.test.ts`
- [ ] 3.2.2 Run full `yarn verify`; confirm green (typecheck locks the FR-4.2 type surface)

### Step 3.3: Pre-PR lint gate

**Reference**: `03-02 §Green build & lint gate` · project Prime directive · AR-P7
**Objective**: CI lands green — no fixable lint/format error surfaces in CI first.

- [ ] 3.3.1 Run `yarn lint:fix`; commit any changes; confirm the working tree is clean

**Deliverables**:
- [ ] Coverage matrix complete; surface locked; `yarn verify` green; tree clean
- [ ] All verification passing

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (story)
    ↓
Phase 2 (render-path oracle)
    ↓
Phase 3 (audit · surface lock · gate)
```

Phases are independent in principle but ordered so the marquee deliverable (the story) lands first
and the final gate (Phase 3) runs last over the whole branch.

---

## Success Criteria

**Feature is complete when** (mapped 1:1 to RD-04 §Acceptance criteria):

1. ✅ `packages/forms` builds/typechecks; `yarn check:deps` passes; core/ui remain zero-dep
2. ✅ Barrel surface is exactly the FR-4.2 set (locked by `surface.impl.test.ts`)
3. ✅ A control-byte value cannot escape sanitization on render (`security.spec.test.ts` passes)
4. ✅ Every RD-01/02/03 acceptance criterion traces to a passing spec test; impl edges covered
5. ✅ The `forms/form` kitchen-sink story is registered and passes the headless smoke test
6. ✅ `yarn check:docs` passes; every public export has an `@example`; no banned references
7. ✅ `yarn verify` is green on the branch; `yarn lint:fix` leaves the tree clean
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
