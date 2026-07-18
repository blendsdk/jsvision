# Preflight Report: Personalization Dialog (plan)

> **Status**: ✅ PASSED — all 4 findings resolved (0 critical, 2 major, 1 minor, 1 observation); fixes applied to the plan docs
> **Iteration**: 1 (first scan) — fixes applied in-place; a verification re-scan (iteration 2) was not run (user opted to apply only)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/personalization-dialog/`
> **Implements**: datagrid/RD-16
> **Codebase Grounded**: ~14 source + 6 test files examined; ~45 references verified, 0 unverifiable
> **Last Updated**: 2026-07-18

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps. `@jsvision/datagrid` builds on `@jsvision/ui` (widget framework) + `@jsvision/core` (engine).

**Architecture:** Pure data-plane models (`variant.ts`, `column-model.ts`, `sort.ts`, `filter.ts`) wrapped by a reactive container (`grid.ts`, `EditableDataGrid<T>`). The grid's layout write-surface is complete (`setColumnVisible/Order/Width`, `setFrozen`, `saveVariant`/`applyVariant`); the read-surface is thin (`columnOrder()` visible-only). Modals mount through a `ModalDialogHost` (`.desktop.addWindow/removeWindow` + `.loop.execView<T>`); `Dialog` gates the close (not the OK button) via `valid()`.

**Key Files Examined:** `packages/datagrid/src/{grid.ts,variant.ts,column-model.ts,index.ts}`; `packages/ui/src/{dialog/message-box.ts,dialog/dialog.ts,dialog/buttons.ts,controls/input.ts,controls/switch.ts,controls/button.ts,controls/text.ts,controls/validators/{range.ts,filter.ts},list/list-rows.ts,event/modal.ts,event/event-loop.ts}`; `packages/forms/src/form-dialog.ts`; `packages/files/src/openers.ts`; `packages/core/src/engine/safety/sanitize.ts`; showcase `stories/index.ts` + `story.ts` + `datagrid-showcase.smoke.spec.test.ts`; `variant.spec.test.ts`/`variant.impl.test.ts`; three grid.ts line-guard tests.

**Reference verification (highlights — all VERIFIED unless noted):**
- Every `grid.ts` line anchor (class `:302`; `columnOrderSig :378`, `columnWidths :379`, `hidden :380`, `freezeSpecSig :383`, `engineCols :393`, `columnIndex :394`, `columnMap :399`; `columnOrder :1020`, `setColumnWidth :1081`, `saveVariant :1148`, `applyVariant :1173`, width step `:1187-1192`); `resolvedWidth`→`0` for unknown id.
- `saveVariant('(current)')` reads live `sortKeys()`/`filters()` — seeding pending from it captures live sort/filter (grid.ts:1148-1158). ✅
- `applyVariant` width step matches the plan's quote exactly; the delete-then-set correction is sound; `clearWidths` added to `ResolvedLayout` breaks **no** existing test (all `resolveVariant` assertions read fields individually — no full-object `toEqual`). ✅
- `openFile` skeleton (addWindow → `execView<string>` → `Commands.ok` → `finally removeWindow` → `dlg.result()`) — files/openers.ts:60-79. ✅ `runDialog` is NOT barrel-exported (message-box.ts:70-77) → inline is correct. ✅
- `formDialog` body `position:'fill'` collapse-guard (form-dialog.ts:222-227). ✅ `sanitize` in core, already imported by datagrid (export-view.ts:13). ✅
- `Scroller`, `confirm`→`Promise<boolean>`, `ModalDialogHost`, `execView`, LIFO modal focus-restore (modal.ts:45-72), `ListView`/`ListBox` text-only (list-rows.ts:235-236) — all ✅.
- Line guards: exactly **three**, all `toBeLessThan(1680)` (grid-footer.impl:82, navigation.impl:146, grid-selection.impl:193). ✅
- Showcase: `'Export & variants'` present, no `'Personalization'`, `StoryContext.execView?` seam present (story.ts:32); smoke oracle ST-5/6/7 as the plan describes; no RD-16 roadmap placeholder to remove. ✅
- ⚠️ **CONTRADICTED:** `range()` validator semantics (PF-001) and `Button`-label / `Switch.disabled` reactivity (PF-002) — see findings.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 (PF-001) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-003, PF-004) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 2 (PF-001, PF-002) | 🟠 |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-003) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | ✅ resolved (fixed) |
| 🟡 MINOR | 1 | ✅ resolved (fixed) |
| 🔵 OBSERVATION | 1 | ✅ resolved (fixed) |

---

### PF-001: Width `Input` validator `range(minWidth,maxWidth)` contradicts AC#5 / ST-17 🟠 MAJOR

**Dimension:** 13 Codebase Alignment (Stale Assumption) · also 3 Logical Contradiction, 6 Feasibility
**Location:** `00-ambiguity-register.md` AR-7; `03-03-personalize-dialog.md` §Column region (Width row) + Error Handling; `07-testing-strategy.md` ST-17
**Codebase Evidence:** `packages/ui/src/controls/validators/range.ts:35-40` — `isValid(s) = charsOk && /^[+-]?\d+$/.test(s) && Number(s)>=min && Number(s)<=max`; `packages/ui/src/dialog/dialog.ts:164,219-227` — an invalid child **vetoes** the OK close and refocuses the field (OK is never greyed).

**The Problem:** The plan specifies the width field as `Input({ maxLength:3, validator: range(minWidth,maxWidth) })` and says a value "participates in the `Dialog.valid()` OK-gate" (AR-7). Verified against the source, `range()` does the opposite of what AC#5/ST-17 need:
- `range(4,40).isValid('')` → **false** (`/^[+-]?\d+$/.test('')` is false). AC#5/ST-17 require an **empty** field + OK to **commit** and clear the override (→ auto width). Instead OK is vetoed and the user is trapped.
- `range(4,40).isValid('1')` → **false** (below min). AC#5/ST-17 require width `1` + OK to **commit and clamp up to 4**; `999` to clamp down to 40. Instead OK is vetoed — no commit, no clamp.

So the chosen validator makes exactly the inputs the ACs care about un-committable. The width clamp the ACs expect already lives in `applyVariant`'s `clampWidth(w, minWidth, maxWidth)` (grid.ts:1190) — the widget must **not** re-gate it.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Width field uses `filter('0-9')` (digits-only live, empty allowed); the min/max clamp happens on OK via the corrected `applyVariant`/`clampWidth`; an empty field maps to `width: undefined` (→ `clearWidths`). | Satisfies AC#5/ST-17 exactly; matches existing datagrid precedent (`filter('0-9.-')`, filter-popup.ts:199); empty→auto works. | Clamp is silent on OK (typing `2` jumps to `4` with no in-dialog warning) — inherent to "clamp-on-commit"; add a static range hint if desired. |
| B | Keep `range()` and amend AC#5/ST-17 to "reject out-of-range + empty, refocus". | No validator change. | Requires editing an RD-owned AC to the opposite behavior; still breaks empty→auto; abandons SAP-ALV-style forgiving input. Rejected. |

**Recommendation:** **Option A.** `range()` is not merely suboptimal here — it is outright wrong for a clamp-on-commit + clear-to-auto field, on two independent inputs (empty and out-of-range). `filter('0-9')` + the already-present `clampWidth` is the only construction that satisfies the ACs, and it mirrors code the datagrid already ships. Implementation notes: keep `maxLength:3`; map an empty field to `undefined` (never `Number('')===0`, which would clamp to `minWidth` and *set* an override).

**Related:** Supersedes AR-7's `range()` choice with new evidence (the verified `range().isValid` semantics AR-7 did not account for). Reinforces PF-003 (empty must map to no-override).

*Confidence: High — the `range().isValid` source is unambiguous and the ACs are explicit. Hardening: challenger converged on Option A (High), flagging Option B as outright broken; added the empty→`undefined` mapping caveat. Challenger: converged.*

**User Decision:** ✅ Resolved — User accepted recommendation (Option A). Applied to AR-7, `00-index.md`/`01-requirements.md` decision tables, `03-03` (Width row + Error Handling), `03-04` (security oracle), `99` task 2.2.2. Width field now `Input({ maxLength:3, validator: filter('0-9') })`; min/max clamp lands on OK via `clampWidth`; empty → `width: undefined`.

---

### PF-002: Column-row controls need reactive state the chosen widgets can't express (freeze-label / last-visible-disable) 🟠 MAJOR

**Dimension:** 13 Codebase Alignment (Architecture Mismatch / Stale Assumption) · also 6 Feasibility
**Location:** `00-ambiguity-register.md` AR-5, AR-6; `03-03-personalize-dialog.md` §Column region (Visibility + Freeze rows); `07` ST-14, ST-16, ST-19
**Codebase Evidence:** `packages/ui/src/controls/switch.ts:56` — `SwitchOptions.disabled?: boolean` (plain boolean, set once in the constructor; no getter, no bind); `packages/ui/src/controls/button.ts:76-78` — the label `raw` is fixed at construction (no setter/getter); by contrast `button.ts:28` — `disabled?: boolean | (() => boolean)` **is** reactive, and `text.ts:5-6` — `Text` content **may** be a reactive getter.

**The Problem:** The column-region rows require two controls whose state must change **after** construction, but the plan's chosen widgets can only take that state at construction:
- **Freeze** — the plan calls for "a cycle `Button` … showing the current side" that cycles `none→left→right`. `Button`'s label is fixed at construction, so it cannot *show* the changing side. (AR-6's "`Button`/field" hedge anticipated this, but 03-03 commits to a Button whose label reflects state.)
- **Visibility** — PF-027/AC#2/ST-14 require the last remaining visible column's toggle to be **disabled**. The plan uses `Switch({ value })`, but `Switch.disabled` is a non-reactive boolean — it cannot become disabled when the visible count drops to 1 without rebuilding the Switch.

Rebuilding a row's widgets to refresh disabled/label state (the only way to keep `Switch`/`Button`-label) breaks focus continuity: the freeze rebuild fires on the **user's own keypress**, on the **focused** widget, and recreating a focused view loses focus — violating the keyboard-operability + focus criteria (AC#11, ST-19). (The count echo is unaffected — `Text(() => …)` is genuinely reactive.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Build each row's widgets **once**, drive state by signals: visibility = a focusable control with reactive `disabled: () => visibleCount()===1 && isVisible(col)` (use `Button.disabled` getter — it greys **and** drops from Tab order — or a small custom focusable `View`); freeze = a static-labelled focusable button (or custom View) with the side shown in an adjacent reactive `Text(() => side)`. | Uses each widget's real reactive surface; preserves focus across every edit; guarantees the last-visible column can't be toggled off. | The row is a Button+Text pair (or a custom cell View) per concern — more assembly; stock `Switch` is off the table for the guarded toggle. |
| B | Keep `Switch` + a cycle `Button` and **rebuild** the affected row's widgets when the visible count crosses 1↔2 or the freeze side changes. | Keeps the stock widgets named in the plan. | The freeze rebuild recreates the focused widget mid-keypress → focus loss (AC#11/ST-19 hazard); fragile remount-then-refocus. Not cleanly buildable. |

**Recommendation:** **Option A.** Route around the two construction-time limits instead of fighting them: the reactive surfaces that exist (`Button.disabled` getter, `Text` getter, or a purpose-built focusable cell `View` in the SortHeader/value-list idiom) cover both requirements with focus preserved and no row rebuild. Explicitly retire stock `Switch` for the guarded visibility toggle. The list is a non-virtualized `Scroller`-over-`Group` (AR-5), so "build once, never rebuild" holds.

**Options considered and dropped:** a two-independent-toggles freeze control (rejected in AR-6 for row width) — unaffected by this finding and not revisited.

**Related:** Refines AR-5/AR-6 with new evidence (`Switch.disabled` non-reactive; `Button` label static) those defaults did not account for.

*Confidence: High — the widget option shapes are read directly from source. Hardening: challenger converged on Option A (High), independently judging Option B "not cleanly buildable" and confirming `Button.disabled` also removes the control from the Tab order. Challenger: converged.*

**User Decision:** ✅ Resolved — User accepted recommendation (Option A). Applied to AR-5/AR-6 (register + resolution note), `03-03` (Visibility + Freeze rows + a new "built once, driven by signals" note), `02` dependency list, `99` tasks 2.2.2/2.2.3. Visibility = reactive-`disabled` `Button`/custom `View` (not `Switch`); freeze = static button + reactive `Text(() => side)`; rows built once, focus preserved.

---

### PF-003: Reset / width-clear must OMIT width in the pending variant, not copy the resolved `GridColumnInfo.width` 🟡 MINOR

**Dimension:** 4 Completeness Gap · also 13 Codebase Alignment
**Location:** `03-01-grid-layout-api.md` §defaultColumnLayout; `03-03-personalize-dialog.md` §Variants panel (Reset) + Width row; `07` ST-18
**Codebase Evidence:** `GridColumnInfo.width` is typed `number` (a **resolved** width — 03-01 §New Types), populated for every column; the override-clearing path is `resolveVariant.clearWidths` = named columns **without** a `width` (03-01 §applyVariant width-restore), and overrides live only in `columnWidths` (grid.ts:379).

**The Problem:** Reset (AC#6) and the empty-width path both require the pending column to carry **no** width override so the corrected `applyVariant` *clears* it. But `defaultColumnLayout()` and `columns()` return a concrete resolved `width: number` for every column. The plan states the *outcome* ("no width overrides") but never states the `GridColumnInfo → GridVariantColumn` **mapping rule**: an implementer who copies `info.width` into `pending.columns[].width` re-establishes an override, so `applyVariant` sets it instead of clearing it and ST-18/AC#6 ("no width overrides") fails. Same trap as an empty width field mapping to `Number('')===0` rather than `undefined` (PF-001).

**Options:** Single viable resolution — add one explicit rule to 03-01/03-03: when translating `defaultColumnLayout()` (or a cleared width field) into the pending variant, **omit** `width` (treat the resolved `GridColumnInfo.width` as display-only); never write it back as an override. (No competing option — this is a clarity/correctness note, not a design choice.)

**Recommendation:** Add the "omit width on Reset / clear; resolved `GridColumnInfo.width` is display-only" rule to 03-01 §defaultColumnLayout and 03-03 §Reset, and cover it with an assertion in ST-18 (already asserts "no width overrides").

**User Decision:** ✅ Resolved — User accepted the fix. Added the "resolved `GridColumnInfo.width` is display-only; Reset/clear omit `width`" rule to `03-01` §defaultColumnLayout and `03-03` §Reset (Mapping rule). ST-18 already asserts "no width overrides".

---

### PF-004: Dialog geometry (size, region split, scroller viewport) unspecified 🔵 OBSERVATION

**Dimension:** 4 Completeness Gap
**Location:** `03-03-personalize-dialog.md` §Architecture (Two regions)
**Codebase Evidence:** The plan pins the body `position:'fill'` (correct, form-dialog.ts:222-227) but gives no dialog width/height, no split between the column-list `Scroller` and the variants panel, and no minimum terminal size. The kitchen-sink/showcase smoke tests only assert "paints ≥1 cell" (kitchen-sink.smoke.spec.test.ts:47), so a too-small or clipped dialog would still pass the gate.

**The Problem:** A two-region modal (scrollable column list + variants panel + OK/Cancel) needs a sizing strategy; leaving it fully implicit risks a clipped layout on small terminals that no test catches. Reasonably deferrable to implementation given the plan's otherwise-high detail, hence an observation.

**Options:** Optionally note a target dialog size / minimum viewport and the region proportions in 03-03 (e.g. size-to-content with a sensible cap, as `FileDialog` does), or explicitly defer geometry to implementation with a one-line acknowledgement.

**Recommendation:** Add a one-line sizing intent to 03-03 (or an explicit "geometry TBD at implementation") so the omission is a decision, not an oversight. Non-blocking.

**User Decision:** ✅ Resolved — User accepted the fix. Added a **Geometry** note to `03-03` §Architecture (fixed rect proportioned to `host.desktop.bounds`; column-list `Scroller` upper, variants panel lower; exact rect tuned at implementation).

---

## Pass/Fail

**✅ PASSED — all 4 findings resolved** (fixes applied to the plan docs; 0 critical, 2 major, 1 minor, 1 observation, all fixed). The plan was exceptionally well-grounded to begin with — every `grid.ts` anchor, the `applyVariant` correction, cross-package helper, line guard, and showcase oracle count checked out against the real source. The two MAJOR findings were widget-behaviour mismatches (a `range()` validator that vetoes the very inputs AC#5 must commit; `Switch.disabled`/`Button`-label being construction-time-only), now corrected to `filter('0-9')` + clamp-on-OK and a build-once reactive-`disabled`/`Text` composition.

> Fixes were applied in-place; a verification re-scan (iteration 2) was not run per the user's choice. Re-run `preflight personalization-dialog` any time to confirm the amended docs scan clean and check for regressions.

## Post-pass roadmap sync

No `plans/00-roadmap.md` (flat-layout roadmap) exists; the nested-layout roadmaps are `codeops/features/datagrid/00-roadmap.md` (feature) + `codeops/00-roadmap.md` (portfolio). Advancing RD-16's plan row to **Plan Preflighted** (🔬) is available via the roadmap skill on request.
