# Execution Plan: DSL Hardening

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-19 01:13
> **Progress**: 14/32 tasks (44%)
> **CodeOps Skills Version**: 3.9.0

## Overview

Harden the `@jsvision/ui` layout DSL (S1/S2/S3/S5/S7 + the `dsl/` module split + the split-view S1
proof). Additive and behavior-preserving; zero runtime deps.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Module split (`dsl/` folder) — refactor | 7 |
| 2 | S1 `size.min` + S7 falsy children | 7 |
| 3 | S2 `at()` (+S4) + S3 `cover()`/`center()` | 6 |
| 4 | S5 placement offsets + S3 dev-warn | 7 |
| 5 | split-view migration (S1 proof) — refactor | 3 |
| 6 | Docs, export surface, final verify | 2 |

**Total: 32 tasks across 6 phases** (scope bounded by the task-size criteria in the quality checklist).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress; each task line appears
> exactly once. The executing agent MUST:
> 1. **On implementation:** `- [~] N.N.N … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** `- [x] N.N.N … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated after EVERY task** — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

Feature phases (2–4) follow the specification-first ordering (spec tests → red → implement → green →
impl tests → verify) per `../../../../_shared/spec-first-ordering.md`. Phase 5 is a
**behavior-preserving refactor** (existing suites are the green oracle). Phase 1 is a
behavior-preserving refactor **except** for one sanctioned mechanical update: because the packaging
oracle reads `src/view/dsl.ts` by path, the split repaths it (task 1.1.7) — a recorded
spec-immutability exception, not a behavior change.

---

## Phase 1: Module split (`dsl/` folder)

### Step 1.1: Refactor `dsl.ts` into `dsl/` with identical public API

**Reference**: 03-01 · AR-8
**Objective**: cohesive sub-500-line modules; `@jsvision/ui` surface byte-identical.

- [x] 1.1.1 Baseline: confirm `layout-dsl*`, `layout-dsl-stack.*`, `layout-dsl.packaging`, `view.*` suites green pre-refactor — `packages/ui/test/` ✅ (completed: 2026-07-19 00:35)
- [x] 1.1.2 Create `packages/ui/src/view/dsl/flex.ts` (move `Flex`/`toLayout`/`container`/`col`/`row`/`grow`/`fixed`/`spacer`/`Empty`) ✅ (completed: 2026-07-19 00:35)
- [x] 1.1.3 Create `packages/ui/src/view/dsl/stack.ts` (move `Placement`/`PlaceAxis`/`placements`/`isFillAxis`/`layerRect`/`resolvePadding`/`Stack`/`stack`/`place`/`centered`/`topRight`/`bottomRight`/`topLeft`) ✅ (completed: 2026-07-19 00:35)
- [x] 1.1.4 Create `packages/ui/src/view/dsl/index.ts` barrel (re-export every public name + `Flex`/`Placement`) ✅ (completed: 2026-07-19 00:35)
- [x] 1.1.5 Repoint `packages/ui/src/view/index.ts` to `./dsl/index.js`; remove old `dsl.ts`; grep the monorepo for any `view/dsl` deep import ✅ (completed: 2026-07-19 00:35)
- [x] 1.1.6 Verify the behavior suites (`layout-dsl*`, `layout-dsl-stack.*`, `view.*`) pass unchanged (ST-REF); the packaging spec's path/line-count assertions are updated in 1.1.7, not held to "unchanged" ✅ (completed: 2026-07-19 00:35)
- [x] 1.1.7 Repath the packaging oracle for the split — `packages/ui/test/layout-dsl.packaging.spec.test.ts`: glob `src/view/dsl/*.ts` (`readdirSync`), scan **every** module's comments for banned refs, apply the ≤500-line budget **per file**, and assert the old `src/view/dsl.ts` no longer exists. This is a **sanctioned edit to a spec oracle** for a pure refactor (assertion intent preserved/strengthened) — record the rationale in the commit message ✅ (completed: 2026-07-19 00:35)

**Deliverables**: `dsl/` folder; identical exports; behavior suites green; packaging oracle repathed (assertions preserved/strengthened).
**Verify**: `yarn verify`

---

## Phase 2: S1 `size.min` + S7 falsy children

### Step 2.1: Spec (red)
**Reference**: 03-02 · 07 ST-1…ST-6 · AR-2, AR-7
- [x] 2.1.1 Write `packages/ui/test/dsl-sizing.spec.test.ts` (ST-1…ST-5) + `dsl-falsy.spec.test.ts` (ST-6, covering falsy skip in **both** `col`/`row` and `stack`) ✅ (completed: 2026-07-19 01:13) — ST-3 corrected to an engine-faithful binding scenario per AR-14 (runtime, signed off)
- [x] 2.1.2 Red: run both suites, confirm they FAIL against current code ✅ (completed: 2026-07-19 01:13) — 5 failed / 2 pre-passing (ST-2, ST-4 satisfiable-floor)

### Step 2.2: Implement (green)
**Reference**: 03-02 §grow/fixed, §falsy
- [x] 2.2.1 Add `min` to `grow()` + the `Flex.grow` object form in `toLayout()` — `dsl/flex.ts` ✅ (completed: 2026-07-19 01:13) — single union-typed `grow(view, n=1, opts?)` signature (no TS overloads: they tripped the per-declaration `check:docs` `@example` guard, and one signature already accepts all call forms)
- [x] 2.2.2 Filter `null`/`undefined`/`false` children in `container()` **and** `stack()`, and widen **both** their child/layer param types to `View | null | undefined | false` — `dsl/flex.ts`, `dsl/stack.ts` ✅ (completed: 2026-07-19 01:13) — props detection also fixed to treat a *leading* falsy value as a skipped child, not a props object
- [x] 2.2.3 Green: ST-1…ST-6 pass ✅ (completed: 2026-07-19 01:13)

### Step 2.3: Impl tests & verify
- [x] 2.3.1 Impl tests (`Flex.grow` object-vs-number resolution; falsy edges) — `packages/ui/test/dsl-hardening.impl.test.ts` ✅ (completed: 2026-07-19 01:13)
- [x] 2.3.2 Verify ✅ (completed: 2026-07-19 01:13) — full `CI=1 yarn verify` green (30/30) + `check:deps` green; API-reference page `api/layout-views.md` re-synced via `yarn plugin:sync --fix` (no AI)

**Deliverables**: `grow`/`fixed`/shorthand carry `min`; `col`/`row`/`stack` tolerate falsy children (runtime + types).
**Verify**: `yarn verify`

---

## Phase 3: S2 `at()` (+S4) + S3 `cover()`/`center()`

### Step 3.1: Spec (red)
**Reference**: 03-03 · 07 ST-7…ST-12 · AR-3, AR-4
- [ ] 3.1.1 Write `packages/ui/test/dsl-absolute.spec.test.ts` (ST-7…ST-12)
- [ ] 3.1.2 Red: confirm FAIL (exports don't exist yet)

### Step 3.2: Implement (green)
**Reference**: 03-03 §at, §absolute-child, §cover-center
- [ ] 3.2.1 Create `packages/ui/src/view/dsl/absolute.ts`: `at` (positional + `Rect` overload, merge-preserving, pure), `cover`, `center`; re-export via `dsl/index.ts`, `view/index.ts`, `src/index.ts`
- [ ] 3.2.2 Green: ST-7…ST-12 pass (incl. ST-9 out-of-flow `at()` child)

### Step 3.3: Impl tests & verify
- [ ] 3.3.1 Impl tests (`at` numeric-vs-rect overload dispatch; `center`/`cover` merge over prior props) — extend `dsl-hardening.impl.test.ts`
- [ ] 3.3.2 Verify

**Deliverables**: `at`/`cover`/`center` exported and spec-green.
**Verify**: `yarn verify`

---

## Phase 4: S5 placement offsets + S3 dev-warn

### Step 4.1: Spec (red)
**Reference**: 03-04 · 07 ST-13…ST-15 · AR-5, AR-6
- [ ] 4.1.1 Write `packages/ui/test/dsl-offsets.spec.test.ts` (ST-13…ST-15)
- [ ] 4.1.2 Red: confirm FAIL

### Step 4.2: Implement (green)
**Reference**: 03-04 §offsets, §dev-warn
- [ ] 4.2.1 Add `hOffset`/`vOffset` to `Placement` + apply-then-clamp in `layerRect()`; ignore on a `'fill'` axis — `dsl/stack.ts`
- [ ] 4.2.2 Add the orphan-tagger dev-warn — route through the shared `devWarn(scope, message)` helper (`shared/warnings.ts`, the single sanctioned console sink), with a `WeakSet` `adoptedByStack` tracker + `queueMicrotask` one-shot check — `dsl/stack.ts`
- [ ] 4.2.3 Green: ST-13…ST-15 pass

### Step 4.3: Impl tests & verify
- [ ] 4.3.1 Impl test (offset ignored on a `'fill'` axis; warn suppressed inside `stack()`) — extend `dsl-hardening.impl.test.ts`
- [ ] 4.3.2 Verify

**Deliverables**: placement offsets + a guidance dev-warn (via `devWarn`).
**Verify**: `yarn verify`

---

## Phase 5: split-view migration (S1 proof — refactor)

### Step 5.1: Guard + migrate + verify green
**Reference**: 03-05 · 07 ST-16, ST-17 · AR-9
- [ ] 5.1.1 Add the ST-16 assertions to `packages/ui/test/split.impl.test.ts` — the pane `min` reaches the pane, AND a pane's pre-existing non-size `layout` props survive `grow`'s merge; confirm both pass on current code (invariant baseline)
- [ ] 5.1.2 Migrate `split-view.ts` sites `:153`/`:157`/`:185` to `grow(v, w, { min })` / `fixed(v, 1)` (leave the `:147` runtime-direction track as-is). Note: `grow` **merges** (`{...view.layout, size}`) where the old sites replaced — additive-merge, not byte-identical; panes must not pre-set `position` — `packages/ui/src/split/split-view.ts`
- [ ] 5.1.3 Verify `split.spec.test.ts` + `split.impl.test.ts` + `split.packaging.spec.test.ts` + `split-grabmark.*` pass **unchanged** (ST-16, ST-17)

**Deliverables**: split-view uses the DSL `min` form; behavior identical (modulo the documented additive-merge).
**Verify**: `yarn verify`

---

## Phase 6: Docs, export surface, final verify

### Step 6.1: JSDoc, packaging, gate
**Reference**: 01 R10 · AR-12, AR-13
- [ ] 6.1.1 Ensure a copy-pasteable `@example` on every new/changed export (`at`/`cover`/`center` + extended `grow`/`fixed`/`Placement`); the `cover` example notes the `Flex.fill` (grow:1) vs `cover()` (position:'fill') distinction; extend the packaging spec to assert `@jsvision/ui` gains exactly `at`/`cover`/`center` — `packages/ui/test/*packaging*`
- [ ] 6.1.2 Full gate: `yarn verify` (lint · typecheck · build · test · check:docs) **and** `yarn check:deps` green; no dead code

**Deliverables**: docs + packaging locked; green gate.
**Verify**: `yarn verify` && `yarn check:deps`

---

## Dependencies

```
Phase 1 (module split + packaging-oracle repath)
    ↓
Phase 2 (S1 + S7, in flex.ts)
    ↓
Phase 3 (at/cover/center, absolute.ts) ── independent of Phase 4 but both need Phase 1
    ↓
Phase 4 (offsets + dev-warn, stack.ts)
    ↓
Phase 5 (split-view migration — needs Phase 2's grow/min)
    ↓
Phase 6 (docs + surface + final gate)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 6 phases completed
2. ✅ `yarn verify` passing (lint · typecheck · build · test · check:docs)
3. ✅ `yarn check:deps` green (zero runtime deps preserved)
4. ✅ No dead code — no unused params/functions/modules; old `dsl.ts` removed
5. ✅ Security: N/A surface confirmed (pure in-process library — no input/network/fs/eval)
6. ✅ Every new/changed public export documented with an `@example`
7. ✅ `@jsvision/ui` export surface changed by exactly `+{at, cover, center}`
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)

> Commits are owned by the exec_plan skill (via **/gitcm** / **/gitcmp**) — no raw git in this plan.
> Per the repo prime directive, `yarn lint:fix` runs before the PR-opening push.
