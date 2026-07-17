# Execution Plan: Split Panes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-17 16:53
> **Progress**: 0/43 tasks (0%)
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
| 3 | `SplitView` component | 13 |
| 4 | Kitchen-sink story + close-out | 8 |

**Total: 43 tasks across 4 phases** (no fabricated hour estimates)

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

- [ ] 1.1.1 Add ST-1…ST-7 as new cases in `packages/ui/test/apportion.spec.test.ts` — **add only; do not alter any existing expectation**
- [ ] 1.1.2 Add ST-8, ST-9 as new cases in `packages/ui/test/layout.sizing.spec.test.ts`
- [ ] 1.1.3 Run the spec tests — verify **ST-2…ST-6, ST-8, ST-9 FAIL** (red phase). **Expected pre-implementation passes:** ST-1 and ST-7 assert that *current* behavior is preserved, so they pass before implementation by design — record this rather than treating it as a red-phase failure

**Deliverables**:
- [ ] ST-1…ST-9 written and their red/green status recorded

**Verify**: `yarn verify`

### Step 1.2: Implementation

**Reference**: [03-01](03-01-layout-engine-min.md) §Implementation Details · AR-7, AR-8
**Objective**: Add an optional `min` to the flex track, behind a fast path that leaves every existing caller byte-identical.

- [ ] 1.2.1 Add `min?: number` to the `flex` variant of `TrackItem` — `packages/ui/src/layout/apportion.ts`
- [ ] 1.2.2 Implement module-private `apportionMin(total, weights, mins)` per 03-01 §Algorithm (infeasible → `apportion(total, mins)`; else pin-to-fixpoint) — `packages/ui/src/layout/apportion.ts`. **Not** barrel-exported (AR-7)
- [ ] 1.2.3 Add the no-min fast path to `solveTrack`: delegate to `apportionMin` only when some item carries a `min`, else run today's `apportion` line unchanged — `packages/ui/src/layout/apportion.ts`
- [ ] 1.2.4 Add `min?: number` to the `fr` variant of `Size`; clamp via `toCells` in `normalizeSize` — `packages/ui/src/layout/types.ts`
- [ ] 1.2.5 Pass `min` through the `fr`→`TrackItem` bridge — `packages/ui/src/layout/layout.ts`
- [ ] 1.2.6 An `fr` item contributes `min ?? 0` (was `0`) to natural size — `packages/ui/src/layout/measure.ts`
- [ ] 1.2.7 JSDoc the new field on both public types, with a working `@example` showing a binding minimum (`check-jsdoc.mjs` gates this) — no plan/RD ids, no TV provenance
- [ ] 1.2.8 Run the spec tests — verify **ST-1…ST-9 PASS** (green phase). If any fails, fix the code, not the test

**Deliverables**:
- [ ] `min` supported on `fr`/`flex` tracks end to end
- [ ] ST-1 green — zero regression for existing callers

**Verify**: `yarn verify`

### Step 1.3: Implementation Tests & Hardening

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) §Implementation Tests
**Objective**: Cover the fixpoint's internals and prove the shared solver is unharmed.

- [ ] 1.3.1 Add impl tests to `packages/ui/test/apportion.impl.test.ts` — 3+ simultaneously-binding minimums; tie-breaking; a zero-weight item with a `min` (gets its min, residue unfilled); `min` × `gap` (`solveTrack(21, [{flex,1,min:15},{flex,1}], 1)` → `[15,5]`); `min` alongside `fixed` items
- [ ] 1.3.2 Full verification — **the entire existing layout suite must be green**; that is the real proof of the fast path

**Deliverables**:
- [ ] Impl tests green · existing layout suite green

**Verify**: `yarn verify`

---

## Phase 2: Theme roles — `splitter` + `splitterDragging`

> Independent of Phase 1. Blocks Phase 3 (the component draws with these roles).

### Step 2.1: Specification Tests

**Reference**: [03-02](03-02-theme-roles.md) · ST-25 · AR-15
**Objective**: Pin both roles' presence across every theme surface.

- [ ] 2.1.1 Add ST-25 as a new case in `packages/core/test/theme-roles.spec.test.ts` — both roles present in `defaultTheme`, `monochromeTheme`, every `createTheme` preset, and the derived `CANONICAL_ROLES`
- [ ] 2.1.2 Run — verify **ST-25 FAILS** (red phase)

**Deliverables**:
- [ ] ST-25 written and red

**Verify**: `yarn verify`

### Step 2.2: Implementation

**Reference**: [03-02](03-02-theme-roles.md) §Implementation Details · AR-15
**Objective**: Four compiler-enforced edits, modelled on the `indicatorNormal`/`indicatorDragging` pair.

- [ ] 2.2.1 Add `splitter` + `splitterDragging` members to `interface Theme`, each JSDoc'd in the file's house style (describe the colour in words) — `packages/core/src/engine/color/theme.ts`
- [ ] 2.2.2 Add both entries to the `defaultTheme` literal — `packages/core/src/engine/color/theme.ts`. ⚠️ `PALETTE` uses **DOS-16** names: bright white is `PALETTE.white`, normal white is `PALETTE.lightGray`; there is **no** `brightWhite` (a mistyped key is `undefined` → `InvalidThemeError` at runtime, not a compile error)
- [ ] 2.2.3 Add both entries to `monochromeTheme` — `packages/core/src/engine/color/presets.ts`
- [ ] 2.2.4 Add both entries to `rolesFromAliases` so all 11 generated presets inherit them — `packages/core/src/engine/color/roles.ts`
- [ ] 2.2.5 Run — verify **ST-25 PASSES** (green phase)

**Deliverables**:
- [ ] Both roles resolve in every theme · no `serialize.ts` change needed (`CANONICAL_ROLES` is derived)

**Verify**: `yarn verify`

### Step 2.3: Implementation Tests & Hardening

- [ ] 2.3.1 Add an impl test asserting both roles resolve to valid colours in every preset. ⚠️ Note `presets.impl.test.ts` is a **self round-trip** (serialization-lossless), **not** a byte-parity guard — a pass there does not prove the new values are right
- [ ] 2.3.2 Full verification

**Deliverables**:
- [ ] Theming suite green

**Verify**: `yarn verify`

---

## Phase 3: `SplitView` component

> Depends on Phase 1 (the `min` track) and Phase 2 (the roles).

### Step 3.1: Specification Tests

**Reference**: [03-03](03-03-splitview-component.md) · ST-10…ST-24, ST-27 · AR-1, AR-5, AR-6, AR-8…AR-17
**Objective**: Pin the component's geometry, drag fidelity, clamping, and keyboard contract before writing it.

- [ ] 3.1.1 Write `packages/ui/test/split.spec.test.ts` — ST-10…ST-24, ST-27…ST-31. Geometry expectations are hand-computed in 07; do not recompute them from the code. ⚠️ ST-29/ST-30/ST-31 are mask-prone: assert the splitter role **after mouse-up**, write `sizes` **after mount**, and assert callback **call counts** — a happy-path version of any of the three re-certifies the bug it exists to catch (PF-001…PF-004)
- [ ] 3.1.2 Write `packages/ui/test/split.packaging.spec.test.ts` — `SplitView` + `SplitViewOptions` exported from `@jsvision/ui`; `applySplitResize` **not** exported. Matches the per-subsystem `*.packaging.spec.test.ts` convention
- [ ] 3.1.3 Run — verify all FAIL (red phase)

**Deliverables**:
- [ ] ST-10…ST-24, ST-27 written and red

**Verify**: `yarn verify`

### Step 3.2: Implementation

**Reference**: [03-03](03-03-splitview-component.md) §Implementation Details
**Objective**: The widget — declarative structure, captured drag, keyboard resize.

- [ ] 3.2.1 Implement pure `applySplitResize(cells, index, delta, mins)` — clamp + conserve the adjacent pair's sum — `packages/ui/src/split/resize.ts` (module-private, per AR-7). ⚠️ Clamp bounds are `lo = min(0, mins[a]−cells[a])`, `hi = max(0, cells[b]−mins[b])` — the `min(0,…)`/`max(0,…)` are **load-bearing**: without them the range inverts once the engine has squeezed panes below their mins, and a zero-delta mouse-down silently corrupts `sizes` (PF-001, ST-28). Reuse the repo's `clamp` (`desktop/gestures.ts:22-24`, hoisted) rather than re-implementing, so the argument order is pinned
- [ ] 3.2.2 Implement `Splitter extends View` — `focusable = true`; `│`/`─` glyph + static `▓` grab mark at the midpoint; role `splitter` / `splitterDragging`; arrow keys → `owner.resizeBy(index, ±1)`. ⚠️ Add `onMount(){ this.bind(() => this.dragging()) }` — `draw()` is **not** auto-tracked, so without the bind the drag highlight sticks after mouse-up (PF-002, ST-29); copying `indicator.ts:72`'s draw line without its `:56-61` bind is the exact trap. ⚠️ Handle **unmodified** arrows only — leave `Ctrl`/`Alt`+arrow and cross-axis arrows unhandled so they bubble (the base `GridRows` swallow-modifiers trap). Extends **`View`** (the exported abstract base), **not** `BaseView` (which does not exist — it is only a local alias in `scroller.ts:14`, PF-005) — `packages/ui/src/split/splitter.ts`
- [ ] 3.2.3 Implement `SplitView extends Group` — inner `track` Group (`position:'fill'`, `direction`, `gap:0`); interleaved pane/splitter children; panes `{kind:'fr', weight, min}`, splitters `{kind:'fixed', cells:1}`; constructor normalization (children, `minSize`) per 03-03 §Normalization. ⚠️ `sizes` length normalization does **not** go in the constructor — it goes in `applyWeights` (3.2.4), because `sizes` is a caller-owned signal any writer can rewrite (PF-004) — `packages/ui/src/split/split-view.ts`
- [ ] 3.2.4 Wire reactive resync: `bind(() => sizes(), applyWeights, { relayout: true })` in `onMount` (`bind` throws outside it). `applyWeights` pads/truncates to the pane count on **every** write, with a write-back guarded on length mismatch only. ⚠️ The guard is mandatory: an **unconditional** `sizes.set(freshArray)` inside the effect is an infinite loop (`Object.is` never matches a new array reference — PF-004, ST-30) — `packages/ui/src/split/split-view.ts`
- [ ] 3.2.5 Implement the gesture — `beginDrag` (called by `Splitter`, mirroring `window.ts:285`'s `manager.beginMove`) captures on **`SplitView`**, not the splitter; `onEvent` recomputes from `startCells` + total delta using **raw terminal coords**; `hasCapture` staleness guard; idempotent `endDrag`. Read live geometry via `resolvedCells()` — **never** the `sizes` signal. Callbacks: `commit()` dedupes (no fire on an unchanged array) and fires `onResize` live; `endDrag({commit:true})` fires `onResizeEnd` once; the staleness-guard `endDrag()` fires neither (PF-003, R7, ST-31) — `packages/ui/src/split/split-view.ts`
- [ ] 3.2.6 Create `packages/ui/src/split/index.ts` and re-export the subsystem from `packages/ui/src/index.ts`
- [ ] 3.2.7 JSDoc every public export with a working, copy-pasteable `@example` (`check-jsdoc.mjs` gates it) — no plan/RD ids, no TV provenance; comment the non-obvious *why* (the capture-on-container choice; recompute-from-start vs incremental accumulation)
- [ ] 3.2.8 Run the spec tests — verify **ST-10…ST-24, ST-27 PASS** (green phase). If any fails, fix the code, not the test

**Deliverables**:
- [ ] `SplitView` drags, clamps, resizes from the keyboard, and nests
- [ ] Files within the 200–500 line target

**Verify**: `yarn verify`

### Step 3.3: Implementation Tests & Hardening

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) §Implementation + §Integration
**Objective**: Cover the gesture's edges and prove the declarative design actually reflows pane interiors.

- [ ] 3.3.1 Write `packages/ui/test/split.impl.test.ts` — `endDrag` idempotency (second call fires no `onResizeEnd`); normalization edges (0 children, `minSize` length mismatch, negative `minSize`); modified arrows fall through; grab-mark position at even/odd extents; a 1-cell splitter axis; `delta === 0` no-op in **both** the feasible and squeezed regimes; the `applyWeights` write-back **terminates** in one corrective write (the `Object.is` loop guard, PF-004)
- [ ] 3.3.2 Add the rubber-band guard test — drag far past a clamp then reverse by 1; the divider stays pinned until the pointer returns past the clamp point (proves recompute-from-`startCells`)
- [ ] 3.3.3 Add the integration tests — the drag driven **through the capture seam** in a real `EventLoop` (an issue #10 acceptance criterion, not a direct `resizeBy` call); **pane interiors reflow** after a drag (the regression test for the rejected imperative design); the nested grid at a realistic size
- [ ] 3.3.4 Full verification

**Deliverables**:
- [ ] Impl + integration tests green

**Verify**: `yarn verify`

---

## Phase 4: Kitchen-sink story + close-out

> Depends on Phase 3. The story is **non-negotiable** — the component is not done without it.

### Step 4.1: Specification Test

**Reference**: [03-04](03-04-kitchen-sink-story.md) · ST-26 · AR-19
**Objective**: Pin the story's registration and headless render.

- [ ] 4.1.1 Add ST-26 to `packages/examples/test/kitchen-sink.smoke.spec.test.ts` — id `layout/split`, category `Layout`, paints ≥1 non-blank cell. **Do not assert `story.rd`** — the chip is deliberately omitted (AR-19)
- [ ] 4.1.2 Run — verify **ST-26 FAILS** (red phase)

**Deliverables**:
- [ ] ST-26 written and red

**Verify**: `yarn verify`

### Step 4.2: Implementation

**Reference**: [03-04](03-04-kitchen-sink-story.md)
**Objective**: A showcase story that sells the component.

- [ ] 4.2.1 Write `packages/examples/kitchen-sink/stories/split.story.ts` — a **nested** split (row → `[explorer | col:[editor / terminal]]`) demonstrating grids-by-composition; a live `sizes()` echo; an interaction hint line; a demonstrable `minSize`. No modal (`ctx.execView` is `undefined` headlessly)
- [ ] 4.2.2 Register it — import + array entry in `packages/examples/kitchen-sink/stories/index.ts`
- [ ] 4.2.3 Run — verify **ST-26 PASSES** (green phase)

**Deliverables**:
- [ ] Story registered and rendering

**Verify**: `yarn verify`

### Step 4.3: Close-out

**Reference**: AR-20 · CLAUDE.md §Prime directive
**Objective**: Green tree, deferred work filed, PR-ready.

- [ ] 4.3.1 Full verification — `yarn verify`, plus `yarn check:deps` (no native deps) and `scripts/check-jsdoc.mjs` (every public export has an `@example`; no banned references). ⚠️ The banned-ref scanner has a known blind spot — also grep the new files directly for `RD-`/`codeops/`/`plans/` rather than trusting `check:docs` alone
- [ ] 4.3.2 File the AR-20 deferral as a GitHub issue — framework-wide hover support (mouse mode 1003 + a capability gate) · owner: gevik · revisit: when a second widget needs hover, or before `@jsvision/ui` v1.0
- [ ] 4.3.3 Run `yarn lint:fix` and commit whatever it changes — **the prime directive**: no PR-bound push goes out until this has run and the tree is clean. Commit/push via **/gitcmp**

**Deliverables**:
- [ ] `yarn verify` green · hover deferral filed · tree clean

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
