# Preflight Report: Filter Entry Point

> **Status**: ✅ PASSED — all 10 findings resolved (fixes applied 2026-07-16); user accepted every recommendation
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/filter-entry-point/`
> **Codebase Grounded**: 12 source files + 4 test files examined; ~30 references verified
> **Last Updated**: 2026-07-16

> ⚠️ **SAME-MODEL / FRESH-SESSION REVIEW.** The plan was authored earlier today in a since-cleared
> session (its own register recommends a fresh-session preflight). This scan runs in a fresh context —
> good for independence — but the reviewing model is the same family. Structural safeguard applied: an
> independent challenger sub-agent re-verified all three MAJOR findings against the code and confirmed
> each (see the `Hardening:` lines).

### Codebase Context Summary

**Repository:** jsvision (yarn 1.x + Turborepo monorepo, ESM-only, zero runtime deps)
**Tech Stack:** TypeScript (strict, NodeNext), vitest (unit `*.impl/*.spec`, e2e), `@jsvision/datagrid` on `@jsvision/ui` on `@jsvision/core`
**Architecture (relevant slice):** `EditableDataGrid` (grid.ts) is a `Group` container owning shared cursor/sort/filter signals; `buildGridBody` (grid-panels.ts) assembles per-panel `SortHeader` + `EditableGridRows`; the funnel/popup live in `sort-header.ts` + `filter-popup.ts`; in-cell editing in `editing.ts`.
**Key Files Examined:** `sort-header.ts`, `grid.ts`, `grid-panels.ts`, `editable-grid-rows.ts`, `editing.ts`, `column.ts`, `filter.ts`, `filter-popup.ts`, `quick-filter-row.ts`, `ui/src/table/grid-rows.ts`; tests `sort-header.spec/impl.test.ts`, `grid-filter.spec.test.ts`, `datagrid-showcase.{smoke,walkthrough}.spec.test.ts`; requirement `RD-06-filtering.md`.

**Reference verification:** the plan's structural claims are overwhelmingly correct — `openFilterPopup` has exactly one caller (grid.ts:380); `filterable` is genuinely new (no prior use); `FilterPopup` accepts `current?` undefined + exposes `focusTarget()`; `resolveFilterType` (filter.ts:220) defaults to `'text'`; `isEditing()` exists on the edit controller (editing.ts:154,304); all showcase/kitchen-sink paths exist; RD-06 lines 27/34/139 quote verbatim. **However**, three substantive defects and several minor ones surfaced (below), plus consistent line-number drift in two files.

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 1 (PF-004) | 🟡 |
| 2 | Implicit Assumptions | 1 (PF-001) | 🟠 |
| 3 | Logical Contradictions | 1 (PF-003 shared) | 🟠 |
| 4 | Completeness Gaps | 3 (PF-002, PF-003, PF-005) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility | 1 (PF-002 shared) | 🟠 |
| 7 | Testability | 0 | — |
| 8 | Security | 0 (correctly N/A — no new trust boundary) | — |
| 9 | Edge Cases | 0 material | — |
| 10 | Scope Creep | 0 (commendably narrow) | — |
| 11 | Ordering | 1 (PF-006) | 🟡 |
| 12 | Consistency | 2 (PF-007, PF-008) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-009) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 3 | ✅ resolved (PF-001, PF-002, PF-003) |
| 🟡 MINOR | 5 | ✅ resolved (PF-004…PF-008) |
| 🔵 OBSERVATION | 2 | ✅ resolved (PF-009 doc note; PF-010 no plan change) |

---

### PF-001: "Alt+Down is unbound on the non-editing body" is a stale assumption 🟠 MAJOR

**Dimension:** 2 Implicit Assumptions / 13 Stale Assumption
**Location:** `02-current-state.md:49` ("`Alt+Down` on the non-editing body is **unbound** → free for FR-3"); `00-ambiguity-register.md` AR-5 + AR-9; `03-02-keyboard-opener.md:26` ("no conflict").
**Codebase Evidence:** `packages/ui/src/table/grid-rows.ts:278-280` — base `handleKey` has `case 'down': this.focusBy(1); return true;` with **no** `alt`/modifier gate. `packages/datagrid/src/editable-grid-rows.ts:266-284` — `onEvent` runs `handleColKey` (left/right/home/end only) and `tryBeginEdit` (its printable branch is gated `!inner.alt`, :318), then falls through to `super.onEvent` (:283) → the base `case 'down'`. Alt+Down decodes as `{key:'down', alt:true}` (confirmed by `editing.ts:235`).
**The Problem:** Alt+Down on the non-editing body is **not** unbound — it currently **moves the row cursor down** via the base class. The feature still works because the plan's handler intercepts before `super.onEvent` and consumes the key, but (a) the AR-9 grounding is factually wrong, and (b) the plan frames this as "filling a void / no conflict" when it is actually **overriding an existing base binding** — a distinction an executor must know so the handler is ordered *before* `super.onEvent` (not merely "before the arrow branches") and returns early.

**Options:** Single viable resolution (a doc/grounding correction; the pseudocode's placement already happens to be right). Considered and dropped: changing the key (rejected — Alt+Down is correct; only the rationale is wrong) and adding a base-class modifier guard (rejected — out of scope, `@jsvision/ui` is untouched by this plan).

**Recommendation:** Correct `02-current-state.md` and AR-9 to state that Alt+Down currently falls through to the base and moves the row cursor down (base `grid-rows.ts` `case 'down'` ignores modifiers), and that the new handler **must run before `super.onEvent`** to repurpose it; note the old row-down behavior is undocumented/untested, so repurposing is safe. Add an impl/spec assertion that a plain `Down` (no alt) still performs base row-nav (no regression).
**Confidence:** High. **Hardening:** independent challenger read both files and CONFIRMED; the "unbound" term does not survive inspection.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-002: The keyboard path needs the owning `SortHeader`, but `grid.ts` discards `parts.headers` 🟠 MAJOR

**Dimension:** 4 Completeness / 6 Feasibility / 13 Impact Blindness
**Location:** `03-02-keyboard-opener.md` ("resolve the owning **header panel** … call `openFilterPopup(columnId, funnelAnchor, ev, header)`"); `00-index.md` Related Files (grid.ts row).
**Codebase Evidence:** `grid-panels.ts:444` returns `{ inner, panels, headers, center }`. `grid.ts:404-407` (constructor) keeps only `parts.center` + `parts.inner`; `rebuildBody` (`grid.ts:467-480`) again keeps only `inner` + `center`. There is **no** `headers`/`panels` field on the class. `openFilterPopup` **requires** a live `header: SortHeader<T>` (`grid.ts:821-826`, dereferenced at `:834` `absoluteRect(header)`). Today the header only reaches `openFilterPopup` via the mouse closure that captures it (`grid-panels.ts:247`); the keyboard path has no such closure.
**The Problem:** As written, Phase 3 (task 3.2.3) cannot be implemented — grid.ts holds no reference to any `SortHeader`, so it cannot "resolve the owning header" for the focused column. The plan omits the required change: retain `parts.headers` **and** refresh them in `rebuildBody` (which mints fresh headers each call, so a stale reference would be a live bug once a column is hidden/shown/reordered/frozen-resized). This lifecycle coupling is invisible in the current plan text.

**Options:** Single viable resolution (a required-change addition). Considered and dropped: searching `this._inner`'s subtree for `SortHeader` instances at open time (rejected — brittle, order-dependent, and still needs the *owning* one per global column), and refactoring `openFilterPopup` to take an absolute origin instead of a header (rejected — larger blast radius; the plan deliberately reuses the method unchanged).

**Recommendation:** Add to Phase 3 (and the index's grid.ts Related-Files note): retain `parts.headers` as a field, populate it in the constructor **and** in `rebuildBody`, and resolve the owning header by global column (the segment/offset math `buildGridBody` already computes). Add an impl test that Alt+Down still opens under the correct header **after a rebuild** (e.g., after hide/show or reorder).
**Confidence:** High. **Hardening:** independent challenger CONFIRMED — no alternative header accessor exists; `rebuildBody` staleness is real.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-003: The RD-06 revision is incomplete — two more spots keep the old rule, so RD-06 self-contradicts 🟠 MAJOR

**Dimension:** 3 Logical Contradictions / 4 Completeness Gaps
**Location:** `00-ambiguity-register.md` §C edit table (rows for lines ~27, ~34, ~139 + one new AC); the Phase 4 task 4.1.2.
**Codebase Evidence:** `requirements/RD-06-filtering.md:14-15` (Feature Overview) — "…a **funnel indicator on filtered columns** and a 'N of M rows' footer…". `RD-06-filtering.md:82-83` (Technical Requirements §Funnel + count) — "The header renders a funnel glyph on **any column with an active filter**…". Neither line is in the §C edit list. (`02-current-state.md:67` even names the Feature Overview as a spot encoding the old rule, yet no edit is scheduled for it.)
**The Problem:** After the planned edits, RD-06 would say "muted funnel on every filterable column" in three places and "funnel only on filtered columns" in two others — an **internal contradiction**. This is precisely the failure AR-2 folded the revision in to prevent; an incomplete edit re-creates it.

**Options:** Single viable resolution. Considered and dropped: leaving the two spots and adding a footnote (rejected — a requirements doc that contradicts itself is a defect, not a footnote).

**Recommendation:** Add two rows to the §C edit table (and to Phase 4 task 4.1.2): revise the Feature Overview (line 15) and the Technical Requirements §Funnel + count (line 83) to the always-visible/muted-vs-emphasized wording. Also consider extending the new "non-filterable" acceptance to note the omitted quick-filter input (FR-4 says a non-filterable column also drops its quick-filter `Input`, but the new AC only mentions the funnel + Alt+Down).
**Confidence:** High. **Hardening:** independent challenger read RD-06 and the §C table and CONFIRMED both spots are unlisted and state the old rule.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-004: `SortHeaderConfig.filterable` optionality + default is unspecified 🟡 MINOR

**Dimension:** 1 Ambiguities / 13 Test Impact
**Location:** `03-01-funnel.md` ("Thread a `filterable: boolean[]` … into `SortHeader` config"); Phase 2 task 2.2.1.
**Codebase Evidence:** `SortHeader` is constructed directly (without any `filterable`) at `sort-header.spec.test.ts:61-70,97-110`, `sort-header.impl.test.ts:42-51,97-110`, and in production at `grid-panels.ts:237-255`. The funnel today is gated on `filtered`; the plan re-gates draw+hit-test on `filterable[]`.
**The Problem:** The plan doesn't say whether the new config field is **required** or **optional-with-default**. Required → every direct construction site (≥4 in tests + grid-panels) must pass it or fail to compile. Optional → what does a header render when omitted (all-filterable? none?)? This decision bounds the test/wiring churn and defines the omitted-field behavior.
**Recommendation:** Make it **optional**, defaulting to "all columns filterable" (mirrors today, minimizes churn, and existing spec/impl tests keep passing — verified: no existing test asserts funnel *absence* except the replaced ST-19). State this in `03-01`.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-005: `QuickFilterRow` changes are under-specified and omitted from the index's file list 🟡 MINOR

**Dimension:** 4 Completeness / 12 Consistency / 13 Convention
**Location:** `03-03-filterable-demos-rd.md` (QuickFilterRow "omits the `Input`"); Phase 1 tasks 1.2.2/1.2.3; `00-index.md` "Related Files → Modified" (omits `quick-filter-row.ts`).
**Codebase Evidence:** `quick-filter-row.ts:74` builds `this.inputs = this.columns.map(() => new Input(...))` — one input per column; `reposition()` (`:124`) and the filter wiring (`:93-106`, `this.columnIds[c]`) both assume `inputs` is **index-parallel** to `columns`. `QuickFilterRow` has no `filterable` config field today. Columns are sliced per panel in `grid-panels.ts` (`sliceCols`/`sliceTyped`), and the quick-filter band is built over `fullVisible` (`grid-panels.ts:413-422`), while headers use per-panel `ids`.
**The Problem:** Three under-specifications: (1) `quick-filter-row.ts` is a modified source file but is absent from the index's Related-Files list; (2) skipping an input for a non-filterable column must **keep the array index-parallel** (e.g., a nullable slot) or `reposition()`/`columnIds[c]` misalign — a classic off-by-column bug the plan's "preserve geometry" phrasing doesn't call out; (3) the threading model ("a `boolean[]` parallel to `columnIds`") is ambiguous given per-panel slicing (headers) vs `fullVisible` (quick-filter).
**Recommendation:** Thread a `filterableOf(id): boolean` predicate (or a `filterable?: boolean[]` on `QuickFilterRowConfig` derived from the band's own `columnIds`) rather than one container-level array; keep `inputs` index-parallel (nullable slot for a skipped column); add `quick-filter-row.ts` to the index's Related-Files list.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-006: The RD-06 text revision (Phase 4) lags its spec re-spec (Phase 2) 🟡 MINOR

**Dimension:** 11 Ordering & Sequencing
**Location:** Execution plan — Phase 2 ("…+ ST-19 re-spec") vs Phase 4 task 4.1.2 (RD-06 text revision).
**The Problem:** Phase 2 deletes/​replaces ST-19 (the spec encoding the old rule) citing the RD-06 revision, but the RD-06 doc itself is revised two phases later (Phase 4). Between them, the requirement contradicts both the implemented funnel and the replaced spec — a mild inversion of the requirement-changes-with-its-spec discipline. (The register §C already documents the authorizing revision, so this is process-order, not a correctness hole.)
**Recommendation:** Move the RD-06 §Funnel/§Condition/AC#4 edit into Phase 2, alongside the ST-19 re-spec, so the requirement and its spec change together. (Demos/hint rewording can stay in Phase 4.)
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-007: Line-reference drift in `sort-header.ts` (~+8) and `grid.ts` (~+26) 🟡 MINOR

**Dimension:** 12 Consistency / 13 (soft phantom)
**Codebase Evidence:** `sort-header.ts` — plan cites `:257`/`:264`/`:452`; actual `const filtered` is `:265`, funnel paint `:272`, `isFiltered` gate `:460`. `grid.ts` — plan cites `:354`/`:795`/`:828`; actual `onFunnelClick` wiring `:380`, `openFilterPopup` `:821`, `this.filters().get(columnId)` `:854`; the "mouse path `:816-818`" points at JSDoc `@param` lines. (References into `editable-grid-rows.ts`, `editing.ts`, `filter.ts`, `column.ts`, `grid-panels.ts`, `RD-06`, and the spec test are all exact.)
**The Problem:** Structural claims are correct, but an executor following `grid.ts:795` lands mid-`distinctFor`, not `openFilterPopup`. Low-impact (executors grep symbols), but the two files' numbers could misdirect.
**Recommendation:** Refresh the `sort-header.ts`/`grid.ts` line numbers (or drop line numbers in favor of symbol names for those two files). Not blocking.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-008: Two ST-numbering schemes will coexist in `sort-header.spec.test.ts` 🟡 MINOR

**Dimension:** 12 Consistency
**Codebase Evidence:** `sort-header.spec.test.ts` already contains RD-05's `ST-13…ST-20` (sorting) plus `ST-19 (filter)` and `ST-20 (filter)`. This plan adds `ST-1…ST-7`. It replaces only `ST-19 (filter)` (:287-294); `ST-20 (filter)` (:296, funnel-click routing) survives and overlaps the new ST-5/ST-6 (funnel-click routing on an unfiltered column).
**The Problem:** One file would carry two independent ST-numbering bases, and a surviving `ST-20 (filter)` overlaps the new cases — traceability confusion (no functional break; no numeric collision since existing numbers start at 13).
**Recommendation:** Namespace this plan's cases (e.g., a header comment block or an `EP-` qualifier), and note explicitly that `ST-20 (filter)` is retained (filtered-column funnel click) alongside the new unfiltered-column cases.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-009: The always-visible funnel is a GLOBAL cosmetic change to every grid 🔵 OBSERVATION

**Dimension:** 4 / 13 Impact (low)
**Codebase Evidence:** `filterable` defaults `true`, so **every** `EditableDataGrid` everywhere gains a muted `▽` on every column — all 43 datagrid-showcase stories, the kitchen-sink, and any docs-site grid, not only the 3 filtering demos the plan rewords. Verified non-breaking: the funnel reserve is a **title-clip only** (`sort-header.ts:268` adjusts `alignCell` width, not `geom.widths`), so column geometry, frozen-band widths, and quick-filter positions are unchanged; the showcase smoke asserts only story counts + "painted something" (`datagrid-showcase.smoke.spec.test.ts`), the walkthrough asserts "canvas painted > 0" (not funnel/width), and no test asserts funnel *absence* except the replaced ST-19.
**The Problem (minor):** Intended per AR-1/AR-3, but the plan's demo section scopes visible change to 3 stories, which reads as if only those change — when in fact all grids do.
**Recommendation:** Add a one-line note in `03-01`/`03-03` that the funnel is now universal, and spot-check (behavioral verify) a title-filled narrow column to confirm the 1-cell earlier clip reads acceptably.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

### PF-010: Working tree carries the uncommitted #93 quick-filter width fix (out of scope) 🔵 OBSERVATION

**Dimension:** Context note
**Codebase Evidence:** `git diff` shows `quick-filter-row.ts` + `quick-filter-row.impl.test.ts` already modified (the #93 input-fills-full-width fix — which the plan lists as out of scope). Phase 1 will layer the `filterable` skip on top of these uncommitted changes; `02-current-state.md`'s "verified in the working tree" baseline is thus slightly ahead of HEAD.
**Recommendation:** Land/commit #93 before (or acknowledge it during) Phase 1 so the `filterable` work builds on a known baseline. No plan change required.
**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-16.

---

## Adversarial checklist (same-model bias)

- *Assumption I might be unconsciously confirming:* the plan's "Alt+Down is unbound" — actively refuted (PF-001) by reading the base class; the fresh-session lens caught the authoring blind spot.
- *External standard I can't fully cite:* "Alt+Down is Excel's open-filter key" — widely documented (Excel AutoFilter), but I did not cite a primary source; the key choice is sound regardless.
- *What a dissenting expert would flag:* the global funnel (PF-009) — addressed as an intended, non-breaking product decision.

## Outcome

**✅ PASSED.** The user accepted every recommendation and all 10 findings were applied to the plan
documents on 2026-07-16:

- **PF-001** → `02-current-state.md` + `00-ambiguity-register.md` (AR-5/AR-9) corrected: Alt+Down is
  *repurposed* from the base's modifier-agnostic row-down; handler must precede `super.onEvent`. Spec
  guard added (`07`, execution 3.1.1).
- **PF-002** → `03-02-keyboard-opener.md` + `00-index.md` + execution 3.2.3/3.3.1: grid.ts retains
  `parts.headers` and refreshes them in `rebuildBody`; after-rebuild impl test added.
- **PF-003** → `00-ambiguity-register.md` §C: two more RD-06 spots (Feature Overview L15, Technical
  §Funnel + count L83) added to the edit list; new AC extended to the omitted quick-filter input.
- **PF-004** → `03-01-funnel.md` + execution 2.2.1: `SortHeaderConfig.filterable` is optional, default
  all-filterable.
- **PF-005** → `03-03` + `00-index.md` + execution 1.2.2/1.2.3: `filterableOf(id)` predicate; nullable
  slot keeps `QuickFilterRow.inputs` index-parallel; `quick-filter-row.ts` added to the file list.
- **PF-006** → execution plan: the RD-06 §/AC funnel revision moved to Phase 2 (co-located with the
  ST-19 re-spec); Phase 4 renumbered.
- **PF-007** → `02-current-state.md` + `00-index.md`: `sort-header.ts` / `grid.ts` line numbers refreshed.
- **PF-008** → `07` + execution 2.1.1: this plan's ST cases prefixed (`ST-EP-*`); `ST-20 (filter)`
  retained.
- **PF-009** → `03-01` + execution 4.1.3: universal-funnel note + narrow-column spot-check.
- **PF-010** → acknowledged (land/commit #93 before Phase 1); no plan change required.

Roadmap advanced to **Plan Preflighted**. Recommended next step: `exec_plan filter-entry-point`.
