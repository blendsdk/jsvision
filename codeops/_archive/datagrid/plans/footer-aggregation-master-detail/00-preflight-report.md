# Preflight Report: Footer, Aggregation & Master-Detail

> **Status**: ✅ PASSED — all 7 findings resolved (user accepted every recommendation); plan-doc edits applied 2026-07-17; roadmap advanced to 🔬 Plan Preflighted
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/footer-aggregation-master-detail/`
> **Codebase Grounded**: 9 datagrid source files + ui/core API surface examined; ~40 references verified
> **Last Updated**: 2026-07-17

⚠️ **SAME-MODEL REVIEW.** The Ambiguity Register records that this plan was authored in the same
session that would review it. This preflight runs in a **freshly-cleared context** (no authoring
memory carried in), which restores review independence at the context level, but the same *model*
authored and reviewed it — residual same-model bias remains. One independent challenger was spawned
for the two MAJOR findings per the recommendation-hardening protocol.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM, NodeNext, strict), zero runtime deps; yarn 1.x + Turborepo monorepo; vitest.
**Architecture:** `@jsvision/datagrid` builds on `@jsvision/ui` (a Solid-like reactive core: `signal`/`computed`, a `View`/`Group` tree, damage-diffed draw). `EditableDataGrid<T>` (a `Group` subclass in `grid.ts`) delegates band assembly to a pure `buildGridBody()` in `grid-panels.ts` and extracts stateful logic into plain controllers (`GridSelection`, `RowMutations`).
**Key Files Examined:** `grid.ts` (1198), `grid-panels.ts` (534), `data-source.ts` (92), `column.ts` (252), `index.ts` (135), `grid-selection.ts`, `row-mutations.ts`; ui `table/columns.ts`, `controls/{text,button}.ts`, `view/view.ts`, `reactive/{owner,computed}.ts`; `datagrid-showcase/stories/placeholders.ts`; RD-09 source doc + both roadmaps.

**Reference verification:** The plan is unusually well-grounded — the load-bearing facts all check out:
`grid.ts` is exactly **1198** lines (guard `< 1200` real at `grid-selection.impl.test.ts:182`); the
footer insertion point (`inner.add(bodyRow)` :526 → `botRow` :528) is valid and `bodyRow` is the only
`fr` child (sticky-for-free holds); `display` :364, `focused` :290, `selectedKeys()` :1104,
`filteredCount()` :722, `totalCount()` :732, re-anchor :1060/:1080, `corner()` :150, `segs` :388-399 all
confirmed; `apportionColumns`/`alignCell`/`Text`-getter/`Button.command`/`spacer`/`createRoot`/`onCleanup`
all exist as described; RD-09 doc + the RD-09 showcase placeholder both exist. Findings below are the
residual gaps, not a challenge to the plan's overall soundness.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (in PF-007) | 🔵 |
| 2 | Implicit Assumptions | 1 (PF-002) | 🟠 |
| 3 | Logical Contradictions | 1 (PF-001) | 🟠 |
| 4 | Completeness Gaps | 1 (in PF-007) | 🔵 |
| 5 | Dependency Issues | 1 (PF-004) | 🟡 |
| 6 | Feasibility Concerns | 2 (PF-001, PF-006) | 🟠 |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-003) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 (PF-001 surfaces at Phase 2) | — |
| 12 | Consistency | 1 (PF-005) | 🟡 |
| 13 | Codebase Alignment | 5 (PF-001..005) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 2 | ✅ Resolved (accepted recommendation) |
| MINOR | 3 | ✅ Resolved (accepted recommendation) |
| OBSERVATION | 2 | ✅ Resolved (accepted recommendation) |

---

### PF-001: `grid.ts < 1200` is arithmetically unreachable as written — and AC#11 contradicts AR-10 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment / Scope-vs-Reality) + 3 (Contradiction) + 6 (Feasibility)
**Location:** `01-requirements.md` AC#11; `00-ambiguity-register.md` AR-10; `99-execution-plan.md` Step 2.2/2.3, Step 3.2.4
**Codebase Evidence:** `grid.ts` = 1198 lines; guard `expect(lineCount).toBeLessThan(1200)` at `grid-selection.impl.test.ts:182`. Documented public accessors here cost ~8–18 lines each (`selectedKeys()` :1089–1106 ≈ 18; `filteredCount()` :714–724 ≈ 11). `EditableDataGridOptions` lives *inside* grid.ts (:59), so the `footer?` option lands here too.
**The Problem:** Phase 2 alone adds three documented public accessors (`displayedRows`/`focusedRow`/`focusedKey`, ~28 lines with the mandatory `@example`), the `footer?: GridFooter<T>` option (~4), and (Phase 3) the `FooterController` field + instantiation + `_bodyDeps` wiring (~8). Realistic total ≈ +40 lines → grid.ts ≈ **1235–1243**. Even a bare, doc-standard-violating minimum lands ~1212 — still over. The plan's Phase 2 harden step (2.3.1) *re-asserts* `grid.ts < 1200` immediately after adding the accessors, so **execution goes red at Phase 2**. AR-10 permits "nudging the guard" as a fallback but names no concrete extraction; AC#11 states `< 1200` as a hard done-criterion. The two directly conflict, and neither is actionable as written.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Extract the two misplaced, self-contained overlay classes `EditorOverlay` (`grid.ts:150–163`) + `PopupCatcher` (`grid.ts:171–185`) into `overlay.ts` (their natural home; it already exists) as Phase 2's **first** task — reclaims ~40 lines (net ~38 after the import back). Then measure; reconcile AC#11 wording. | Concrete, low-risk (neither class touches grid `this` in a load-bearing way); this is the "extraction tried first" AR-10 mandates; preserves the guard's intent (thin container). | Headroom is *tight* — at the footer surface's high end grid.ts can still graze 1200, so a fallback is still needed. |
| B | Formally **nudge** the guard now: bump the impl-test ceiling (e.g. `< 1250`) with written rationale and update AC#11 to match. | Honest about irreducible public-API growth; keeps the footer diff focused; one line. | Relaxes a forcing function that is arguably working (grid.ts is already 2.4× the 200–500 house target). |
| C | Terse accessors + minimal wiring only. | Least effort. | Arithmetic still lands ~1212 (over) **and** violates the non-negotiable `@example`/`check-jsdoc` gate. Not viable alone. |

**Recommendation:** **Option A as primary, with B as the explicit, pre-authorized fallback** — extract `EditorOverlay`/`PopupCatcher` → `overlay.ts` first (the mandated cheap extraction), *then* if the measured footer surface still lands ≥ 1200, nudge the guard with rationale rather than force a second speculative extraction. Either way, **reconcile AC#11**: reword it to "grid.ts remains a thin delegator (all footer logic in new modules); the `< N` guard is re-based with rationale if the public-API surface requires it" so requirements and the register stop contradicting each other. Do NOT extract the sort/filter mutators (`applySort`/`applyFilter` :1055–1087) for headroom — their cursor re-anchor is intertwined with `display`/`focused` and refactoring them purely for line count adds real regression surface.

`Confidence: High` — the budget arithmetic and the two-line-headroom starting point are verified; what remains is a policy choice (extract vs. nudge), not a fact question.
`Hardening: changed the pick` — initial lean was "just nudge (B)". The challenger surfaced the concrete `EditorOverlay`/`PopupCatcher` → `overlay.ts` extraction; verified against source and adopted as primary, keeping the nudge as an explicit fallback because the reclaimed headroom is tight.
`Challenger: diverged — surfaced a better, lower-risk extraction target than the guard-nudge I'd underweighted; reconciled by making it primary with the nudge as fallback.`

**User Decision:** Resolved — user accepted the recommendation (2026-07-17)

---

### PF-002: `FooterController` owning bare `computed`s diverges from the datagrid's reactive convention (and has an ownership hazard) 🟠 MAJOR

**Dimension:** 13 (Architecture Mismatch) + 2 (Implicit Assumptions) + 6 (Feasibility)
**Location:** `03-01-aggregate-model.md` (controller "wraps these in `computed`s"); `03-02-footer-band.md` point 3 ("one memoized `computed` per `aggregates` entry"); `00-ambiguity-register.md` AR-9
**Codebase Evidence:** The datagrid package uses **`this.derived()`** (View.derived, `view/view.ts:261`, scope-owned, rebuilds on remount) for every reactive value (`grid.ts:364/371/392/393`) and contains **zero** bare `computed()` calls. `GridSelection` and `RowMutations` — the two controllers the `FooterController` is a "twin" of — hold **zero** computeds; they read `display()`/cursor **lazily** on demand. The controller is constructed in the grid ctor and threaded through `_bodyDeps` (`grid.ts:442`), where `this.scope` is still null (pre-mount).
**The Problem:** A plain (non-View) controller cannot use `this.derived`, so "one memoized `computed` per aggregate" would be the package's first bare `computed`. Created at grid-construction time, a bare `computed` attaches to *whatever ambient reactive owner is active when user code calls `new EditableDataGrid()`* — an unrelated component scope (→ disposed prematurely when that scope tears down) or none (→ the "never auto-disposed" dev-warning path). This is exactly the ownership hazard `View.derived` exists to avoid, and it silently breaks a package-wide convention the plan never acknowledges.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Own the fold in the `FooterBand` view via its scope-owned `this.derived`. | Uses the package idiom. | **Wrong shape:** there are up to 3 sibling `FooterBand`s (left/center/right segs) and they are recreated on every `rebuildBody()` (`grid.ts:569`) — no singular, stable owner for a column-global memo. |
| B | Controller reads **lazily** (holds no `computed`): `cell(columnId)` folds on demand over the already-memoized `displayedRows()`; the reactive `FooterBand` `bind`s the fold to its **data deps** (`displayedRows()`/`version`) and stashes the result, driving the separate `widthTick` (live-resize) repaint off an invalidate-only `bind`. | Exactly matches `GridSelection`/`RowMutations` (0 computeds); no ownership question; `bind` is memo-equivalent (~1 fold per data change); `FooterBand` needs a `bind` anyway (twin `SyntheticBodyBand` binds at `synthetic-columns.ts:136/209`). | Correctness depends on getting the `bind` split right (fold on data-deps, invalidate-only on `widthTick`), or a naive `draw()`-time fold re-runs on every resize repaint. |
| C | Keep bare `computed`s but create them under the grid's owner scope via `runWithOwner(this.scope, …)`. | Memoized, disposed with the grid. | Introduces the first bare `computed` + re-implements `View.derived`'s lazy-under-scope trick in a non-View class; more `grid.ts` plumbing (aggravates PF-001). |

**Recommendation:** **Option B** — the controller folds lazily (no owned `computed`), and the `FooterBand` view binds the fold to its data deps with a separate invalidate-only bind for `widthTick`. It matches both existing controllers verbatim, removes the ownership question entirely, and is memo-equivalent under the real paint model. Specify in `03-02` the bind split (fold ← `displayedRows()`/`version`; repaint-only ← `widthTick`) so the implementer doesn't fold inside `draw()`.

`Confidence: High` — grounded in the verified 0-`computed` convention, the two controllers' lazy pattern, and the `SyntheticBodyBand.bind()` precedent.
`Challenger: converged` — independent architect reached Option B at High confidence, added the `bind`-split grounding, and demonstrated Option A is not merely awkward but wrong (multiple non-singular band owners).

**User Decision:** Resolved — user accepted the recommendation (2026-07-17)

---

### PF-003: `focusedRow()` one-liner skips the clamp every sibling accessor applies — latent edge case + redundancy 🟡 MINOR

**Dimension:** 13 (Convention Violation / Redundancy) + 9 (Edge Cases)
**Location:** `03-04-master-detail.md` §Proposed Changes 1 (`focusedRow(): this.display()[this.focused()]`)
**Codebase Evidence:** Every place the codebase maps the cursor to a row **clamps** the index into range: `focusAnchorKey()` (`grid.ts:1046`) uses `before[Math.max(0, Math.min(this.focused(), n - 1))]`; the private `GridSelection.focusedKey()` (`grid-selection.ts:163`) uses `clampIndex(...)`; `editable-grid-rows.ts` uses `clamp(this.focused(), 0, range - 1)`. The plan's `this.display()[this.focused()]` does **not** clamp.
**The Problem:** When `focused()` transiently exceeds `display().length` (e.g. right after a delete/filter, before a re-anchor, or a stale cursor), the un-clamped index returns `undefined` even though rows exist — so `focusedRow()`/`focusedKey()` (and the linked detail grid) blink empty instead of resolving to the boundary row the rest of the grid shows. Separately, `focusedKey()`'s proposed body duplicates the already-existing private `focusAnchorKey()` (`grid.ts:1042`).

**Options:** Single viable path (this is a correctness+DRY fix, not a design fork): implement `focusedRow()`/`focusedKey()` by **reusing/mirroring the clamped `focusAnchorKey` logic** — e.g. have `focusedRow()` clamp like `focusAnchorKey`, and `focusedKey()` delegate to (or share a helper with) `focusAnchorKey`. Considered and rejected: keeping the un-clamped one-liner (diverges from the codebase and reintroduces the empty-blink edge case for zero benefit).

**Recommendation:** Clamp `focusedRow()` (`const rows = this.display(); return rows.length ? rows[Math.min(this.focused(), rows.length - 1)] : undefined;`) and implement `focusedKey()` by reusing `focusAnchorKey` (rename it to the public accessor, or have both call one private helper) — fixes the edge case and removes the duplication in one move.

**User Decision:** Resolved — user accepted the recommendation (2026-07-17)

---

### PF-004: `devWarn` sourcing for the new `grid-footer.ts` module is unspecified (it is module-private) 🟡 MINOR

**Dimension:** 13 (Dependency Reality) + 5 (Dependency Issues)
**Location:** `00-ambiguity-register.md` AR-12; `03-02-footer-band.md` (validation "+ `devWarn`"); `07-testing-strategy.md` ST-27
**Codebase Evidence:** The datagrid's `devWarn` is a **module-private** function in `grid.ts` (:44) — not exported. The new validation lives in `grid-footer.ts` (a new file). `@jsvision/ui` has two `devWarn`s (`shared/warnings.ts:25` = `(scope, message)`, `reactive/warnings.ts:17` = `(message)`) but **neither is exported from the ui barrel**, and `@jsvision/core` has none.
**The Problem:** `grid-footer.ts` cannot `import { devWarn }` from anywhere as written — the plan references "devWarn" for unknown-key/`fn` validation without noting the symbol isn't reachable from the new module.

**Options:** Single viable path: extract `grid.ts`'s `devWarn` into a tiny shared datagrid module (e.g. `src/dev.ts`) and import it in both `grid.ts` and `grid-footer.ts`. (Bonus: removing the private copy from `grid.ts` nets a few lines toward PF-001.) Rejected: duplicating the function in `grid-footer.ts` (DRY violation) or trying to import an unexported ui internal.

**Recommendation:** Extract `devWarn` to `packages/datagrid/src/dev.ts`; import in both files. Add a task under Phase 2 or 3.

**User Decision:** Resolved — user accepted the recommendation (2026-07-17)

---

### PF-005: A couple of stale/imprecise code citations 🟡 MINOR

**Dimension:** 12 (Consistency) + 13 (Stale references)
**Location:** `03-03-widget-slots.md` §Proposed Changes; `00-index.md` Overview
**Codebase Evidence:** `03-03` says a caller inserts `spacer()` "exactly as `StatusLine` does (`statusline.ts:83`)" — but `statusline.ts:83` is `this.layout = { direction: 'row' }`; `StatusLine` does **not** call `spacer()` internally (right-alignment is consumer-supplied via a `spacer()` child + the row layout). The described *behavior* is correct; the citation is wrong. Separately, `00-index.md` Overview prose says new logic lands "in new modules (`aggregate.ts`, `footer-band.ts`, `master-detail.ts`)" — **three** — but there are **four** (add `grid-footer.ts`); the Related-Files list correctly enumerates four.
**The Problem:** Stale citations erode the plan's otherwise-excellent grounding and can mislead the implementer to look for a `spacer()` call that isn't there.

**Options:** Single viable path — documentation correction: drop/repoint the `statusline.ts:83` citation (cite the row-layout line or just describe the consumer-supplied `spacer()` pattern), and correct the "three new modules" prose to four.

**Recommendation:** Fix both references.

**User Decision:** Resolved — user accepted the recommendation (2026-07-17)

---

### PF-006: `fromReactiveRows` + a filtering `read` is O(n²) via `materialize` 🔵 OBSERVATION

**Dimension:** 6 (Feasibility)
**Location:** `03-04-master-detail.md` §2 + Error-Handling; `00-index.md` Usage example (`read: () => lines().filter(l => l.orderId === focused()?.id)`)
**Codebase Evidence:** `materialize()` (`grid.ts:188`) calls `source.rowAt(i)` for every `i in [0, length)`, and `fromReactiveRows` implements both `length()` and each `rowAt(i)` as `read()`. So a filtering `read` re-runs the full filter `length + 1` times per materialize — O(n²) per derivation.
**The Problem:** For the intended use (small master-detail line-item sets) this is negligible, but the caller contract in `03-04` documents "stable refs" without noting the call-frequency cost — a caller with a large detail set could be surprised.

**Recommendation:** Add one line to the `fromReactiveRows` caller contract: `read` is invoked once per row per re-derive, so keep it cheap (small detail sets, or memoize the filter). No code change required for v1.

**User Decision:** Resolved — user accepted the recommendation (2026-07-17)

---

### PF-007: Minor internal doc-consistency / completeness nits 🔵 OBSERVATION

**Dimension:** 1 (Ambiguity) + 4 (Completeness) + 12 (Consistency)
**Location:** `01-requirements.md` AC#10; `03-02-footer-band.md` band-height formula; `03-03-widget-slots.md`
**The Problem (three small items):**
1. **Traceability:** `01-requirements.md` AC#10 (security) cites only `AR-12`, not the ST-cases that cover it (`ST-27`/`ST-28` exist in `07 §G`). Every other AC cross-cites its ST range.
2. **Ambiguity:** `03-02` band-height uses `(widgets ? widgetRows : 0)` implying a variable row count, while `03-03` fixes v1 at "a single 1-cell row (multi-row is a caller concern via nested groups)". `widgetRows` reads as computed but is 1 in v1.
3. **Completeness:** The widget row is "a flow `Group` spanning the full band width" (`03-03`), but whether it spans *under the vbar gutter/`corner()`* (like the aggregate row, which appends a `corner()`) or stops at the panel edge is unspecified — a minor geometry gap for `spacer()` right-alignment.

**Recommendation:** Cross-cite `ST-27`/`ST-28` under AC#10; state `widgetRows = 1` in v1 explicitly; specify whether the widget row includes the vbar-gutter column. All cosmetic — safe to fix in one pass or accept as-is.

**User Decision:** Resolved — user accepted the recommendation (2026-07-17)

---

## Adversarial checklist (same-model safeguard)

- *What assumption might I be unconsciously confirming?* The plan's "grid.ts stays thin/< 1200" framing — challenged head-on in PF-001 with the arithmetic and the AC#11/AR-10 contradiction.
- *What convention might this violate that I'm not seeing?* The reactive-ownership convention — PF-002 (0 bare `computed`s; controllers read lazily), which the plan's "twin of GridSelection/RowMutations" framing actually *contradicts* while claiming to follow.
- *What would a dissenting expert flag?* The independent challenger flagged the same two MAJORs and improved both resolutions (converged on PF-002 B; diverged-then-reconciled on PF-001 toward the overlay extraction).
