# Preflight Report: DSL Hardening

> **Status**: ✅ PASSED — all 7 findings resolved (user accepted recommendations). Fixes APPLIED to the plan docs 2026-07-19.
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation Plan at `codeops/features/dsl-hardening/plans/dsl-hardening/`
> **Codebase Grounded**: 9 source files + 6 test files examined; ~30 references verified
> **Last Updated**: 2026-07-19

Location note: the plan lives uncommitted in the sibling worktree `jsvision-dsl-hardening` (branch
`feat/dsl-hardening`, tip == `develop`); the code grounded against is identical to `develop`.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM-only (NodeNext, strict), yarn 1.x + Turborepo, vitest, zero runtime
deps. Verify = `yarn verify` + `yarn check:deps`.

**Architecture:** `@jsvision/ui` widget framework over the zero-dep `@jsvision/core` engine. The
layout DSL (`packages/ui/src/view/dsl.ts`, 442 lines) is thin sugar that constructs `Group`/`View`
and sets `.layout` props. The layout engine already supports `Size.fr.min` (clamped in
`normalizeSize`) and `position:'absolute'/'fill'` out-of-flow (`layout.ts`, `placeOutOfFlow`).

**Key Files Examined:** `view/dsl.ts`, `layout/types.ts`, `layout/layout.ts`, `split/split-view.ts`,
`view/index.ts`, `src/index.ts`, `view/reflow.ts`, `shared/warnings.ts`,
`test/layout-dsl.packaging.spec.test.ts`, `test/layout-dsl.spec.test.ts`.

**Verified clean:** every cited line/signature matches; `normalizeSize` floors negative `min`;
`center()`'s reliance on `view.centered` is correct (`reflow.ts:49`); `at`/`center` are free in the
barrel; S4 out-of-flow behavior is real; the `grow(v,2)` deep-equal specs stay green (conditional
`min` spread). **Contradicted:** the `fill` export ban, two `dsl.ts` path reads, and the
`grow`-merge-vs-replace claim (findings below).

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | ✅ resolved (Option B) |
| 🟠 MAJOR | 1 | ✅ resolved (Option A) |
| 🟡 MINOR | 4 | ✅ resolved |
| 🔵 OBSERVATION | 1 | ✅ resolved |

**Outcome:** all findings resolved by user-accepted recommendations, and the corresponding plan-doc
edits have been applied (2026-07-19): `fill()`→`cover()` across the set + AR-4/AR-12 revised; a new
Phase-1 task 1.1.7 repaths the packaging oracle for the split (total 31→32 tasks) + the "passes
unchanged" wording corrected; split-view additive-merge documented + ST-16 assertion; dev-warn routed
through `devWarn` + `WeakSet`; stack falsy coverage (ST-6) + signature-widening; `00-index` Related-Files
fixed. The plan is execution-ready.

---

### PF-001: Standalone `fill` export collides with an immutable oracle AND the `Flex.fill` shorthand 🔴 CRITICAL

**Dimension:** 13 Codebase Alignment (Convention/Redundancy) + 6 Feasibility
**Location:** `01-requirements.md` R4; `00-index.md` Quick Reference + Key Decisions; `03-03 §fill-center`; `07 ST-11`; `99 task 3.2.1`; AR-4/AR-12.
**Codebase Evidence:**
- `packages/ui/test/layout-dsl.packaging.spec.test.ts:52` — `expect((ui as Record<string, unknown>).fill).toBeUndefined();` (immutable oracle) + header ban comment `:6-8`.
- `packages/ui/src/view/dsl.ts:39-40` — `Flex.fill?: boolean` = shorthand for `{kind:'fr',weight:1}` (grow), resolved in `toLayout` `:58-59`.

**The Problem:** The plan adds a standalone `fill()` (sets `position:'fill'`). (1) An immutable spec
oracle asserts `@jsvision/ui` must NOT export `fill` → `yarn verify` goes red; the ban is a
documented prior decision the plan never acknowledges. (2) `Flex.fill` already means the OPPOSITE
(grow weight 1). Shipping both institutionalizes two contradictory meanings of `fill`. AR-12
"verified free" checked only the barrel, missing both.

**Options:** A) reverse the ban (edit the oracle, risks a breaking `Flex.fill` rename) · **B) rename
the builder to `cover()`** · D) drop the builder.

**Recommendation:** Option B — `cover()`. Keeps the oracle literally true (zero sign-off), honors the
ban, one meaning per name; keeps the capability.
`Confidence: High. Hardening: changed pick A→B after challenge. Challenger: converged (independently recommended cover()).`

**User Decision:** ✅ Resolved — User accepted recommendation: **Option B**. Rename `fill`→`cover()`
across R4 / 00-index / 03-03 / 07 / 99 + the barrel; add a JSDoc note linking `Flex.fill` ↔ `cover()`.

---

### PF-002: The `dsl/` split breaks two path-based assertions in the same immutable oracle 🟠 MAJOR

**Dimension:** 3 Logical Contradiction + 13 Test Impact
**Location:** `03-01-module-split.md`; `07 ST-REF`; `99 task 1.1.5/1.1.6`; `00-index.md` Overview.
**Codebase Evidence:** `layout-dsl.packaging.spec.test.ts:59` & `:69` both `readFileSync('.../src/view/dsl.ts')` — banned-refs scan + ≤500-line budget. `view/index.ts:26-27` is the only importer.

**The Problem:** Phase 1 deletes `dsl.ts`; both `readFileSync` calls throw ENOENT. ST-REF's "specs
pass unchanged / byte-identical" is impossible, and the plan has no task to update the oracle.

**Options:** **A) explicit Phase-1 task to repath the oracle** (glob `dsl/*.ts`, scan all, per-file
budget, assert old `dsl.ts` gone; signed-off) · B) thin `dsl.ts` shim (guts the check).

**Recommendation:** Option A, and first correct the false "passes unchanged" claim.
`Confidence: High. Challenger: converged (added glob/per-file/assert-old-gone refinements).`

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**. Add the Phase-1 oracle-repath
task (glob `dsl/*.ts` · scan every module for banned refs · per-file ≤500 budget · assert old
`dsl.ts` gone) as a signed-off refactor update; correct the "ST-REF passes unchanged / byte-identical"
wording in `03-01` / `07` / `00-index`.

---

### PF-003: split-view migration — `grow()` merges where the current code replaces 🟡 MINOR

**Dimension:** 2 Implicit Assumptions / 13 Stale Assumption
**Location:** `03-05-split-view-migration.md`; `99 task 5.1.2`.
**Codebase Evidence:** `split-view.ts:153` & `:185` `pane.layout = { size: {...} }` (replace); `dsl.ts:137` `grow` merges.

**The Problem:** A pane arriving with a prior `position` would drop out of flex flow under the merge.
The "behavior identical" claim is imprecise.

**Recommendation:** Option A — accept the merge (better behavior), reword the overclaim, add a
non-size-layout-preserved impl assertion.

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**. Keep `grow`'s merge;
reword `03-05` from "identical/exact semantics" to "additive-merge; panes must not pre-set `position`";
add the preservation assertion (extends ST-16 / the impl test).

---

### PF-004: Dev-warn bypasses the sanctioned `devWarn` helper; tracker should be a WeakSet 🟡 MINOR

**Dimension:** 13 Convention Violation / Redundancy
**Location:** `03-04 §dev-warn`; `99 task 4.2.2`.
**Codebase Evidence:** `shared/warnings.ts:25` `devWarn(scope, message)` (the single sanctioned
console sink; used by `menu/accelerators.ts`, `reactive/for.ts`, `reactive/owner.ts`). Plan writes a
raw `console.warn('[jsvision] …')` + inline guard, tracker a plain "set".

**Recommendation:** Route through `devWarn('layout'|'dsl', …)`; make `adoptedByStack` a `WeakSet`.

**User Decision:** ✅ Resolved — User accepted recommendation. Update `03-04 §dev-warn` + `99 task 4.2.2`
to call `devWarn(...)` and use a `WeakSet`.

---

### PF-005: R7 covers `stack()` falsy children but no ST-case verifies it; stack type-widening unstated 🟡 MINOR

**Dimension:** 4 Completeness / 7 Testability
**Location:** `01 R7`; `03-02 §falsy`; `07 ST-6`; `99 task 2.2.2`.
**Codebase Evidence:** `dsl.ts:311` `stack(...)` has its own layer loop (`:327`); a `false` layer
throws at `layer.layout = …`. `container` `:101/:117` also needs widening.

**Recommendation:** Add a stack falsy ST-case (or extend ST-6) and widen BOTH `container` and
`stack` element types to `View | null | undefined | false`.

**User Decision:** ✅ Resolved — User accepted recommendation. Add the stack falsy ST-case to `07`
(and `99 task 2.1.1`), and state the `stack()` signature-widening in `03-02 §falsy` / `99 task 2.2.2`.

---

### PF-006: `00-index.md` misattributes the S5 offset fields to `layout/types.ts` 🟡 MINOR

**Dimension:** 12 Consistency / 13 Phantom Reference
**Location:** `00-index.md` "Related Files".
**Codebase Evidence:** `Placement` is in `dsl.ts:199` (→ `dsl/stack.ts`), not `layout/types.ts`;
`02-current-state.md:26` and `03-04` agree "no engine type change".

**Recommendation:** Point the line at `Placement` in `dsl/stack.ts`; note `layout/types.ts` unchanged.

**User Decision:** ✅ Resolved — User accepted recommendation. Fix the `00-index.md` "Related Files"
line.

---

### PF-007: New test files diverge from the `layout-dsl*` suite naming 🔵 OBSERVATION

**Dimension:** 12 Consistency
**Location:** `07` / `99`.
**Codebase Evidence:** existing suite is `layout-dsl.{spec,impl,packaging}.test.ts`, `layout-dsl-stack.{spec,impl}.test.ts`.

**Recommendation:** Adopt `layout-dsl-*` for continuity, or consciously accept `dsl-*`.

**User Decision:** ✅ Resolved — User accepted recommendation. Proceed with the `dsl-*` naming (the
module is renamed to `dsl/`); renaming the existing `layout-dsl*` files for one convention is left as
an optional follow-up noted in `07`.
