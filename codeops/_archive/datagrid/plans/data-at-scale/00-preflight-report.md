# Preflight Report: Data at Scale (datagrid/RD-11)

> **Status**: ✅ PASSED — all 11 findings resolved (0 critical, 5 major, 4 minor, 2 observation) · user accepted every recommendation · **resolutions applied to the plan docs** · iteration-2 re-scan clean
> **Iteration**: 2 (fixes applied + verified)
> **Iteration 2 notes**: all 11 accepted resolutions written into `00-index`, `01`, `02`, `03-01`, `03-02`, `03-03`, `03-04`, `07`, `99`, and the Ambiguity Register (AR-2/4/7/9/11 revised + a preflight note). Re-scan caught and fixed three edit-introduced items — a footer-blank mechanism ambiguity (`() => []` would fold to a misleading `'0'`), a stale ST-13/14 description in task 3.2, and a pre-existing task-count off-by-one (now 34) — with no new substantive findings. Verified: code fences balanced, no residual "range within loaded window" / "loaded-window fold" in any spec/task context, all nine docs cross-reference the report.
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/data-at-scale/`
> **Codebase Grounded**: ~20 source files examined across `@jsvision/datagrid` + `@jsvision/ui`; every `file:line` reference in the plan mapped to real code
> **Last Updated**: 2026-07-18
> **Review independence**: The Ambiguity Register notes same-session authoring. This preflight runs in a **fresh session** (post `/clear`), so the recommended independence is satisfied. The load-bearing architecture (AR-2/3) was additionally red-teamed during authoring; the un-gated-consumer gaps below are what that red-team did **not** catch.

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest (unit + e2e), zero runtime deps. Verify: `yarn verify`.
**Architecture:** `@jsvision/datagrid` adapts a `rowAt`/`length` `GridDataSource` into `@jsvision/ui`'s strictly-whole-array `GridRows` base. `EditableDataGrid` (a `Group`) owns a `display: () => T[]` derived (`grid.ts:415`) built by `materialize()` (`grid.ts:221`, dense, drops `undefined` holes) + client filter/sort skipped when the push-down seam exists. `EditableGridRows` (`editable-grid-rows.ts:203`) fully overrides `draw()` and paints only the visible window.
**Key files examined:** `grid.ts` (1472 ln), `editable-grid-rows.ts` (998), `data-source.ts` (154), `grid-selection.ts`, `grid-footer.ts`, `row-mutations.ts`, `synthetic-columns.ts`, `grid-panels.ts`; ui `grid-rows.ts` (462), `virtual.ts` (50); fixtures + smoke/security tests; showcase registries.

**Reference verification:** Effectively **every** `file:line` the plan cites was verified accurate (materialize 221-230, display 415-421, version 338, push-down 452-465, all full-scan consumer sites, all `data-source.ts` members, base read-sites, spike Proxy, fixtures, footer honesty tests, showcase oracle). The plan's grounding quality is high. The findings below are **gaps the grounding did not close**, not citation errors.

**Empirical Proxy behavior (verified by running the plan's exact `windowedView` shape):** an ungated `.map`/`.find`/`.findIndex`/spread/`for..of` on the windowed Proxy is **not** a benign `[]` — it **throws** on the first unloaded row (callback derefs `undefined`) or **full-scans/fetch-storms** (100k `rowAt` → 100k page fetches) if the callback tolerates `undefined`. This is the through-line of PF-001/002/003/006.

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 2 (PF-008, PF-007) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-002) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-001, PF-006) | 🟠 |
| 5 | Dependency Issues | 1 (PF-004) | 🟠 |
| 6 | Feasibility | 2 (PF-001, PF-003) | 🟠 |
| 9 | Edge Cases | 2 (PF-002, PF-010) | 🟠 |
| 11 | Ordering & Sequencing | 1 (PF-004) | 🟠 |
| 12 | Consistency | 2 (PF-005, PF-011) | 🟠 |
| 13 | Codebase Alignment | 5 (PF-001,002,003,005,006) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 5 | ✅ all resolved (accepted) |
| 🟡 MINOR | 4 | ✅ all resolved (accepted) |
| 🔵 OBSERVATION | 2 | ✅ all resolved (accepted) |

---

## PF-001: Windowed footer aggregate fold is underspecified and infeasible as written 🟠 MAJOR

**Dimension:** Completeness / Feasibility / Codebase Alignment
**Location:** `03-03-full-scan-consumer-guards.md` §Footer (AR-9); `07-testing-strategy.md` ST-13; `00-ambiguity-register.md` AR-9
**Codebase Evidence:** `grid-footer.ts:105` `this.displayedRows().map((row) => col.value(row))`; `grid.ts:500` `displayedRows: () => this.display()`; `FooterControllerConfig` (`grid-footer.ts:42-52`) exposes only `displayedRows` + `complete?` — **no** visible-window or loaded-range access; async source `rowAt` kicks `ensurePage` on a miss (`03-04`).

**The Problem:** AR-9 says the windowed footer should "fold the loaded window only." But (1) the plan adds only `revision?()` to the source contract — there is **no seam to discover which indices are loaded**; probing `rowAt(i)` to find them fetches on every miss. (2) `grid-footer.ts:105` `.map`s `display()`; on the windowed Proxy that throws (`col.value(undefined)`) or fetch-storms the whole dataset. (3) The footer controller has no access to the body's visible window. So task 3.5 cannot be built against the contract the plan defines — the executor hits the plan's own STOP gate. Even a `loadedRows()` seam is misleading: the source has **no eviction** (03-04), so a partial total drifts upward on scroll for no data reason. **ST-13 is an immutable oracle** encoding the infeasible "tripwire ≈ 50" expectation — it must be corrected at plan level *before* Phase 3 authors it.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Fold only the **visible window** — thread `topItem`/`visibleRows` from the body into the footer's `displayedRows` dep | live fold, no full scan | "sum of rows you can see" is a meaningless footer total; new body→footer wiring |
| B | Add a non-side-effecting `loadedRows()` accessor to the source; fold that | bounded, honest-ish | new contract member (beyond the plan's "only `revision?()`"); no-eviction ⇒ total drifts up on scroll |
| C | **Defer windowed footer aggregates to Phase B** — windowed ⇒ blank cell + one-time `devWarn`; rewrite ST-13 to assert the fold is **not invoked** (tripwire flat) and the cell is blank | simplest, honest, no new seam, matches the plan's own deferral of the server grand-total | no live windowed aggregate in v1 |

**Recommendation:** **Option C.** A/B both surface a total that misleads (visible-only, or monotonic drift under no-eviction), and the plan already defers server grand-totals to Phase B (`03-03`). C is the only honest v1 answer. Fix must update AR-9, `03-03` §Footer, and **rewrite ST-13** in `07`.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED (blocking); reinforced the no-eviction drift argument and the ST-13 immutability hazard.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-002: Windowed Ctrl/Shift-click selection is broken and crash-prone (contradicts the plan's own gating) 🟠 MAJOR

**Dimension:** Logical Contradiction / Edge Cases / Codebase Alignment
**Location:** `03-03` §Selection (AR-4); `07` ST-14; AR-4
**Codebase Evidence:** `grid-selection.ts:159` `displayKeys() { return this.display().map(this.rowKey); }` — reached by `selectAllDisplayed()` (:84), `currentTriState()` (:89), **and `extend()`** (:153); `rangeToRow()` (:126) calls `extend()`. `toggleAtRow`/`rangeToRow`/`focusedKey` call `rowKey(rows[i])` with `rows[i] = rowAt(i)`. `handleSelectionClick` (`editable-grid-rows.ts:559-575`) computes `rowIndex` with **no `rowAt!==undefined` guard**; `runToggleSelect` (`:543-551`) feeds the focused row into `onToggleRow`.

**The Problem:** The plan gates `displayKeys()`/`display().map(rowKey)` OFF for select-all/tri-state but **keeps** Ctrl/Shift-click range — which routes through the **same** `displayKeys()` (`extend → displayKeys`). You cannot disable the method for one caller and keep it for another; on the windowed Proxy `.map(rowKey)` throws on the first unloaded row. Separately, a placeholder `…` row is painted *because* it is unloaded, yet is clickable: Ctrl-click / Shift-range / Space-toggle on it (or with focus on an unloaded row) calls `rowKey(undefined)` → **crash**. AR-4's rationale "clicked hence loaded" is false. **ST-14 (immutable)** asserts the broken "Shift-click still extends" behavior.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | **Disable Ctrl/Shift range + select-all + tri-state for windowed**; keep only single-row **keyed** toggle on a **loaded** row, guarded at the `GridSelection` controller choke points (`toggleAtRow`/`rangeToRow`/`focusedKey`/Space-toggle with `rowAt(i)!==undefined`); rewrite ST-14 | closes the crash + the contradiction at one choke point; keyed selection stays stable across scroll | no range gesture on windowed v1 |
| B | Keep range but add a windowed `displayKeys()` that enumerates all keys | preserves the gesture | requires scanning `rowAt(0..length())` ⇒ page-fault/fetch-storm — self-defeating |

**Recommendation:** **Option A.** B reintroduces the exact full-scan the feature avoids. Guard in the controller (single choke point covering click, keyboard Space-toggle, and the range fallback-anchor), not just `handleSelectionClick`. Update AR-4 and **rewrite ST-14** in `07`.
**Confidence:** High. **Hardening:** challenger CONFIRMED; widened the crash surface to Space-toggle (`runToggleSelect`) and the `rangeToRow` fallback-anchor, and flagged ST-14 immutability.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-003: `windowedView` should fail LOUD, and the push-down requirement should hard-fail (systemic hardening) 🟠 MAJOR

**Dimension:** Feasibility / Codebase Alignment (architecture)
**Location:** `03-01` §Lazy Proxy + §Type-honesty caveat; `03-03` §Push-down requirement (AR-7); the "02 full-scan table" note that re-anchor scans are "already guarded off — safe"
**Codebase Evidence:** `grid.ts:1234-1240` `applySort` and `grid.ts:1254-1261` `applyFilter` do `this.display().findIndex(...)` guarded **only** by `if (this.source.setSort/​setFilter) return;` — a condition **independent of `isWindowed`**. `data-source.ts` makes `setSort?`/`setFilter?` optional; the plan only `devWarn`s when a windowed source omits them (`03-03:15-22`), never blocks construction. Empirically, `findIndex` on the Proxy **throws** on the first unloaded row.

**The Problem:** The whole design's correctness rests on the "02" full-scan inventory being complete **and staying** complete — but the Proxy provides **zero** protection: any missed or future consumer silently crashes or fetch-storms in a *data-dependent* way (`Cannot read properties of undefined (reading 'id')` with no hint it's a windowing-gate bug). The re-anchor `.findIndex` sites are a concrete instance: a windowed source without push-down (constructable, only devWarned) + any sort/filter gesture → crash. The plan's "already guarded off — safe" is contingent on a requirement it does not enforce.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | **Make `windowedView`'s `get`/`has`/iterator traps throw** a descriptive error for any prop that isn't `length`, an integer index, or an explicit allowlist (incl. `Symbol.iterator`, `map`, `find`, …); **and hard-fail construction** (throw, not `devWarn`) when a windowed source omits `setSort`+`setFilter` | converts every gate omission (footer, selection, re-anchor, public readout, future) into a deterministic, **located**, load-independent test failure under the eager-vs-windowed matrix; ~zero runtime cost; strictly safer than silent-then-storm | must allowlist any legitimate base access (Agent B confirms the base uses only `.length`+index, so none expected) |
| B | Keep the silent Proxy; add `if (isWindowed) return;` before the two re-anchor scans only | minimal | leaves the systemic footgun for every other/future consumer; whack-a-mole |

**Recommendation:** **Option A.** This is the highest-leverage single change — it de-risks PF-001, PF-002, PF-006, the re-anchor crash, and any consumer not yet imagined, at essentially no cost. Keep push-down a **hard** construction failure for windowed (client sort/filter over partial data is meaningless). Requires a small addition to `03-01` (loud traps) and `03-03`/AR-7 (throw vs devWarn).
**Confidence:** High. **Hardening:** challenger proposed and I verified empirically (the plan's own `windowedView` JSDoc already says these ops are "intentionally NOT supported" — making them throw matches intent).

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-004: The async windowed-source fixture (and scan-tripwire) are scheduled *after* the spec tests that need them 🟠 MAJOR

**Dimension:** Dependency / Ordering
**Location:** `99-execution-plan.md` tasks 1.1/1.2 (Phase 1), 2.1/2.2 (Phase 2) vs 4.1/4.3 (Phase 4); `07` §Test doubles
**Codebase Evidence:** `test/fixtures/windowed-source.ts` is **eager** — every row present, `ensureRange` a no-op, no `revision` (verified). It cannot yield `undefined` holes (ST-2), a `revision` bump (ST-3), or a settle-able `ensureRange` (ST-5/6/7). `07` states ST-5…ST-18 are "driven by `asyncWindowedSource`," and task 1.1 says the Phase-1 tests use "the async source's tripwire."

**The Problem:** `asyncWindowedSource` is authored in Phase 4 (4.1 "write" + 4.3 "finalize"), yet Phase 1 ST-3 and Phase 2 ST-5/6/7 depend on it. Spec-first "red" for Phases 1–2 is blocked. The **scan-tripwire** double (`07:22`) is likewise needed from ST-1 but never explicitly scheduled.

**Recommendation (single viable path):** Add a **task 1.0** that authors the *full* `asyncWindowedSource` fixture **and** the scan-tripwire double before ST-1/ST-3, and drop the Phase-4 "write then finalize" split (Phases 2–3 need progressively more of its behavior — settle-able `ensureRange`, then push-down/`distinct` spies + `complete()` — so build it once). Considered and rejected: authoring throwaway inline doubles per phase (duplicative, and the plan already commits to the shared fixture).
**Confidence:** High. **Hardening:** challenger CONFIRMED; added the tripwire-scheduling gap and the write/finalize-merge refinement.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-005: Kitchen-sink story is added to one registry but gated by a different registry's smoke test 🟠 MAJOR

**Dimension:** Consistency / Codebase Alignment
**Location:** `03-04` §Kitchen-sink story (task 4.5); `02-current-state.md` §Test & story surface; `07` ST-21
**Codebase Evidence:** `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts:11` imports `./kitchen-sink/stories/index.js` → the **datagrid-local** registry `packages/datagrid/test/kitchen-sink/stories/` (per-RD files: `foundation.story.ts` … `validation-lifecycle.story.ts`). The plan adds the story to `packages/examples/kitchen-sink/stories/` (a **different** package, gated by `packages/examples/test/kitchen-sink.smoke.spec.test.ts`).

**The Problem:** A relative import in the datagrid smoke test cannot see a story in the examples package. Following the plan literally, ST-21 "passes" vacuously (the datagrid registry is unchanged) → false confidence on a NON-NEGOTIABLE gate. The mispairing is repeated in `02` and `03-04`, so it is baked in, not a typo.

**Recommendation (single viable path):** Retarget task 4.5 (and the `02`/`07` references) to `packages/datagrid/test/kitchen-sink/stories/data-at-scale.story.ts` + that `stories/index.ts`, gated by `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` — matching the RD-01…12 per-RD precedent. **No showcase coverage is lost:** task 4.6 already builds the richer `packages/examples/datagrid-showcase/` "Data at scale" cluster (its own walkthrough gate). Only task 4.5's target directory changes.
**Confidence:** High. **Hardening:** challenger CONFIRMED both sides; confirmed no examples-side loss because 4.6 covers it.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-006: Public `displayedRows()` returns a length/index-only Proxy under a `readonly T[]` JSDoc contract 🟡 MINOR

**Dimension:** Codebase Alignment / Completeness
**Location:** `03-01`/`03-03` (windowed `display()`); not addressed for the public readout
**Codebase Evidence:** `grid.ts:906-908` `displayedRows(): readonly T[] { return this.display(); }` is a **public, documented** reactive readout (JSDoc: "the loaded/in-memory set the footer aggregates fold over"). For windowed it hands out the Proxy; `grid.displayedRows().map(...)` / spread / `JSON.stringify` throws or fetch-storms while `.length` reports 100000.

**The Problem:** This repo's "JSDoc is the contract" rule is NON-NEGOTIABLE; a `readonly T[]` that crashes on `.map` is a contract violation for windowed grids. The plan gates internal consumers but never the public surface.

**Recommendation (single viable path):** Under the loud-Proxy resolution (PF-003), **correct the public JSDoc** to state the windowed limitation (`.length` + integer indexing only; whole-array ops throw), or return a bounded materialized view for windowed if a real array is wanted. Recommend the doc fix (cheapest, honest) + cross-reference PF-003. Considered and rejected: leaving it silent (violates the JSDoc-is-contract gate).
**Confidence:** Med-High. **Hardening:** challenger raised the JSDoc-is-contract angle explicitly.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-007: Placeholder role should be applied fg-only, not as a full (sunken-bg) role 🟡 MINOR

**Dimension:** Ambiguities / Codebase Alignment
**Location:** `03-02` §Placeholder rendering (AR-6)
**Codebase Evidence:** `inputPlaceholder` default is `{ fg: foregroundMuted, bg: backgroundSunken }` (`core/.../roles.ts:72`) — a **field** bg. `ui/.../input-render.ts:101` uses only `ctx.color('inputPlaceholder').fg`. The plan's own precedence note says the row band (focused/zebra/normal) still paints and the `…` "replaces only the cell text."

**The Problem:** "paint the `…` in the `inputPlaceholder` role" is ambiguous — using the role's bg would paint a sunken-field bg on placeholder cells, clashing with the row band. The precedence note implies fg-only but doesn't say so.

**Recommendation:** State explicitly in `03-02`: compose `ctx.color('inputPlaceholder').fg` over the **row-band bg**, matching `input-render.ts:101` — never the role's own bg. (`inputPlaceholder` is confirmed a real core role, resolvable by a datagrid cell painter, needing no new role and no allowlist edit — first datagrid use.)
**Confidence:** High.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-008: `prefetch` default ("one viewport") is dynamic and cannot be a static option default 🟡 MINOR

**Dimension:** Ambiguities
**Location:** `03-02` §Driving ensureRange (`prefetch?: number`, AR-11); task 2.4
**The Problem:** Viewport height is dynamic, so `prefetch?: number` cannot carry a static default of "one viewport." `requestWindow` reads `this.prefetch` as a row count.

**Recommendation:** Specify that `prefetch` **unset** ⇒ buffer = current `visibleRows`, computed per-draw (the option overrides with a fixed row count when set). Clarify the `undefined` sentinel in `03-02` + task 2.4.
**Confidence:** High.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-009: ST-15's "filtered vs grand total" expectation is incoherent given a single `length()` 🟡 MINOR

**Dimension:** Consistency / Testability
**Location:** `07` ST-15; `03-03` §Counts (AR-10)
**Codebase Evidence:** `filteredCount()` (`grid.ts:886`) and `totalCount()` (`grid.ts:896`) **both** read `source.length()`. `03-03:78` documents "filtered ≡ grand total" as a v1 limitation.

**The Problem:** ST-15 expects `filteredCount()===source.length()===4000` after a pushed-down filter, but `totalCount()` then also reports 4000, collapsing the "N of M" readout's M. ST-15's given/expect doesn't define what M means post-filter.

**Recommendation:** Reword ST-15 to assert the documented v1 limitation explicitly (post-filter, M is the filtered total; a distinct grand total is Phase B), so the immutable oracle doesn't encode an undefined M.
**Confidence:** Med. **Hardening:** challenger flagged as a runner-up.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-010: Per-frame coalescing via `queueMicrotask` may not bound to ≤1 per *frame* for multi-task bursts 🔵 OBSERVATION

**Dimension:** Edge Cases
**Location:** `03-02` §Per-frame coalescing (AR-11); RD AC-5/AC-8; task 2.7
**The Problem:** `queueMicrotask` flushes at end of the current **task**. A scrollbar drag or key-repeat where each event is its own task fires one `ensureRange` per task within a frame — ≤1 per task, not necessarily ≤1 per frame. The settled-window de-dup only helps when the target window repeats.

**Recommendation:** No plan change required — the plan already flags scheduler reconciliation at task 2.7 and states the invariant is "≤1 per settle per frame." Noting it so the reconciliation explicitly checks multi-task bursts against the real event loop (a rAF/repaint-cadence primitive may be needed).

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## PF-011: `filteredCount` is mislabeled as a full-scan consumer (harmless) 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** `02-current-state.md` full-scan table; AR-10
**Codebase Evidence:** `grid.ts:886` `return this.display().length;` — `.length`-only, already correct on the Proxy.

**The Problem:** The "02" table + AR-10 list `filteredCount` among full-scan consumers "to be gated," but it only reads `.length` (maps to `source.length()`), which the Proxy serves unmodified. The AR-10 change (read `source.length()` directly) is harmless belt-and-suspenders, not a required gate.

**Recommendation:** Optional — note in `02`/AR-10 that `filteredCount` is safe-on-Proxy (a `.length` read), to keep the inventory's "full-scan vs safe" classification precise.

**User Decision:** Resolved — User accepted recommendation (2026-07-18).

---

## Adversarial-question checklist (same-agent bias)

- **Assumption I might have confirmed unconsciously:** that the Proxy "safely" degrades. It does **not** — empirically it throws/fetch-storms (PF-003). Corrected.
- **External standard risk:** ES `Array.prototype` receiver semantics — verified by running the exact Proxy, not from memory.
- **What a dissenting expert would flag:** "your gate inventory is a manual allowlist with no fail-safe" → PF-003.
