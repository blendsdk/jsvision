# Preflight Report: Export & Layout Variants (RD-13)

> **Status**: ✅ PASSED — all 5 findings resolved (0 critical, 4 major, 1 minor); iteration-2 re-scan clean
> **Iteration**: 2 (execution-gate refresh against post-RD-11 code; iter-1 found 5, iter-2 verified fixes)
> **Resolution**: user chose "apply all per recommendation"; PF-003 → Option A (datagrid-local)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/export-import-personalization/`
> **Codebase Grounded**: 11 source + 6 test files examined; ~30 references verified
> **Last Updated**: 2026-07-18

⚠️ **SAME-LINEAGE REVIEW.** This plan was authored in the session lineage that now preflights it (the RD-11 execution session). Same-agent bias risk is elevated; a fully independent human/session pass remains advisable. Mitigation applied: one independent adversarial challenger re-verified all four MAJOR findings against the code before recommendations were recorded.

**Why this scan exists:** the plan itself scheduled an execution-gate preflight refresh (AR-2 / 99 §Execution-Gate Preflight) because RD-11 was being implemented concurrently and mutates `grid.ts` / `data-source.ts`. RD-11 has now landed. Every `file:line` in `02-current-state.md` was pinned to **post-RD-12** code; this scan re-verifies against **post-RD-11** code.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM, NodeNext), yarn 1.x + Turborepo, vitest; `@jsvision/datagrid` on `@jsvision/ui`, zero runtime deps.
**Architecture:** `EditableDataGrid` container (`grid.ts`) over pure model modules (`sort.ts`/`filter.ts`/`column-model.ts`/`aggregate.ts`); reactive signals; RD-11 added a windowed read path (`windowing.ts`) with a **fail-loud** lazy `windowedView` proxy and an `isWindowed` guard at every full-scan consumer.
**Key Files Examined:** `grid.ts` (1520 L), `windowing.ts`, `column-model.ts`, `column.ts`, `web/src/clipboard.ts`, `datagrid/test/kitchen-sink.smoke.spec.test.ts` + `kitchen-sink/stories/`, `examples/test/{kitchen-sink,datagrid-showcase}.smoke.spec.test.ts`, `datagrid-showcase/stories/placeholders.ts`, the three line-guard impl tests.

**Reference Verification:** ~30 references mapped — all cited symbols **exist** (no phantom references); **no** architecture/redundancy/dependency-reality problems. The defects are **drift**: line numbers, one behavior change (`displayedRows()` now fail-loud on windowed), and two test-oracle omissions RD-11 introduced.

**Verified intact (the plan's core premise holds):** RD-11's eager path is byte-identical, so `exportView`/variants over an eager `displayedRows()` behave exactly as specced. The four RD-11 seams that *could* have bitten export/variants were each checked and are benign: `revision?()` is a no-op on eager sources; `prefetch` is windowed-only; `applyVariant`'s sort/filter push-down rides the existing reactive `bind` on `sortKeys`/`filters` (fires however the signal is set); synthetic checkbox/gutter columns are render-injected and never in `columnOrder()`/`columnMap`, so AR-8's "excludes synthetic" stays accurate.

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 4 | ✅ all resolved |
| MINOR | 1 | ✅ resolved |
| OBSERVATION | 0 | — |

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 2 | Implicit Assumptions | PF-001 | 🟠 |
| 4 | Completeness Gaps | PF-002 | 🟠 |
| 12 | Consistency | PF-003 | 🟠 |
| 13 | Codebase Alignment | PF-001, PF-002, PF-003, PF-004, PF-005 | 🟠 |

---

### PF-001: `exportView` is not windowed-guarded → cryptic throw + false JSDoc 🟠 MAJOR

**Dimension:** 2 (Implicit Assumptions) / 13 (Stale Assumptions)
**Location:** `03-01-exporter.md` §Serialization rules + Integration Points; `99` task 1.2.2; `02-current-state.md` risk table ("Windowed export mistakenly assumed to work").
**Codebase Evidence:** `grid.ts:946-948` `displayedRows()` returns `this.display()`; `grid.ts:434` returns `windowedView(this.source)` when windowed; `windowing.ts:92-107` the proxy **throws** on `.map`/spread/`for..of` with a message naming `display()`. `serializeView` iterates rows (JSON `rows.map`, `03-01:68`; CSV/HTML/TSV likewise). The full-scan-guard convention exists: `autoFitColumn` → `if (this.windowed) return;` (`grid.ts:1060`), `distinctFor` → `if (this.windowed) { devWarn(...) }` (`grid.ts:1123`).
**The Problem:** The plan was written assuming windowed `displayedRows()` is "a lazy Proxy of the loaded window" you can serialize; RD-11 shipped it **fail-loud**. So `grid.exportView('csv')` on a windowed grid throws a generic *"windowed display() supports only .length and integer indexing"* — a public method failing with an error that names `display()`, not `exportView`. Worse, the plan mandates JSDoc that says exportView "exports the resident `displayedRows()`" (`02:108`, `03-01:84`, `03-03:26-28`) — which would ship a **factually wrong** contract.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `if (this.windowed) throw new Error('exportView is unsupported on a windowed source — export the loaded window via a follow-up')` (or `devWarn`+empty) in `exportView`, mirroring `autoFitColumn`/`distinctFor`; add a spec test; correct the JSDoc to state windowed is unsupported | Matches RD-11's every-consumer-guarded convention; clear located error on the public surface; doc matches behavior | +1 guard, +1 spec test |
| B | Leave the generic proxy throw; only reword the JSDoc | Minimal | Error names `display()` not `exportView`; breaks the guard convention |
| C | Implement loaded-window export now | Feature-complete | Directly contradicts AR-2 (windowed export deferred) — out of scope |

**Recommendation:** **Option A.** It is the only option consistent with RD-11's design (every full-scan consumer is `isWindowed`-gated) and it eliminates the doc-vs-behavior contradiction. C is out of scope by AR-2; B leaves a mislocated error and a convention break.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED (real defect; Option A).
**User Decision:** Resolved — User accepted recommendation: Option A (windowed guard + spec test + corrected JSDoc).

---

### PF-002: Removing the RD-13 showcase placeholder breaks smoke oracle ST-6 (unscheduled) 🟠 MAJOR

**Dimension:** 4 (Completeness Gaps) / 13 (Test Impact)
**Location:** `99` Step 3.2.2 ("Remove the RD-13 placeholder"); `03-03` §Showcase cluster. No task touches `datagrid-showcase.smoke.spec.test.ts`.
**Codebase Evidence:** `datagrid-showcase.smoke.spec.test.ts:67-70` ST-6 hard-asserts `roadmap.length === 2`; `placeholders.ts:40-51` the array is exactly `[RD-13, RD-14]`. Remove RD-13 → length 1 → **ST-6 red** at Step 3.3.1's full verify.
**The Problem:** RD-11's plan explicitly scheduled the identical oracle updates when it shipped its cluster (ST-6 3→2, etc.); this plan omits the paired update. This is a **guaranteed** verify failure the plan does not anticipate. The file's own comments bless the update ("a future RD adding a cluster updates this list", `:73,:90`), so it's anticipated maintenance, not an immutable-spec violation.
**Scope precision (challenger-refined):** Only **ST-6 hard-fails**. ST-5 is a subset check (`present.has(c)`, `:91-96`) and ST-7 asserts only enumerated categories (`:99-114`) — a *new* "Export & personalization" category is extra and passes both. So ST-5/ST-7 updates are **hygiene/coverage** (add the new category + its demo count), not blockers.

**Options:** Single corrective path (no viable alternative): add a task in Step 3.2 to update `datagrid-showcase.smoke.spec.test.ts` — **ST-6 `2 → 1`** (blocking), and add the new cluster to **ST-5**'s category list + **ST-7**'s counts (hygiene, matching the RD-11 precedent). Considered and rejected: "leave it" (ships a red build); "don't add the count assertions" (loses the per-cluster coverage every prior RD carries).

**Recommendation:** Add the ST-6/ST-5/ST-7 update task. Non-optional for ST-6.
**Confidence:** High. **Hardening:** challenger CONFIRMED ST-6 (guaranteed red); corrected my over-grouping of ST-5/ST-7 as failures — folded in above.
**User Decision:** Resolved — User accepted recommendation (add the ST-6 `2→1` + ST-5/ST-7 update task).

---

### PF-003: Kitchen-sink story mislocated to `examples/` — breaks the per-RD convention (RD-11 PF-005 repeat) 🟠 MAJOR

**Dimension:** 12 (Consistency) / 13 (Convention Violation)
**Location:** `03-03` §Kitchen-sink story + `99` Step 3.1.1 place the story at `packages/examples/kitchen-sink/stories/datagrid-export.story.ts`; yet `00-index.md:92-93` and ST-25 (`07:70,85`) name the **datagrid-local** `test/kitchen-sink.smoke.spec.test.ts`.
**Codebase Evidence:** All 13 per-RD datagrid stories (foundation…`data-at-scale.story.ts`) live in `packages/datagrid/test/kitchen-sink/stories/`, gated by `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` (reads `./kitchen-sink/stories/index.js`). The examples smoke test (`packages/examples/test/kitchen-sink.smoke.spec.test.ts`) asserts no count (generic loop + named-id checks, `:48-61`). RD-11's own preflight PF-005 caught this exact examples-vs-datagrid-local mistake and retargeted.
**The Problem:** The plan is **internally contradictory**: it places the story in the examples registry but names the datagrid-local smoke test as its gate (ST-25). Executed literally, the story lands in examples (where the generic examples smoke would pass it), while the datagrid-local ST-25 the plan claims covers it never sees it — and the RD-13 story diverges from where RD-01…RD-12 (incl. RD-11) put theirs. Softest of the four: **no hard verify failure**, but a real convention/consistency defect and a self-contradiction.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Retarget to `packages/datagrid/test/kitchen-sink/stories/datagrid-export.story.ts` + register in that index; gate = datagrid-local ST-25 | Matches every prior RD incl. RD-11; resolves the plan's internal contradiction | none material |
| B | Keep in examples; fix ST-25/`00-index` to name the examples smoke test instead | Also internally consistent | Breaks the per-RD convention; the RD-13 story sits apart from RD-01…12 |

**Recommendation:** **Option A.** It is what RD-11's PF-005 concluded for the identical case, keeps the per-RD series together, and needs no oracle rewrite.
**Confidence:** High. **Hardening:** challenger CONFIRMED (convention violation + internal contradiction; softest of the four; Option A).
**User Decision:** Resolved — User chose Option A (datagrid-local registry).

---

### PF-004: Line-budget citations stale + guard-test file misidentified 🟠 MAJOR

**Dimension:** 13 (Scope vs. Reality / Test Impact)
**Location:** `00-index:31`, `01-requirements:81` (AC #10), `02:81-85,106`, `07:94`, `99:108,173` (Success Criterion #7), `00-ambiguity-register` AR-15 — all cite grid.ts **1472** / guard **`< 1500`**; Step 2.3.2 (`99:108`) + `07:94` name **`grid.impl.test.ts`** as the guard site.
**Codebase Evidence:** grid.ts is **1520**; the guard is **`< 1550`** (RD-11 re-based) in **three** files — `grid-footer.impl.test.ts:78`, `navigation.impl.test.ts:144`, `grid-selection.impl.test.ts:190`. `grid.impl.test.ts` has **no** line guard (its `toBeLessThan` hits are unrelated `< 60` bounds).
**The Problem:** Two compounding errors. (1) **Numbers**: 30 lines of headroom (1550−1520), and the plan adds four documented public methods (`exportView`/`saveVariant`/`applyVariant`/`setFrozen` — each with lead JSDoc + `@param`/`@returns` + the `@example` the plan itself commits to, ~18-25 L apiece) plus `freezeSpec`→signal and `applyVariant`'s non-trivial restore body → realistically ~75-105 lines. A guard re-base (→ ~1600) is **near-certain**, yet Success Criterion #7 and AC #10 assert "< 1500". (2) **Wrong file (challenger-amplified)**: an executor following Step 2.3.2 opens `grid.impl.test.ts`, finds no guard; the guard is in three *other* files and **all three** must be re-based together or two stay red. *(Precision: `check:docs` enforces `@example` on the exported class, not per-method — but the plan independently commits to per-method examples, so the budget conclusion stands.)*

**Options:** Single corrective path: update every citation to **1520 / `< 1550`**; point the re-base task at the **three** guard files (`grid-footer`/`navigation`/`grid-selection` `.impl.test.ts`), not `grid.impl.test.ts`; restate Success Criterion #7 + AC #10 as "under `< 1550`, re-based with rationale to ~1600 following the RD-11/RD-12 precedent if the irreducible public surface crosses it." Considered and rejected: "keep the thin-delegator claim without a re-base" — not achievable in 30 lines for four documented methods.

**Recommendation:** Apply the correction above. The re-base is legitimate and precedented (RD-10/RD-12/RD-11 each did it); the plan just needs the right numbers and the right files.
**Confidence:** High. **Hardening:** challenger CONFIRMED every sub-claim and flagged the three-files amplification.
**User Decision:** Resolved — User accepted recommendation (correct numbers to 1520/<1550, point at the 3 guard files, restate success criteria).

---

### PF-005: All `02`/`03` `file:line` citations drifted +~35-50 lines 🟡 MINOR

**Dimension:** 13 (Stale Assumptions — citation freshness)
**Location:** `02-current-state.md` tables + `03-01`/`03-02` inline cites.
**Codebase Evidence (old → current):** `displayedRows` 906→**946**; `columnOrder` 916→**956**; `columnWidth` 966→**1006**; `frozen` 1007→**1047**; `sort` 835→**868**; `filterModel` 873→**906**; `setColumnOrder` 927→**967** (reject logic 929-932→**969-972**); `setColumnWidth` 977→**1017**; `setColumnVisible` 993→**1033**; `columnMap` 383→**392**; `columnOrderSig` 364→**373**; `hidden` 366→**375**; `freezeSpec` decl 367→**376**, set 404→**417**; `partitionSig` read 445→**472**; `rawPartition`/over-freeze 666/674→**699/707/709**; hidden-keeps-filter 986-988→~**1030**; `placeholders.ts` RD-13 47-49→**41-45**. `column-model.ts` partition (behavior "ignores ids not present/visible") verified at `column-model.ts:61-72` (plan's `:78-91` slightly off but the claim holds). `web/src/clipboard.ts:20` guard verified accurate.
**The Problem:** Pure drift from RD-11's +48 lines — **every symbol still exists and behaves as described** (except `displayedRows()`, covered by PF-001). No behavioral impact; refresh the citation block so an executor navigating by line number lands correctly.
**Recommendation:** Refresh the citation numbers in `02`/`03` (bundle with the PF-001/PF-004 edits). Non-blocking.
**User Decision:** Resolved — User accepted recommendation (refresh the citation block).

---

## Pass/Fail

**Final: ✅ PASSED** (iteration 2). All 4 MAJOR + 1 MINOR resolved and applied to the plan docs; RD-13 is cleared to execute. No CRITICAL findings; the eager-path core premise is verified intact.

### Iteration 2 — fix verification (2026-07-18)

User chose **"apply all per recommendation"** (PF-003 → Option A). Fixes applied across all 8 plan docs and re-verified:

| Finding | Fix applied | Verified |
|---|---|---|
| PF-001 | `exportView` hard-guards windowed (`if (this.windowed) throw`, mirroring `autoFitColumn`@1060/`distinctFor`@1123) + new spec **ST-26** (1.1.1) + guard in task 1.2.2 + corrected JSDoc/AR-2/risk table | ✅ |
| PF-002 | New task **3.2.3**: `datagrid-showcase.smoke.spec.test.ts` ST-6 `2→1` (blocking) + ST-5/ST-7 coverage; documented in 03-03 | ✅ |
| PF-003 | Story retargeted to `packages/datagrid/test/kitchen-sink/stories/` (03-03, 99 §3.1, 00-index) — the datagrid-local registry every per-RD story uses | ✅ |
| PF-004 | Numbers → **1520 / < 1550** everywhere (00-index, 01, 02, 07, 99, AR-15); guard-test target corrected to the **three** files (`grid-selection`/`grid-footer`/`navigation` `.impl`), not `grid.impl.test.ts`; re-base-to-~1600 expectation stated; Success Criterion #7 + AC #10 restated | ✅ |
| PF-005 | Every `02`/`03`/AR `file:line` refreshed; **all 33 grid.ts citations cross-checked against live source** — each maps to its correct symbol | ✅ |

**Regression check:** no new inconsistency introduced — task count (28) and Phase-3 count (7) consistent; ST-26 referenced consistently across 07/99; story location consistent across 00-index/03-03/99; no plan doc still points the story at `examples/kitchen-sink`; no surviving `1472`/`< 1500` outside this report's own defect description.

**Task count:** the plan grew **27 → 28** (added task 3.2.3 for the showcase smoke-oracle update); ST cases grew to include **ST-26**.
