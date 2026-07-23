# Preflight Report: non-functional-closeout

> **Status**: ✅ PASSED — all 6 findings resolved via accepted recommendations; fixes applied to the plan
> **Iteration**: 1 (first scan)
> **Artifact**: implementation plan at `codeops/features/datagrid/plans/non-functional-closeout/`
> **Codebase Grounded**: ~22 source/test/config files examined; ~30 references verified (all `file:line` citations accurate)
> **Last Updated**: 2026-07-18

Not a same-session authorship (plan loaded from disk). MAJOR/CRITICAL batch hardened by one independent challenger (converged on all three; Finding PF-002 empirically proven via typecheck spikes). User accepted all recommendations 2026-07-18; fixes applied the same day.

### Codebase Context Summary

**Tech Stack:** TypeScript ESM/NodeNext, strict, zero runtime deps, vitest (unit+e2e), `@xterm/headless` (dev-only).
**Architecture:** datagrid renders on ui/core; grid state conveyed by dedicated **color** theme roles (`gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`) painted via `ctx.color(role)`; mono handled by `serialize` color-downsampling; a separate `monochromeTheme` distinguishes state by text attributes.
**Key files:** core `golden-screen-helpers.ts`, `presets.ts`, `glyphs.ts`, `render-root.ts`, `frame-bench.mjs`; datagrid `editable-grid-rows.ts`, `sort-header.ts`, `column.ts`, `sort.ts`, `data-source.ts`, both tsconfigs; `RD-14-non-functional.md`.

### Summary by Severity

| Severity | Count | Status |
|---|---|---|
| 🔴 CRITICAL | 1 | ✅ resolved (Option A) |
| 🟠 MAJOR | 2 | ✅ resolved (both Option A) |
| 🟡 MINOR | 2 | ✅ resolved |
| 🔵 OBSERVATION | 1 | ✅ resolved (constraint added to task 1.1) |

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|---|---|---|
| 4 | Completeness Gaps | PF-006 | 🔵 |
| 6 | Feasibility | PF-002 | 🔴 |
| 7 | Testability | PF-001, PF-003, PF-005 | 🟠 |
| 13 | Codebase Alignment | PF-001, PF-002, PF-003, PF-004 | 🔴 |

---

### PF-001: ST-2 mono a11y oracle asserts a mechanism the grid does not use 🟠 MAJOR

**Dimension:** Testability / Codebase Alignment (Stale Assumption)
**Location:** `03-01-golden-screen-a11y.md` §"The matrix" ST-2; `01-requirements.md` §In-scope #1; `07-testing-strategy.md` ST-2 row
**Codebase Evidence:** `packages/core/engine/color/presets.ts:122-125`; `packages/ui/src/view/render-root.ts:258`; `packages/datagrid/src/editable-grid-rows.ts:883,997,1070,1107`; `packages/datagrid/test/grid-theme.spec.test.ts:27-46`
**The Problem:** ST-2 asserts that under mono the focused (`gridCursor`) and selected (`gridSelectedRow`) cells stay distinguishable via `reverseState(...) === true`. But ST-2 mounts with no explicit theme → `createRenderRoot` resolves **`defaultTheme`**, whose grid roles are pure `{fg,bg}` colors with **no `attrs`** — under mono those downsample to terminal-default and no reverse attribute is emitted, so `reverseState()===true` cannot hold. The grid uses **three different** mono mechanisms (cursor/invalid → reverse; selected → **bold**; dirty → glyph-presence), so the oracle is wrong even under `monochromeTheme`. RD-14 AC-3 only requires the grid to "render correctly" under NO_COLOR.

**Recommendation:** Option A — reframe ST-2 to AC-3's literal requirement under defaultTheme+mono (role cells emit no color + render intact; drop the `reverseState` claim). Option B (a monochromeTheme half with per-role reverse/bold/glyph) was available but declined in favor of the in-scope floor.
*Confidence: Med. Challenger: converged (mild divergence on A-floor vs B-superset emphasis).*

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**. Applied to `03-01`, `07`, `01`.

---

### PF-002: Cross-package test-only imports fail datagrid's typecheck (proven) — the plan cannot reach "verify green" as written 🔴 CRITICAL

**Dimension:** Feasibility / Dependency Reality
**Location:** `03-01-golden-screen-a11y.md` §"Harness reuse (AR-4)"; `03-02-perf-and-bytes.md` ST-4 import; `99-execution-plan.md` task 0.1; `00-ambiguity-register.md` AR-4/AR-7
**Codebase Evidence:** `packages/datagrid/tsconfig.typecheck.json` (`include:["src","test"]`, `rootDir:"."`, no `allowJs`) vs `packages/core/tsconfig.json` (`include:["src"]` — core never typechecks its own `test/`/`bench/`); `packages/core/bench/frame-bench.mjs` (plain JS, no `.d.ts`)
**The Problem:** Datagrid typechecks `test/` under `rootDir:"."` with no `allowJs`. Challenger spikes against `yarn workspace @jsvision/datagrid typecheck`: the `.mjs` import → **`TS7016`**, the cross-package `.ts` import → **`TS6059`**, both exit 2 even with `noEmit`. Core avoids this only because it never typechecks its tests. Phase-0 task 0.1 verified only runtime resolution; "verify green" runs typecheck, so the plan walls out at the first verify (tasks 1.2/1.3, 2.2).

**Recommendation:** Option A — rework Phase 0 into a real typecheck spike, then fix the config by **excluding** the three cross-package-importing specs (`golden-screen`, `a11y-golden`, `perf-grid-bench`) from `tsconfig.typecheck.json`, mirroring core's posture. `render-bytes-damage` and `callback-isolation` specs stay typechecked (no cross-package import).
*Confidence: High on the blocker (proven); Med on the exact config fix (the spike confirms). Challenger: converged.*

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**. Applied to `99` (Phase 0 reworked, task 0.2 added), `03-01`, `03-02`.

---

### PF-003: ST-3's `boxDrawing:false` is the wrong lever — it doesn't ASCII-degrade the grid's decorative glyphs 🟠 MAJOR

**Dimension:** Testability / Codebase Alignment / Logical Contradiction
**Location:** `03-01-golden-screen-a11y.md` §"The matrix" ST-3; `00-ambiguity-register.md` AR-11; `07-testing-strategy.md` ST-3 row
**Codebase Evidence:** `packages/core/engine/render/glyphs.ts:49-58,92-110` (AMBIGUOUS_FALLBACK gated on `ambiguousWide`); `packages/core/engine/capability/defaults.ts:31` (`ambiguousWide:false` by default); `packages/datagrid/src/editable-grid-rows.ts:1070` (`•` U+2022); `packages/datagrid/src/sort-header.ts:26-29` (`▲`/`▼`/funnel `▽` U+25BD)
**The Problem:** `boxDrawing:false` converts only box glyphs; `•`/`▲`/`▼` need `ambiguousWide:true`, and funnel `▽`/ellipsis `…` have no fallback at all. Since ST-1 requires a gridDirty `•` in the shared fixture, ST-3's "no non-ASCII chrome" scan reds on that `•` — wrong lever, not a product gap. The plan's "conservative default profile" alternative would not work (that profile has `ambiguousWide:false`).

**Recommendation:** Option A — set ST-3 caps to `{boxDrawing:false, ambiguousWide:true}` and keep the ST-3 fixture free of funnel/ellipsis; record `▽`/`…` as a known no-fallback limitation rather than opening a core glyph-map task in this closeout.
*Confidence: High on the lever; fixture breadth is a scope call (resolved in-scope). Challenger: converged.*

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**. Applied to `03-01`, `07`.

---

### PF-004: `03-02` `fromRows(rows)` sketch uses the wrong signature 🟡 MINOR

**Dimension:** Codebase Alignment (Stale Assumption)
**Location:** `03-02-perf-and-bytes.md` §"Shared fixture" code block
**Codebase Evidence:** `packages/datagrid/src/data-source.ts:93` — `fromRows<T>(rows: Signal<T[]>, opts: { rowKey })`; `columns-layout.story.ts:38`
**The Problem:** The sketch shows `source: fromRows(rows)` — but `fromRows` requires a `Signal<T[]>` and a `{ rowKey }` arg.

**Recommendation:** Correct the sketch to `fromRows(signal(rows), { rowKey })`.
*Confidence: High.*

**User Decision:** ✅ Resolved — User accepted recommendation. Applied to `03-02`.

---

### PF-005: ST-4 bench — the timed region is ambiguous ("mount + serialize" vs "sample() discipline") 🟡 MINOR

**Dimension:** Testability
**Location:** `03-02-perf-and-bytes.md` §ST-4 code comment
**Codebase Evidence:** `packages/core/bench/frame-bench.mjs:131` (`measureComposeDiff` times compose+diff, not construction); RD-14 AC-1 = "Frame compose+diff (60×22)"
**The Problem:** "time `mount + rr.serialize()` per iter" folds grid construction into the measurement — more than AC-1's "compose+diff."

**Recommendation:** Build the grid once outside the loop; time re-compose+`serialize()` per iter, excluding construction.
*Confidence: High.*

**User Decision:** ✅ Resolved — User accepted recommendation. Applied to `03-02`.

---

### PF-006: Golden fixture — the four role cells must be non-overlapping, and ST-1 must read the right channel per role 🔵 OBSERVATION

**Dimension:** Completeness Gaps
**Location:** `03-01-golden-screen-a11y.md` §"The fixture grid"; `99-execution-plan.md` task 1.1
**Codebase Evidence:** `packages/datagrid/src/editable-grid-rows.ts:927` (precedence cursor > gridInvalid > gridDirty), :997 (gridInvalid needs a failed-validation cell), :1070 (gridDirty is a fg-only `•`)
**The Problem:** Same-cell overlaps mask a role from ST-1's read; gridInvalid needs a validator + failed commit; gridDirty must be read on its fg channel.

**Recommendation:** Note the constraint in task 1.1 (non-overlapping role cells; per-role channel; gridInvalid needs validator+failed commit).
*Confidence: High.*

**User Decision:** ✅ Resolved — Constraint added to `03-01` and task 1.1 in `99`.

---

## Determination

✅ **PREFLIGHT PASSED** — all 6 findings resolved via accepted recommendations; fixes applied to the plan.

**Note on PF-002 (CRITICAL):** its resolution is a plan-level change (Phase 0 now gates on an actual typecheck spike + a `tsconfig.typecheck.json` exclusion). The *real* green is confirmed when that spike runs during execution — the plan no longer walks blindly into the proven typecheck wall. Recommend a light iteration-2 re-scan after exec Phase 0 confirms the config fix, or proceed to `exec_plan`.
