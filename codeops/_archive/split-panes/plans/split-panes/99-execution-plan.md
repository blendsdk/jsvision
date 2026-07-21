# Execution Plan: Split Panes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-17 18:41
> **Progress**: 45/45 tasks (100%) — ✅ COMPLETE, all 4 phases (Phase 3 has 15 task checkboxes, not the 13 the table below first stated; the checkboxes are authoritative, so the true total is 45)
> **CodeOps Skills Version**: 3.8.0
> **Preflighted**: 2026-07-17 — 6 findings (4 major, 2 minor), all resolved into the specs above; see
> [`00-preflight-report.md`](00-preflight-report.md). Fixes folded into existing tasks (count unchanged);
> the four majors add spec cases ST-28…ST-31.

## Overview

Implements `SplitView` for `@jsvision/ui` per [GH #10](https://github.com/blendsdk/jsvision/issues/10):
N panes, N−1 draggable splitters, row or column, nestable for grids. Four phases — the shared
layout-engine `min` support and the theme roles land first and independently, then the component,
then the mandatory showcase story.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Layout engine: minimum-size support | 13 |
| 2 | Theme roles: `splitter` + `splitterDragging` | 9 |
| 3 | `SplitView` component | 15 |
| 4 | Kitchen-sink story + close-out | 8 |

**Total: 45 tasks across 4 phases** (no fabricated hour estimates; Phase 3's count corrected from 13 → 15 during execution to match its actual checkboxes)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and the Last Updated stamp after EVERY task — never batch.
>    Only `[x]` counts as complete.
> 4. **Resume** by scanning top-to-bottom: the first `[~]` task is resumed first, else the first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

> **⚠️ IMMUTABLE ORACLE.** Every ST-case expectation in `07-testing-strategy.md` was hand-computed
> from the documented algorithms, not from imagined code behavior. If a spec test fails, **the
> implementation is wrong — fix the code, never the test.** A delegated executor that hits a failing
> spec test reports a blocker; it never edits the test.

> **⚠️ SPEC-TEST NAMING (AR-22).** New spec tests use the repo's `test('ST-N: <behavior>')` form,
> matching every existing test file. The ephemeral-ID ban applies to shipped source
> (`packages/*/src`) only — CLAUDE.md exempts test files.

---

## Phase 1: Layout engine — minimum-size support

> Independent of Phase 2. Blocks Phase 3.

### Step 1.1: Specification Tests

**Reference**: [03-01](03-01-layout-engine-min.md) · [07-testing-strategy.md](07-testing-strategy.md) ST-1…ST-9 · AR-8, AR-16
**Objective**: Pin the min-support contract — and the no-min fast path's zero-regression guarantee — before touching the shared solver.

- [x] 1.1.1 Add ST-1…ST-7 as new cases in `packages/ui/test/apportion.spec.test.ts` — **add only; do not alter any existing expectation** ✅ (completed: 2026-07-17 17:18)
- [x] 1.1.2 Add ST-8, ST-9 as new cases in `packages/ui/test/layout.sizing.spec.test.ts` ✅ (completed: 2026-07-17 17:18)
- [x] 1.1.3 Run the spec tests — red phase recorded ✅ (completed: 2026-07-17 17:18). **Actual red set:** ST-2, ST-5, ST-8, ST-9 fail. **Pre-implementation passes (by design):** ST-1, ST-3, ST-4, ST-6, ST-7 — each asserts preserved or coincident behavior. The plan predicted ST-2…ST-6 would all fail; in fact ST-3 `[5,5]`, ST-4 `[37,42]`, and ST-6 `[5]` coincide with the *naive* apportionment (equal mins squeeze to the same split; single item takes all; identity), so they pass pre-impl like ST-1/ST-7. Oracle **values** all verified correct by hand — only the plan's red/green prediction was overstated

**Deliverables**:
- [x] ST-1…ST-9 written and their red/green status recorded ✅ (2026-07-17 17:18)

**Verify**: `yarn verify`

### Step 1.2: Implementation

**Reference**: [03-01](03-01-layout-engine-min.md) §Implementation Details · AR-7, AR-8
**Objective**: Add an optional `min` to the flex track, behind a fast path that leaves every existing caller byte-identical.

- [x] 1.2.1 Add `min?: number` to the `flex` variant of `TrackItem` — `packages/ui/src/layout/apportion.ts` ✅ (completed: 2026-07-17 17:24)
- [x] 1.2.2 Implement module-private `apportionMin(total, weights, mins)` per 03-01 §Algorithm (infeasible → `apportion(total, mins)`; else pin-to-fixpoint) — `packages/ui/src/layout/apportion.ts`. **Not** barrel-exported (AR-7) ✅ (completed: 2026-07-17 17:24)
- [x] 1.2.3 Add the no-min fast path to `solveTrack`: delegate to `apportionMin` only when some item carries a `min`, else run today's `apportion` line unchanged — `packages/ui/src/layout/apportion.ts` ✅ (completed: 2026-07-17 17:24)
- [x] 1.2.4 Add `min?: number` to the `fr` variant of `Size`; clamp via `toCells` in `normalizeSize` — `packages/ui/src/layout/types.ts` ✅ (completed: 2026-07-17 17:24)
- [x] 1.2.5 Pass `min` through the `fr`→`TrackItem` bridge — `packages/ui/src/layout/layout.ts` ✅ (completed: 2026-07-17 17:24)
- [x] 1.2.6 An `fr` item contributes `min ?? 0` (was `0`) to natural size — `packages/ui/src/layout/measure.ts` ✅ (completed: 2026-07-17 17:24)
- [x] 1.2.7 JSDoc the new field on both public types, with a working `@example` showing a binding minimum (`check-jsdoc.mjs` gates this) — no plan/RD ids, no TV provenance. Note: the gate requires `@example` only on public class/function exports, not type aliases; added a binding-minimum `@example` to `solveTrack` (a gated public function) + inline field JSDoc on both types ✅ (completed: 2026-07-17 17:24)
- [x] 1.2.8 Run the spec tests — **ST-1…ST-9 PASS** (green phase); full ui unit suite 1641/1641 green (zero regression) ✅ (completed: 2026-07-17 17:24)

**Deliverables**:
- [x] `min` supported on `fr`/`flex` tracks end to end ✅ (2026-07-17 17:24)
- [x] ST-1 green — zero regression for existing callers (290 files / 1641 tests green) ✅ (2026-07-17 17:24)

**Verify**: `yarn verify`

### Step 1.3: Implementation Tests & Hardening

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) §Implementation Tests
**Objective**: Cover the fixpoint's internals and prove the shared solver is unharmed.

- [x] 1.3.1 Add impl tests to `packages/ui/test/apportion.impl.test.ts` — 3+ simultaneously-binding minimums; tie-breaking; a zero-weight item with a `min` (gets its min, residue unfilled); `min` × `gap` (`solveTrack(21, [{flex,1,min:15},{flex,1}], 1)` → `[15,5]`); `min` alongside `fixed` items. Also added a fill-exactly invariant sweep across widths 1..200 ✅ (completed: 2026-07-17 17:27)
- [x] 1.3.2 Full verification — **the entire existing layout suite green**; `yarn verify` green across all 26 turbo tasks (with `TUI_SKIP_PERF=1`; the sole non-min failure was the machine-dependent editor-perf ceiling, which passes in isolation). Required a plugin API-reference regen (`yarn plugin:sync --fix`) since `TrackItem.min`/`Size.min` are new public surface — only `layout-views.md` drifted ✅ (completed: 2026-07-17 17:33)

**Deliverables**:
- [x] Impl tests green · existing layout suite green ✅ (2026-07-17 17:33)

**Verify**: `yarn verify`

---

## Phase 2: Theme roles — `splitter` + `splitterDragging`

> Independent of Phase 1. Blocks Phase 3 (the component draws with these roles).

### Step 2.1: Specification Tests

**Reference**: [03-02](03-02-theme-roles.md) · ST-25 · AR-15
**Objective**: Pin both roles' presence across every theme surface.

- [x] 2.1.1 Add ST-25 as a new case in `packages/core/test/theme-roles.spec.test.ts` — both roles present in `defaultTheme`, `monochromeTheme`, every `createTheme` preset, and the derived `CANONICAL_ROLES`. Split into two cases: presence+valid-fg/bg across all 13 presets + a fresh `createTheme`, and canonical-set membership + serialize→parse survival. Roles looked up by string so red = undefined (not a compile error) ✅ (completed: 2026-07-17 17:38)
- [x] 2.1.2 Run — **ST-25 FAILS** (red phase); the two ST-13 cases still pass ✅ (completed: 2026-07-17 17:38)

**Deliverables**:
- [x] ST-25 written and red ✅ (2026-07-17 17:38)

**Verify**: `yarn verify`

### Step 2.2: Implementation

**Reference**: [03-02](03-02-theme-roles.md) §Implementation Details · AR-15
**Objective**: Four compiler-enforced edits, modelled on the `indicatorNormal`/`indicatorDragging` pair.

- [x] 2.2.1 Add `splitter` + `splitterDragging` members to `interface Theme`, each JSDoc'd in the file's house style (describe the colour in words) — `packages/core/src/engine/color/theme.ts` ✅ (completed: 2026-07-17 17:40)
- [x] 2.2.2 Add both entries to the `defaultTheme` literal — `packages/core/src/engine/color/theme.ts`. Used `PALETTE.lightGray`/`PALETTE.brightGreen`/`PALETTE.blue` (no `brightWhite`) ✅ (completed: 2026-07-17 17:40)
- [x] 2.2.3 Add both entries to `monochromeTheme` — `packages/core/src/engine/color/presets.ts` ✅ (completed: 2026-07-17 17:40)
- [x] 2.2.4 Add both entries to `rolesFromAliases` so all 11 generated presets inherit them — `packages/core/src/engine/color/roles.ts` ✅ (completed: 2026-07-17 17:40)
- [x] 2.2.5 Run — **ST-25 PASSES** (green phase). Verified role count is exactly 70 (was 68); updated 3 stale "68 roles" doc comments (aliases.ts, color/index.ts, theme-designer roles-panel.ts) ✅ (completed: 2026-07-17 17:40)

**Deliverables**:
- [x] Both roles resolve in every theme · no `serialize.ts` change needed (`CANONICAL_ROLES` is derived) ✅ (2026-07-17 17:40)

**Verify**: `yarn verify`

### Step 2.3: Implementation Tests & Hardening

- [x] 2.3.1 Add an impl test asserting both roles resolve to valid colours in every preset — new `packages/core/test/theme-roles.impl.test.ts`: `encode()` of each role's fg/bg at all 4 depths across all 13 presets does not throw (goes beyond ST-25's presence check to prove the colour *values* are valid, which the self-round-trip preset test cannot) ✅ (completed: 2026-07-17 17:42)
- [x] 2.3.2 Full verification ✅ (completed: 2026-07-17 17:58) — `CI=1 yarn verify` green across all 26 turbo tasks. Adding the two roles tripped 6 pre-existing whole-theme snapshot oracles (a total-count assertion + 5 per-feature "additive-only" allowlists); registered `splitter`/`splitterDragging` in each via their designed "sanctioned later additive roles" slot — the mechanical union AR-15/03-02 pre-accepted (recorded as runtime AR-23). Note: `TUI_SKIP_PERF` is not forwarded through turbo; use `CI=1` to skip the machine-dependent editor-perf ceiling

**Deliverables**:
- [x] Theming suite green ✅ (2026-07-17 17:58)

**Verify**: `yarn verify`

---

## Phase 3: `SplitView` component

> Depends on Phase 1 (the `min` track) and Phase 2 (the roles).

### Step 3.1: Specification Tests

**Reference**: [03-03](03-03-splitview-component.md) · ST-10…ST-24, ST-27 · AR-1, AR-5, AR-6, AR-8…AR-17
**Objective**: Pin the component's geometry, drag fidelity, clamping, and keyboard contract before writing it.

- [x] 3.1.1 Write `packages/ui/test/split.spec.test.ts` — ST-10…ST-24, ST-27…ST-31. Geometry hand-computed & re-verified against `solveTrack`/`apportionMin` (ST-10 `[10,10]`, ST-11 `[7,7,6]`, ST-27 `[12,18]`, ST-28 squeeze→frozen). ST-29 asserts role **after** mouse-up, ST-30 writes `sizes` **after** mount, ST-31 asserts callback **call counts** (0 while clamped, exactly 1 `onResizeEnd`) ✅ (completed: 2026-07-17 18:10)
- [x] 3.1.2 Write `packages/ui/test/split.packaging.spec.test.ts` — `SplitView` + `SplitViewOptions` exported from `@jsvision/ui`; `applySplitResize` **not** exported; each `src/split/` file ≤ 500 lines. Matches the `tabs.packaging.spec` convention ✅ (completed: 2026-07-17 18:10)
- [x] 3.1.3 Run — all FAIL (red phase): `split.spec` fails to import the absent modules; `split.packaging` fails on `SplitView` undefined + no `src/split` dir ✅ (completed: 2026-07-17 18:10)

**Deliverables**:
- [x] ST-10…ST-24, ST-27…ST-31 written and red ✅ (2026-07-17 18:10)

**Verify**: `yarn verify`

### Step 3.2: Implementation

**Reference**: [03-03](03-03-splitview-component.md) §Implementation Details
**Objective**: The widget — declarative structure, captured drag, keyboard resize.

- [x] 3.2.1 Implement pure `applySplitResize(cells, index, delta, mins)` — `packages/ui/src/split/resize.ts` (module-private). Load-bearing `min(0,…)`/`max(0,…)` bounds implemented (PF-001, ST-28 green). **Hoisted** the repo's `clamp` to a new shared `src/shared/clamp.ts` and rewired `desktop/gestures.ts` to import it, so the argument order is pinned by one definition ✅ (completed: 2026-07-17 18:17)
- [x] 3.2.2 Implement `Splitter extends View` — `focusable=true`; `│`/`─` + `▓` grab mark; role flip; unmodified-arrow keyboard. `onMount(){ this.bind(() => this.dragging()) }` in place (PF-002, ST-29 green). Extends `View` (not the nonexistent `BaseView`). Owner typed via a minimal `SplitOwner` interface to avoid a runtime import cycle with `split-view.ts` — `packages/ui/src/split/splitter.ts` ✅ (completed: 2026-07-17 18:17)
- [x] 3.2.3 Implement `SplitView extends Group` — inner `track` Group (`position:'fill'`, `direction`, `gap:0`); interleaved children; `minSize`/children normalization in the constructor; `sizes` length normalization deferred to `applyWeights` (PF-004) — `packages/ui/src/split/split-view.ts` ✅ (completed: 2026-07-17 18:17)
- [x] 3.2.4 Reactive resync `bind(() => sizes(), applyWeights, {relayout:true})` in `onMount`; `applyWeights` pads/truncates every write with the **length-guarded** write-back (no unconditional `sizes.set` → no `Object.is` loop; PF-004, ST-30 green) ✅ (completed: 2026-07-17 18:17)
- [x] 3.2.5 Gesture — `beginDrag` captures on `SplitView`; `onEvent` recomputes from `startCells` + total delta using raw terminal coords; `hasCapture` staleness guard; idempotent `endDrag`. Live geometry via `resolvedCells()`. `commit()` dedupes + fires `onResize`; `endDrag({commit:true})` fires `onResizeEnd` once; staleness `endDrag()` fires neither (PF-003, R7, ST-31 green) ✅ (completed: 2026-07-17 18:17)
- [x] 3.2.6 Created `packages/ui/src/split/index.ts` + re-exported `SplitView`/`SplitViewOptions` from `packages/ui/src/index.ts` (next to `TabView`) ✅ (completed: 2026-07-17 18:17)
- [x] 3.2.7 JSDoc every public export with a working `@example` (`SplitView` carries a copy-pasteable one); commented the non-obvious *why* (capture-on-container, recompute-from-start, the write-back guard) — no plan/RD ids, no TV provenance ✅ (completed: 2026-07-17 18:17)
- [x] 3.2.8 Run the spec tests — **ST-10…ST-24, ST-27…ST-31 PASS** (23/23 green, first run); full ui suite 1670/1670 green (no regression from the `clamp` hoist) ✅ (completed: 2026-07-17 18:17)

**Deliverables**:
- [x] `SplitView` drags, clamps, resizes from the keyboard, and nests ✅ (2026-07-17 18:17)
- [x] Files within the 200–500 line target (resize 51 · splitter 76 · split-view ~230) ✅ (2026-07-17 18:17)

**Verify**: `yarn verify`

### Step 3.3: Implementation Tests & Hardening

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) §Implementation + §Integration
**Objective**: Cover the gesture's edges and prove the declarative design actually reflows pane interiors.

- [x] 3.3.1 Write `packages/ui/test/split.impl.test.ts` — `endDrag` idempotency (abandoned gesture + up fires no `onResizeEnd`); normalization edges (0 children, `minSize` length mismatch `[12]`→`[12,17]`, negative `minSize`→0); modified arrows fall through (Ctrl/Alt); grab-mark at even/odd extents (h4/5/6 → y2/2/3); 1-cell axis; squeezed-regime zero-delta freeze end-to-end (`[10,9]`, never `[12,7]`); write-back terminates in one pass (PF-004) ✅ (completed: 2026-07-17 18:22)
- [x] 3.3.2 Rubber-band guard test — drag to `[15,5]`, reverse by 1 stays pinned, moves only at total-delta 4 → `[14,6]` (proves recompute-from-`startCells`) ✅ (completed: 2026-07-17 18:22)
- [x] 3.3.3 Integration tests — full down→drag→up **through the capture seam** in a real `EventLoop` (releases capture, no resize after release); **pane interiors reflow** after a drag (an fr child tracks the grown pane, 10→13); a nested row-of-cols 2×2 grid at 41×11 ✅ (completed: 2026-07-17 18:22)
- [x] 3.3.4 Full verification ✅ (completed: 2026-07-17 18:33) — `CI=1 yarn verify` green across all 26 turbo tasks + `check-plugin` PASS. Adding `SplitView`/`SplitViewOptions` to the barrel required: a plugin API-reference regen, registering the `split` source segment → `containers` category in `gen-plugin-api.mjs` (else SplitView mis-filed under core-essentials), and a hand-written `component-catalog.md` bullet (catalog drafting is normally the AI path, unavailable here). New source grepped clean of banned refs; all `split/` files ≤ 262 lines

**Deliverables**:
- [x] Impl + integration tests green (12/12) ✅ (2026-07-17 18:22)

**Verify**: `yarn verify`

---

## Phase 4: Kitchen-sink story + close-out

> Depends on Phase 3. The story is **non-negotiable** — the component is not done without it.

### Step 4.1: Specification Test

**Reference**: [03-04](03-04-kitchen-sink-story.md) · ST-26 · AR-19
**Objective**: Pin the story's registration and headless render.

- [x] 4.1.1 Add ST-26 to `packages/examples/test/kitchen-sink.smoke.spec.test.ts` — id `layout/split`, category `Layout`, paints ≥1 non-blank cell. No `story.rd` assertion (AR-19) ✅ (completed: 2026-07-17 18:36)
- [x] 4.1.2 Run — **ST-26 FAILS** (red phase; 1 failed / 59 passed) ✅ (completed: 2026-07-17 18:36)

**Deliverables**:
- [x] ST-26 written and red ✅ (2026-07-17 18:36)

**Verify**: `yarn verify`

### Step 4.2: Implementation

**Reference**: [03-04](03-04-kitchen-sink-story.md)
**Objective**: A showcase story that sells the component.

- [x] 4.2.1 Write `packages/examples/kitchen-sink/stories/split.story.ts` — nested split (row → `[Explorer | col:[Editor / Terminal]]`) via a labelled-pane helper (the `layout.story` pattern); live `outer`/`inner` `sizes()` echo; interaction hint; `minSize: 12`/`3`. No modal ✅ (completed: 2026-07-17 18:38)
- [x] 4.2.2 Register it — import + array entry (after `tabsStory`) in `packages/examples/kitchen-sink/stories/index.ts` ✅ (completed: 2026-07-17 18:38)
- [x] 4.2.3 Run — **ST-26 PASSES** (green phase); the generic smoke loop also covers it (61/61) ✅ (completed: 2026-07-17 18:38)

**Deliverables**:
- [x] Story registered and rendering ✅ (2026-07-17 18:38)

**Verify**: `yarn verify`

### Step 4.3: Close-out

**Reference**: AR-20 · CLAUDE.md §Prime directive
**Objective**: Green tree, deferred work filed, PR-ready.

- [x] 4.3.1 Full verification — `CI=1 yarn verify` green across all 26 turbo tasks + `check-plugin` PASS; `yarn check:deps` green (11/11, no native deps); `check:docs` green (in verify). Directly grepped the new source + story for banned refs — clean ✅ (completed: 2026-07-17 18:41)
- [x] 4.3.2 Filed the AR-20 deferral as **GH #97** — framework-wide hover support (mouse mode 1003 + capability gate) · owner: @gevik · revisit: when a second widget needs hover, or before `@jsvision/ui` v1.0 ✅ (completed: 2026-07-17 18:41)
- [x] 4.3.3 Ran `yarn lint:fix` (formatted the story; tree clean); committing + pushing Phase 4 via a normal git commit (the /gitcmp equivalent) ✅ (completed: 2026-07-17 18:41)

**Deliverables**:
- [x] `yarn verify` green · hover deferral filed (#97) · tree clean ✅ (2026-07-17 18:41)

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (layout min)  ─┐
                       ├─→  Phase 3 (SplitView)  ─→  Phase 4 (story + close-out)
Phase 2 (theme roles) ─┘

Phases 1 and 2 are independent of each other and may run in either order (or in parallel).
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `yarn verify` passing (AR-21)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Robustness hardened — every apportion path sums exactly (a pane that overflows its bounds is a wrong click target); degenerate numeric inputs normalize rather than throw
6. ✅ Documentation updated — every public export carries JSDoc + a working `@example`; no plan/RD ids or TV provenance in shipped code
7. ✅ All 8 acceptance criteria in [01-requirements.md](01-requirements.md) met — including the two the gate added (R5 container-shrink clamp; ST-1 zero-regression)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
</content>
