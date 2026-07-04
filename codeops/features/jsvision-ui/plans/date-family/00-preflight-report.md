# Preflight Report: Date family (`Calendar` + `DatePicker`) — RD-20 plan

> **Status**: ✅ **PASSED** — all 5 findings resolved (0 critical, 3 major, 1 minor, 1 observation); fixes applied 2026-07-04
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/date-family/` (10 docs)
> **Codebase Grounded**: 12 source/test files examined, 18 references verified (incl. full TV color-chain decode)
> **Last Updated**: 2026-07-04

> ⚠️ **Independence note**: the plan was authored 2026-07-04; this scan ran after a `/clear`, so context is
> fresh (not literally same-session). TV-fidelity color claims were verified against the **actual** source
> text (`cpCyanWindow`/`cpAppColor`), not from memory, per the same-agent-bias safeguard.

### Codebase Context Summary

**Tech Stack:** TypeScript ESM/NodeNext (`strict`), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/ui` retained widget tree (RD-01 signals + RD-02 layout + RD-03 view/spine + RD-04
event loop) over `@jsvision/core`. RD-14 `dropdown/` ships the internal `openAnchoredPopup` (list-only) + its
two clients `History`/`ComboBox`. Additive `calendar*` theme roles land in core.
**Key Files Examined:** `packages/ui/src/dropdown/{popup,combo-box,history}.ts`,
`packages/ui/src/list/{list-view,list-rows}.ts`, `packages/ui/src/controls/validators/picture.ts`,
`packages/core/src/engine/color/{theme,palette}.ts`, `packages/ui/test/{tabs-theme,feedback-theme,table-theme}.spec.test.ts`,
TV `examples/tvdemo/calendar.{cpp,h}`, `include/tvision/{app.h,views.h}`.

**Reference verification (all PASS):**
- TV `TCalendarView` 20×8 geometry (`TRect(1,1,23,11)`=22×10, `grow(-1,-1)`), ▲ col 15 / ▼ col 18, `j*3`
  columns, Zeller `dayOfWeek` (100-121), leap 128-129 — **exact** vs `calendar.cpp`.
- **Color chain (highest fidelity risk) — exact**: `getColor(6)`→`cpCyanWindow[6]=0x15`→`cpAppColor[21]=0x3E`
  (yellow-on-cyan); `getColor(7)`→`cpCyanWindow[7]=0x16`→`cpAppColor[22]=0x21` (blue-on-green). `TCalendarView`
  has **no** `getPalette()` override (calendar.h), so the owner `wpCyanWindow` chain holds.
- `popup.ts` `openAnchoredPopup`@199, `placePopup`@181-190; `combo-box.ts` `ComboButton`@67-88, `open`@189-214;
  `picture()`@397; `clusterDisabled` `0x38`@320; `ListView.selected`/`activate()` — all exist as cited.
- `tabs-theme.spec` ST-30 has `LATER_ADDITIVE_ROLES`; `feedback-theme.spec` ST-11 has a closed-set inventory
  (no `LATER_ADDITIVE` scaffold); `table-theme.spec` has no inventory guard.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 3 | Logical Contradictions | 3 (PF-001/002/003) | 🟠 MAJOR |
| 4 | Completeness Gaps | 1 (PF-001) | 🟠 MAJOR |
| 6 | Feasibility Concerns | 2 (PF-001/002) | 🟠 MAJOR |
| 9 | Edge Cases | 1 (PF-003) | 🟠 MAJOR |
| 12 | Consistency | 2 (PF-004/005) | 🟡 MINOR |
| 13 | Codebase Alignment | 0 | ✅ clean |
| 1,2,5,7,8,10,11 | (Ambiguities, Assumptions, Deps, Testability, Security, Scope, Ordering) | 0 | ✅ clean |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | all resolved |
| MINOR | 1 | all resolved |
| OBSERVATION | 1 | all resolved |

---

### PF-001: Popup generalization — content→dismiss commit channel is unspecified 🟠 MAJOR

**Dimension:** Completeness Gap / Logical Contradiction / Feasibility
**Location:** `03-03-date-picker.md` Part A ("Focus + dismiss + commit rewiring" + the `AfterPopupOptions` API); `02-current-state.md` Gap 1.
**Codebase Evidence:** `packages/ui/src/dropdown/popup.ts:212` (`const list = opts.buildList()` — content built *inside* the popup's `createRoot`, caller never holds it, per the RD-14 leak-fix at popup.ts:65-70/207-211), `popup.ts:258-269` (the `list.selected()` pick effect the plan removes), `popup.ts:54-57` (the returned handle exposes only `dismiss()`).
**The Problem:** The generalized API is `buildContent(): View` + a top-level caller `commit()` + `focusTarget(content): View`. Today the **popup** bridges activation→dismiss by watching `list.selected()`; the plan removes that effect. But `buildContent(): View` hands the content no reference to the popup's commit-then-dismiss, and the caller's `commit` can't "read the list's own selected index" (03-03) because the list is built in a scope the caller can't see. So neither direction has a wiring channel — the prose ("the content calls the injected commit()") contradicts the signature. An exec agent must invent the channel, risking a leaked effect (outside the popup `createRoot`) or a behavior drift that breaks AC-13 (History/ComboBox byte-identical). *Independent challenger: REAL — "no specified channel in either direction."*

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Thread the trigger into the factory: `buildContent(commit: () => void): View`. The popup builds `commit = () => { opts.commit?.(); dismiss(); }` and passes it in; ListView callers wire it to `activate`/`onSelect`, Calendar calls it on day-commit. | Matches the "content calls the injected commit()" prose; one channel; keeps content in-root | Signature change from the doc's `buildContent(): View` |
| B | Keep an activation-signal seam the popup watches: `activation(content): Signal<number>` (ListView → `selected`; Calendar → a new commit-tick signal). | Closest to today's `selected()` watch | Forces every content type to expose an activation signal; more surface than A |

**Recommendation:** Option A — inject `commit` into `buildContent`. It is the literal realization of the plan's own prose, needs no new per-content signal, and keeps the ListView refactor a mechanical "call `commit` from `activate`" (byte-identical behavior). Pin the exact signature + the ListView wiring in 03-03 Part A. *Confidence: High. Hardening: independent challenger confirmed REAL; recommendation unchanged.*

**User Decision:** Resolved — User accepted recommendation: Option A (`buildContent(commit): View`; content wires its activation callback to the injected trigger). Applied to 03-03 Part A + 02 Gap 1 + register PA-5 + exec 1.2.3/1.2.4.

---

### PF-002: `placePopup` height reconciliation is off-by-one vs the byte-identical guarantee 🟠 MAJOR

**Dimension:** Logical Contradiction / Feasibility
**Location:** `03-03-date-picker.md` Part A ("Placement reconciliation"); `02-current-state.md` Gap 1 fix.
**Codebase Evidence:** `packages/ui/src/dropdown/popup.ts:181-190` — `grown.height = maxRows + 3` (line 186) → `intersect` → `Math.max(0, clamped.height − 1)` (line 189); unclamped final = **maxRows + 2** (frame `padding:1` ⇒ interior = maxRows rows), matching the load-bearing comment at popup.ts:152-153.
**The Problem:** The plan says generalized `placePopup` "sizes from `contentHeight + 2` then applies the identical … `−1` sequence" and callers pass `contentSize.height = maxRows + 2`. Arithmetic: `(maxRows+2) + 2 − 1 = maxRows + 3` ≠ the current `maxRows + 2`. The plan double-counts the frame — it calls `maxRows+2` "today's unclamped list height", but `maxRows+2` is the **frame rect** height; the list *content* is `maxRows`. As written, History/ComboBox popups grow one row taller, breaking AC-13 (their tests would fail, forcing rework, and the "reproduces the current rect exactly" claim is false). *Independent challenger: REAL — confirmed the double-count.*

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep `placePopup` intermediate = `contentHeight + 2` and the `−1`; callers pass `contentSize.height = maxRows + 1`. → `(maxRows+1)+2−1 = maxRows+2`. Document `contentHeight` = **content** rows (list = maxRows visible; Calendar = 8). | Preserves the exact clamp+`−1` bottom-edge semantics; content-height is the natural unit | The `+2`/`−1` dance is non-obvious; needs a clear comment |
| B | Redefine so `placePopup` produces frame height = `contentHeight + 2` directly (drop the `−1`), applying the clamp as a plain `intersect`; callers pass `contentSize.height = maxRows`. | Cleanest mental model (frame = content + 2 border) | Loses the TV `intersect`-then-`−1` bottom-edge truncation nuance the current comment flags as load-bearing; risks a *different* clamp-edge drift |

**Recommendation:** Option A — pass `contentSize.height = maxRows + 1` and keep the `+2 … −1` sequence verbatim. It reproduces the current rect to the cell **and** preserves the bottom-edge clamp semantics the code explicitly calls load-bearing; AC-13 then holds by construction. Correct the arithmetic + the "today's unclamped list height" label in 03-03 and 02. *Confidence: High. Hardening: challenger reproduced the off-by-one; recommendation unchanged.*

**User Decision:** Resolved — User accepted recommendation: Option A (list callers pass `contentSize.height = maxRows + 1`, keep `+2 … −1`; intermediate `(maxRows+1)+2 = maxRows+3` = current). Applied to 03-03 + 02 + register PA-5 + exec 1.2.4.

---

### PF-003: Week-number mode shifts the header but the month-nav hit columns stay hardcoded at 15/18 🟠 MAJOR

**Dimension:** Logical Contradiction / Edge Cases
**Location:** `03-02-calendar.md` — the week-number width note ("Weekday-label row and header shift accordingly") vs the "**Mouse (`onEvent`)**" paragraph ("a click at header (15,0)/(18,0) ⇒ next/prev month").
**Codebase Evidence:** `calendar.cpp:185-204` (TV hit-test is `point.x==15`/`point.x==18`, valid only for the un-prefixed 20-col view); the plan's own `dayColumn(j, weekNumberCol)` (03-02) *does* offset by the 3-cell week column, so the day path is parameterized but the header path is not.
**The Problem:** With `showWeekNumbers: true`, the 3-cell week column shifts the header right (per the plan), so ▲/▼ render at cols 18/21 — but the click handler tests the fixed 15/18. Result: month-nav arrows are dead in week-number mode. The combination (week numbers + header click) isn't covered by any ST oracle (ST-7 tests header click *without* week numbers; ST-9 renders week numbers but doesn't click the header), so it would ship as a latent bug. *Independent challenger: REAL contradiction.*

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Parameterize the header hit columns like `dayColumn`: `arrowNextCol = weekNumberColWidth + 15`, `arrowPrevCol = weekNumberColWidth + 18`. Header + weekday row + arrows all shift by the same offset. | Consistent with the (already-shifting) grid; one offset everywhere | Slightly more hit-test math |
| B | Do **not** shift the header/weekday-header — keep month/year/▲/▼ at cols 0-19 and only prefix the 6 **day** rows (+ optionally the weekday-label row) with the week column. Hit test stays 15/18. | Zero change to the decoded TV hit columns | Weekday labels must still shift to align with day columns → the header and weekday row then use different origins (visually odd); needs an explicit decision |

**Recommendation:** Option A — shift the header hit columns by `weekNumberColWidth`, matching the grid. The plan already commits to "header shift accordingly" and offsets `dayColumn`; making the hit-test use the same offset is the consistent, single-source-of-truth fix. Add an ST oracle for header-click **with** `showWeekNumbers` so the combination is guarded. *Confidence: High. Hardening: challenger confirmed; recommendation unchanged.*

**User Decision:** Resolved — User accepted recommendation: Option A (header hit columns offset by `weekNumberColWidth`, matching `dayColumn`; ST-9 oracle strengthened to guard header-click with week numbers). Applied to 03-02 + 07.

---

### PF-004: ST range stated as "ST-1…ST-19" but only ST-1…ST-17 exist 🟡 MINOR

**Dimension:** Consistency
**Location:** `00-index.md:43` ("ST-1…ST-19 spec oracles ↔ AC-1…AC-17") and `01-requirements.md:137` ("encoded as ST-1…ST-19").
**Codebase Evidence:** `07-testing-strategy.md` defines exactly **ST-1…ST-17** (17 oracles), a clean 1:1 with RD-20's AC-1…AC-17 (verified: RD-20 tops out at AC-17). The execution plan references ST-2…ST-17 throughout — no ST-18/19 anywhere.
**The Problem:** Two docs claim a 19-oracle range that doesn't exist; harmless but confusing and contradicts the actual 17. **This finding is document-only.**

**Options:** Single viable — correct both references to **ST-1…ST-17**. (No alternative: the count is simply wrong.)

**Recommendation:** Replace "ST-1…ST-19" with "ST-1…ST-17" in `00-index.md:43` and `01-requirements.md:137`.

**User Decision:** Resolved — corrected `ST-1…ST-19` → `ST-1…ST-17` in 00-index:43 and 01-requirements:137.

---

### PF-005: PA-14 guard enumeration under-states which closed-set guards trip 🔵 OBSERVATION

**Dimension:** Consistency / Codebase Alignment (informational)
**Location:** `00-ambiguity-register.md` PA-14; `03-04-theme-packaging.md` ("tabs-theme.spec (ST-30) — and possibly a feedback/table guard").
**Codebase Evidence:** `tabs-theme.spec.test.ts:120` — `LATER_ADDITIVE_ROLES=['progressFill','progressTrack']` (extend with the 6 `calendar*`). `feedback-theme.spec.test.ts:47,119` — ST-11 is **also** a closed-set inventory (`knownKeys = EXPECTED_UNCHANGED + FEEDBACK_ROLES`) that will **certainly** trip, and it has **no** `LATER_ADDITIVE_ROLES` scaffold, so the exec agent must *add* the tolerated set there (not just append to an existing list). `table-theme.spec.test.ts` has **no** inventory guard (only a `cpListViewer` regression check) — it will not trip.
**The Problem:** "possibly a feedback/table guard" understates: feedback ST-11 is a certainty (and needs a new allowlist, unlike tabs), table is a non-issue. The plan's grep-at-exec prescription (`grep -rn "LATER_ADDITIVE_ROLES\|additive\|ONLY"`) *will* surface both, so this is not a blocker — just a precision note.

**Options:** Single viable — tighten PA-14 / 03-04 to enumerate the two certain guards (tabs `ST-30`, feedback `ST-11`) and note feedback needs a *new* `LATER_ADDITIVE_ROLES`, table is unaffected.

**Recommendation:** Optional wording tightening; the grep prescription already makes exec correct. Accept as-is or apply the one-line enumeration.

**User Decision:** Resolved — enumerated the two certain guards (tabs `ST-30`, feedback `ST-11`; table unaffected) in register PA-14 + 03-04 + exec 1.1.4.

---

## Adversarial checklist (same-agent-bias safeguard)

- **Color indirection** (where TV fidelity silently breaks): verified the full `getColor→cpCyanWindow→cpAppColor`
  chain against the actual source strings — 0x3E/0x21 are exact. ✅
- **"Byte-identical" claims**: pressure-tested arithmetically (PF-002) — found the off-by-one. ✅
- **Extension combinations** (week numbers × header click): found the untested contradiction (PF-003). ✅
- **What a TV expert would flag**: nothing beyond the above — the geometry/glyph/palette decode is faithful.
