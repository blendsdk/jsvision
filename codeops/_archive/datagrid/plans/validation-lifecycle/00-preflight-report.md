# Preflight Report: Validation & Lifecycle (datagrid/RD-12)

> **Status**: ✅ PASSED — all 7 findings resolved (fixes applied 2026-07-17)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/validation-lifecycle/`
> **Codebase Grounded**: 15 source files examined, ~50 `file:line` references verified
> **Last Updated**: 2026-07-17

> **Resolution:** user chose "apply all fixes". All 7 findings' recommendations were applied to the
> plan documents (`03-01`, `03-02`, `03-03`, `03-04`, `01-requirements`, `02-current-state`,
> `00-ambiguity-register` AR-7, `07-testing-strategy` incl. new spec case ST-24, `99-execution-plan`).

> ℹ️ **Prior-session artifact.** The plan was authored in an earlier session (2026-07-17 19:21–19:33);
> this scan runs in a fresh `/clear`'d session, so same-*session* bias risk is not elevated. Standard
> same-agent-family caution still applies — findings below were verified against the code, and the two
> MAJOR findings were additionally confirmed by an independent challenger agent reading the source cold.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/datagrid` is an editable data grid layered on `@jsvision/ui` (widget framework) over `@jsvision/core` (zero-dep TUI engine). The grid splits a thin **container** (`grid.ts`, options + delegators) from a **body** (`editable-grid-rows.ts`, cursor/geometry/paint) that implements the `EditHost` seam the `editing.ts` commit controller drives. Reactivity = bare signals + view `bind()`; no owned `computed`.
**Key Files Examined:** `datagrid/src/{editing,commit,column,cell-draw,data-source,editable-grid-rows,grid,grid-panels}.ts`; `core/src/engine/color/{theme,roles,presets}.ts`; `core/src/engine/safety/sanitize.ts`; `ui/src/view/draw-context.ts`; `ui/src/controls/text.ts`; `ui/src/feedback/run-spinner.ts`; the line-guard + spec tests.

**Reference Verification:** The plan's grounding is unusually accurate. Verified exact: `grid.ts` = 1298 lines; `commitValue` at `editing.ts:291-326`, PARSE_FAILED at :304, the "richer field validation layers on top" hook comment; `commitCell` at `commit.ts:58-81` + the single revert path at :79; `createDirtyRegistry` / `cellKey` / `EditHost`; every `editable-grid-rows.ts` anchor (runAction :401, precedence :650, `<empty>` :674, gridSelectedRow band :708, CellState.dirty :742, final overpaints :755-756, paintDirtyMarkers :767, dirty bind :295); every `grid.ts` anchor (dirty :274, threading :488/:494, isRowDirty :597, filteredCount :714, totalCount :720, focusedRow :1119, focusedKey :1130, advanceCell :1192); grid-panels footer widget row :583-590; all three core grid roles across `theme.ts` (:221/:227/:236, :376-378), `roles.ts` (:103-112), `presets.ts` (:122-124); the count oracle `severity-text-theme.spec.test.ts:32` = 71 (→72 correct); the sanitize-at-draw boundary `ui/src/view/draw-context.ts:108`; AR-14's non-breaking claim against `parse-commit.spec.test.ts`. One citation is loosely attributed (draw-context.ts is in **ui**, not core — but the `:108` line is correct).

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | ✅ resolved |
| 🟡 MINOR | 3 | ✅ resolved |
| 🔵 OBSERVATION | 2 | ✅ resolved |

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 4 | Completeness Gaps | PF-002, PF-005 | 🟠 |
| 6 | Feasibility | PF-003 | 🟡 |
| 9 | Edge Cases | PF-004 | 🟡 |
| 11 | Ordering & Sequencing | PF-001 | 🟠 |
| 12 | Consistency | PF-005 | 🟡 |
| 13 | Codebase Alignment | PF-001 (Architecture Mismatch), PF-006, PF-007 | 🟠 |

All other dimensions (1 Ambiguities, 2 Assumptions, 3 Contradictions, 5 Dependencies, 7 Testability, 8 Security, 10 Scope Creep) scanned clean — see notes at the foot.

---

### PF-001: Row-leave "Enter" path wires `advanceRow` into the wrong module 🟠 MAJOR

**Dimension:** 11 Ordering & Sequencing / 13 Codebase Alignment (Architecture Mismatch)
**Location:** `03-03-row-gate.md` §"The four leave paths" Path 2; `99-execution-plan.md` Step 3.2.4
**Codebase Evidence:** `advanceRow` is implemented in the **body** — `editable-grid-rows.ts:592` (`private advanceRow()`), bound to the `EditHost` seam at `editable-grid-rows.ts:274`. The Enter path calls `host.advanceRow()` at `editing.ts:332`. There is **no** `advanceRow` in `grid.ts` (the container). Challenger-confirmed cold.
**The Problem:** Path 2 says "the **container's** `advanceRow` implementation calls `tryLeave()` first," and Step 3.2.4 targets `packages/datagrid/src/grid.ts`. But the container has no `advanceRow` — it lives in the body and is invoked through the controller. If followed literally, an executor adds a dead `advanceRow` to `grid.ts` that is never called, and the **Enter-path row gate silently does not fire**. (AR-15's own grounding points at `editing.ts:328-335`, the call site — inconsistent with Path 2's "container" prose.) Related: Path 4 (click) is the only leave-path with **no line anchor**; the plain-click cursor move is owned by the **base** class (`super.onEvent`→`focusTo`, see the cursor-only-click doc at `editable-grid-rows.ts:338-346` and the mouse-down branch at :370), so the override must compute the target row itself before consuming — a wrinkle the plan glosses.

**Recommendation (only viable path):** Wire the Enter-path gate where `advanceRow` actually lives — the body — using the same `rowLeaveGate` body-dep already defined for Paths 1 & 4 (the body's `advanceRow` at :592 consults it), or gate in `editing.ts` `commit()` before `host.advanceRow()`. Change Step 3.2.4's file target from `grid.ts` to `editable-grid-rows.ts` (grid.ts only injects the dep). Add a line anchor for Path 4 (`editable-grid-rows.ts:370`) and note the override computes the target row since the base owns the plain-click move. *Rejected: adding a container-level `advanceRow` wrapper — the controller is constructed by the body and closes over the body's method; the container has no seam to intercept it.*
**Confidence:** High. **Hardening:** independent challenger read the source cold and confirmed; no container route exists.
**User Decision:** Resolved — user accepted the recommendation ("apply all fixes"); fix applied to the plan docs.

---

### PF-002: Invalid marker is never cleared on Escape/cancel — stale "invalid" on a valid cell 🟠 MAJOR

**Dimension:** 4 Completeness Gaps / 9 Edge Cases
**Location:** `03-01` + `03-02` error-registry lifecycle (`set` on failed commit, `clear` only on successful commit); no cancel rule anywhere in the plan
**Codebase Evidence:** `cancel()` at `editing.ts:279-283` does only `closeEditor()` + go idle + refocus body — it touches no registry (mirrors how `dirty` is only mutated inside `commitValue`, :307/:318). `beginEdit` (`editing.ts:188-258`) also clears no registry. On parse/`validate` failure the record is untouched (returns before any write). Challenger-confirmed.
**The Problem:** Sequence: type a bad value → **Enter** (validate/parse fails → `errors.set(ck, msg)`, editor stays open, **nothing written** so the cell's stored value is still the old *valid* one) → **Escape**. The editor closes but `errors.clear(ck)` never runs (that only fires on a successful commit). The cell now paints `gridInvalid` while holding a valid value, with **no automatic recovery** — not even re-opening the editor clears it; only a successful re-commit of that exact cell does. "Type wrong, give up with Escape" is a common action, so this leaves a visibly-wrong marker in the flagship error-surfacing feature (RD-12 R4 / AC-1: "clearing the error clears the marker").

**Recommendation (only viable path):** Add an explicit clear rule to the pipeline and an ST case: `cancel()` (Escape) clears the edited cell's error entry (`host.errors?.clear(ck)`) — the record holds its prior valid value, so the marker must go. Optionally also clear on `beginEdit` for defence in depth. Specify in `03-01`/`03-02` and add a spec case ("a failed commit then Escape leaves no invalid marker"). *Rejected: "invalid persists until fixed" — the cell's current value is valid, so a persistent marker is simply wrong, and it has no passive clear path.*
**Confidence:** High. **Hardening:** challenger traced `cancel()`/`beginEdit` and confirmed neither clears the registry.
**User Decision:** Resolved — user accepted the recommendation ("apply all fixes"); fix applied to the plan docs.

---

### PF-003: The `< 1300` line guard will be crossed — plan frames the re-base as conditional 🟡 MINOR

**Dimension:** 6 Feasibility / 13 Scope vs. Reality
**Location:** `01-requirements.md` AC #2; `99` Success Criterion #6; AR-7; risk table (02-current-state)
**Codebase Evidence:** `grid.ts` is exactly **1298** lines. There are **three** guard tests, all `expect(...).toBeLessThan(1300)` — `grid-selection.impl.test.ts:185`, `grid-footer.impl.test.ts:70`, `navigation.impl.test.ts:137` — so the real ceiling is **1299** (1 line of slack, not 2). Phases 2–4 add to `grid.ts`: 4 new **documented** public options (`validateRow`, `beforeSave`, `status`, `emptyText` — JSDoc is mandatory here), the error-registry field + threading, `RowGate` construction with its deps object, the `LifecycleController` + swap-host wiring, and `tryLeave()` calls. That is dozens of lines; crossing 1300 is near-certain (the plan's own risk table rates it **High likelihood**).
**The Problem:** Success Criterion #6 and AC #2 present "stays under the guard" as the primary path and re-basing as an exception ("only if the irreducible surface crosses it"). Given High likelihood, this is backwards — the re-base is the expected outcome. The plan also never names the target ceiling, nor states that all three guard tests move in lockstep (each carries its own rationale comment).

**Recommendation (only viable path):** State plainly that the guard **will** be re-based, pre-agree a ceiling (e.g. 1300 → 1350) justified by AR-7's "irreducible public surface" (4 new documented grid options + the controller wiring genuinely belong on the container), and note all three guard tests re-base together with matching rationale. Heavy logic still lands in the new modules. This is a documentation/expectation fix, not a scope change. *This is not a blocker — AC #2 already permits the re-base; the finding is that the framing understates its certainty.*
**Confidence:** High.
**User Decision:** Resolved — user accepted the recommendation ("apply all fixes"); fix applied to the plan docs.

---

### PF-004: `validate` runs on `null` when a nullable cell is cleared 🟡 MINOR

**Dimension:** 9 Edge Cases / 4 Completeness Gaps
**Location:** `03-01` pipeline (`value = nullable-empty ? null : parse(raw)` → `msg = column.validate?(value, row)`)
**Codebase Evidence:** `editing.ts:301` — `const value = tcol.nullable === true && raw === '' ? null : tcol.parse!(raw);`. The plan inserts the `validate` call after this line, so a nullable cell cleared to empty calls `validate(null, row)`. `GridColumn.validate` is typed `(value: V, row: T) => string | null` (V often excludes null).
**The Problem:** A caller writes `validate: (v) => v > 0 ? null : 'must be positive'` assuming a typed non-null value. On a nullable clear, `null > 0` is `false` → it returns the message → the grid **blocks a legitimate null-clear** and marks the cell invalid. The plan never defines whether `validate` runs for a nullable-null value.

**Recommendation (recommended):** Skip `validate` when the resolved value is `null` from a nullable clear (a nullable column has opted into null, so an empty clear is not a typed value to validate) — cheapest, least-surprising, matches how `parse` is bypassed for the nullable-empty case. Add an impl/spec case. *Alternative (viable but worse): document that `validate` receives `null` for nullable columns and the caller must guard — pushes a footgun onto every caller.*
**Confidence:** Med — depends how often nullable + `validate` co-occur; the fix is cheap either way.
**User Decision:** Resolved — user accepted the recommendation ("apply all fixes"); fix applied to the plan docs.

---

### PF-005: `ErrorRegistry` interface omits `note()`; note-vs-keyed active-message precedence undefined 🟡 MINOR

**Dimension:** 12 Consistency / 4 Completeness Gaps
**Location:** `03-02` `ErrorRegistry` interface (set/clear/has/message/active/keys) vs. `03-03` `RowGateDeps.note` + `99` Step 2.2.2 (which lists `note` as a registry method)
**Codebase Evidence:** Document-internal inconsistency — `03-02`'s interface has no `note`, but `03-03` uses `errors`'s "shared active-message channel" via `note(message: string | null)` and Step 2.2.2 explicitly lists `note` among the registry methods. No existing error registry in the code to arbitrate (net-new module).
**The Problem:** Two gaps: (1) the interface is missing `note()`; (2) the `active()` resolution between a **transient row/veto `note` message** (no cellKey) and **persistent keyed cell messages** is underspecified — e.g. when a `note(null)` clears a row message, should a still-invalid cell's message resurface, or does the band go blank while a red cell remains unexplained? `03-02` says `active()` is "last-writer-wins, recomputed on clear" but does not cover the note/keyed interaction.

**Recommendation (only viable path):** Add `note(message: string | null): void` to the `03-02` interface and specify the active-message model: one last-writer-wins channel shared by keyed `set` and transient `note`; `clear`/`note(null)` recomputes to the most-recent remaining keyed entry, else empty (so a lingering invalid cell keeps its message visible). Add an impl case for the note-then-clear-with-an-active-cell path.
**Confidence:** High (document-internal; directly checkable).
**User Decision:** Resolved — user accepted the recommendation ("apply all fixes"); fix applied to the plan docs.

---

### PF-006: The message band permanently reserves one body row whenever validation is configured 🔵 OBSERVATION

**Dimension:** 13 Codebase Alignment (design tradeoff)
**Location:** `03-02` §"The message band" / AR-11 ("collapses to blank; it is not removed, so layout is stable")
**The Problem:** Any grid that configures `validate`/`validateRow`/`beforeSave` gets a dedicated one-cell-tall band in the footer region that is present even when there is no active message — a permanent −1 row on the visible body. This is a deliberate stable-layout choice (reasonable), but it is a real vertical-space cost not called out as a tradeoff.
**Recommendation:** Acknowledge the 1-row cost in the design notes; optionally collapse the band to 0 rows when no message is active if body height is precious (accepting a 1-row layout shift when a message appears). Non-blocking.
**User Decision:** Resolved — user accepted the recommendation ("apply all fixes"); fix applied to the plan docs.

---

### PF-007: Filter-aware empty message relies on `filteredCount() < totalCount()` — collapses on a windowed source 🔵 OBSERVATION

**Dimension:** 13 Codebase Alignment (Migration & Compatibility)
**Location:** `03-04` (`filterActive = filteredCount() < totalCount()`)
**Codebase Evidence:** `grid.ts` `totalCount()` docstring (~:716-723) already documents that on a push-down/windowed source `source.length()` reflects the filtered set, so `filteredCount() === totalCount()` there.
**The Problem:** The "No matching rows" vs `emptyText` distinction works on the **client path** (RD-11 windowing not built), but a future windowed source cannot distinguish filtered-empty from truly-empty with this test. The plan uses the comparison without noting the inherited caveat.
**Recommendation:** Note in `03-04` that the filter-aware empty distinction is client-path only for v1 (a windowed source needs a pre-filter total the seam does not yet expose — consistent with the existing `totalCount` limitation). Non-blocking for v1's stated scope.
**User Decision:** Resolved — user accepted the recommendation ("apply all fixes"); fix applied to the plan docs.

---

### Clean dimensions

- **Security (8):** Strong. The UX-only posture, `sanitize`-at-draw (verified `ui/src/view/draw-context.ts:108` + defence-in-depth at `buffer.ts:211`), no-persistence-bypass, and the existing no-eval scan (`security.spec.test.ts:41`) are all grounded; ST-21…ST-23 assert them directly. `gridInvalid` derives `bg: c.danger` while `gridDirty` deliberately stays off danger — consistent with the recorded theming constraint.
- **Dependencies (5) / Ordering (11, except PF-001):** Phase graph is sound — Phase 2 (error registry) precedes Phase 3 (`note` consumer); Phase 4 is correctly independent. All `@jsvision/ui`/`core` seams (`Text` reactive + `severity`, `Spinner`/`runSpinner`, `sanitize`, the theme roles) exist as cited.
- **Testability (7):** Every ST-case has a concrete input→output pair; spec-first ordering and the immutable-oracle rule are stated; drive idioms are grounded in `editing.spec`.
- **Ambiguities (1) / Contradictions (3) / Scope Creep (10):** The AR resolves all six user-forked decisions; Should-Have/Won't-Have deferrals are explicit; no unbounded tasks.
