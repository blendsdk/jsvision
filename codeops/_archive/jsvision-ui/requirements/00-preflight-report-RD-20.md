# Preflight Report: RD-20 — Date family (Calendar + DatePicker)

> **Status**: ✅ PASSED — all 8 findings resolved (User accepted every recommendation; fixes applied 2026-07-04)
> **Iteration**: 1 (first scan)
> **Artifact**: Requirements doc at `codeops/features/jsvision-ui/requirements/RD-20-date-family.md`
> **Codebase Grounded**: 9 source files examined (TV `calendar.cpp`/`calendar.h`/`objects.h`/`tview.cpp`; ui `popup.ts`/`combo-box.ts`/`history.ts`/`picture.ts`/`index.ts`), 12 references verified
> **Last Updated**: 2026-07-04

_Not a same-session review — RD-20 was authored 2026-07-03; reviewed in a fresh session 2026-07-04 (lower same-agent-bias risk). The flagship geometry finding (PF-001) was independently verified by an adversarial challenger against the C++ source._

### Codebase Context Summary

**Tech Stack:** TypeScript ESM/NodeNext, yarn 1.x + Turborepo monorepo, zero runtime deps, vitest. `@jsvision/ui` is a faithful Turbo Vision re-creation on `@jsvision/core`.
**Architecture:** Retained widget tree (`View`/`Group`) + fine-grained signals; dir-per-concern subsystems under `packages/ui/src/`; TV-fidelity is NON-NEGOTIABLE (drawing/geometry/colors must match the original C++); spec-test ACs are immutable oracles.
**Key Files Examined:** `tvision/examples/tvdemo/calendar.cpp` + `calendar.h` (the `TCalendarView` decode source), `tvision/include/tvision/objects.h` (`TRect::grow`), `tvision/source/tvision/tview.cpp` (`getExtent`), `packages/ui/src/dropdown/popup.ts` (`openAnchoredPopup`), `combo-box.ts`, `history.ts`, `controls/validators/picture.ts`, `src/index.ts` + `dropdown/index.ts` (public surface).

**Reference Verification:** 12 references mapped — 11 verified accurate, 1 with a decode error (view geometry, PF-001):
- ✅ `openAnchoredPopup`/`AnchoredPopupOptions` confirmed **internal** (not in the public `src/index.ts` barrel) — the AR-204 "additive, non-public-breaking" claim is accurate.
- ✅ `ComboButton` (combo-box.ts:67-88), open/commit lifecycle (175-214), `host === undefined` headless guard (191), `picture()` (picture.ts:397), `history.ts` as a popup client — all confirmed.
- ✅ TV decode of `draw()` — header layout, ▲/▼ hit columns (x=15/x=18), weekday labels, `j*3` day columns, `getColor(6/7)`, `1 - dayOfWeek` leading offset, leap-rule citation — all confirmed against `calendar.cpp`.
- ❌ **View geometry: RD says 22×8; the faithful view is 20×8** (see PF-001).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-007) | 🟡 |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 (PF-002) | 🟠 |
| 4 | Completeness Gaps | 1 (PF-003) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-003) | 🟠 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 2 (PF-006, PF-007) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-004, PF-005) | 🟡 |
| 13 | Codebase / Source Alignment | 2 (PF-001, PF-002) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | ✅ all resolved (applied) |
| MINOR | 4 | ✅ all resolved (applied) |
| OBSERVATION | 1 | ✅ resolved (applied) |

---

### PF-001: Calendar geometry mis-decoded — the faithful view is 20×8, not 22×8 🟠 MAJOR

**Dimension:** 13 (Source Alignment) + 3 (Contradiction)
**Location:** RD-20 decode table (line 35), prose (lines 52, 78, 131), AC-3 (line 308), plus README line 68.
**Codebase Evidence:** `calendar.cpp:270,279-280`; `include/tvision/objects.h:148-155` (`grow`); `source/tvision/tview.cpp:521-524` (`getExtent`); `calendar.cpp:139-148,150-171` (content widths).
**The Problem:** The RD pins the calendar at **22 columns** everywhere, including the immutable oracle AC-3 ("draws a **22-column** block"). The real `TCalendarView` extent is **20 columns**:
- Window `TWindow(TRect(1,1,23,11))` = 22×10. The view is inserted at `r = getExtent(); r.grow(-1,-1)` → `getExtent()` = `(0,0,22,10)`; `grow(-1,-1)` does `a.x+=1, b.x-=1` → `(1,1,21,9)` → **view size 20×8**.
- Every content string is exactly 20 wide: header `%9s %4d ▲  ▼ ` = 20 (▲ at col 15, ▼ at col 18 — matching the decoded hit columns); `"Su Mo Tu We Th Fr Sa"` = 20; day grid cols 0–19 = 20.
- The `22` in the code is only `moveChar(0,' ',color,22)`/`writeLine(0,y,22,…)` — an over-allocated buffer clipped to the 20-col view.

The RD conflated the 22-wide **window** with the **view** (it correctly took height 8 from the grown view but width 22 from the ungrown window). In a NON-NEGOTIABLE-fidelity project where ACs are immutable oracles, AC-3 would pin the wrong width, and it propagates to the DatePicker popup content-size ("Calendar is fixed 22×8") and the README.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Correct the decode to **20×8** everywhere (table, prose, AC-3, DatePicker size, README); note the buffer is filled to 22 but clipped to the 20-col view | Faithful; fixes the oracle now while the number is known; no wrong spec test written | Touches ~7 lines across the RD + README |
| B | Leave "22" and rely on plan GATE-1/GATE-2 to correct it | No RD edit now | GATE-2 would then contradict the AC-3 oracle → per the project rule the spec test is the defect and must be rewritten; defers a knowable fix into implementation |

**Recommendation:** **Option A** — the correct extent (20×8) is knowable now and independently confirmed against `grow`/`getExtent` + the content-string widths. Fixing it in the RD keeps AC-3 a correct immutable oracle instead of one GATE-2 will have to overturn.
_Confidence: High. Hardening: challenger CONFIRMED, re-derived `grow`/`getExtent` and all three content-string widths independently._

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.

---

### PF-002: "Trailing/adjacent-month day" theme role contradicts the blank-cell decode 🟠 MAJOR

**Dimension:** 3 (Contradiction) / 4 (Completeness) / 13 (Source Alignment)
**Location:** RD-20 theme roles (line 141, AR-207 line 262) + AC-14 (line 348), vs the geometry decode (line 40) + AC-3 (line 312).
**Codebase Evidence:** `calendar.cpp:155-156` — out-of-range cells draw `"   "` (blanks) in `color` (`getColor(6)`, the normal role); TV has **no** distinct attribute for leading/trailing cells and draws **no** adjacent-month day numbers.
**The Problem:** The RD introduces a distinct `calendar*` role **"trailing/adjacent-month day"** (AR-207; listed in AC-14), but:
- The geometry decode (line 40) and AC-3 (line 312) say those cells are **blanks** ("leading/trailing blanks"), and no functional requirement (the `Calendar` FR block) ever states adjacent-month **day numbers** are drawn.
- If cells stay blank (TV-faithful), an "adjacent-month **day**" color role is meaningless — and TV paints those blanks in the *normal* `getColor(6)`, so even a distinct trailing *color* deviates from the decode.
- If adjacent-month day numbers **are** drawn (a modern extension), that contradicts AC-3's "blanks" and, per the RD's own convention (cf. the AR-199 day-nav deviation), must be recorded as an explicit documented deviation with its own FR + AC — which it isn't.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **TV-faithful blanks**: drop the "trailing/adjacent-month day" role; leading/trailing cells are blank in the normal role | Matches `TCalendarView` exactly; simplest; no deviation to document | Loses the modern "spill" affordance (can add later as a documented extension) |
| B | **Documented extension**: draw adjacent-month day numbers in a dimmed role; add an explicit FR + a "deviates from TV blank cells" note (like AR-199) + amend AC-3 and add an AC for it | Modern UX; the role gains meaning | New deviation to document + test; more surface; AC-3 must change |

**Recommendation:** **Option A** — the directive is decode-not-design, and the decode is unambiguous (blank cells, one attribute). Dropping the role keeps the grid faithful; adjacent-month spill can be a future documented extension if wanted. Either way the contradiction must be resolved — the role and AC-3 currently disagree.
_Confidence: High. Hardening: challenger CONFIRMED against `calendar.cpp:155-156`._

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.

---

### PF-003: Localized/textual month formats are in v1 scope but have no acceptance criterion 🟠 MAJOR

**Dimension:** 4 (Completeness) / 7 (Testability)
**Location:** RD-20 AR-203 (lines 254-255) + DatePicker field mask (line 115-117), vs AC-12 (lines 341-342).
**Codebase Evidence:** `controls/validators/picture.ts:10,280-291` — `picture` supports letter masks (`?` letter, `&` letter→upper, `!`/`@` any), so a textual month format is **feasible** (letter mask + the format's parse/serialize pair does the semantic month-name validation, as `parseISO` does at `picture.ts:284-285` analog). AC-12 tests only `DD/MM/YYYY` (a pure digit reorder).
**The Problem:** AR-203 puts "configurable format/locale" in v1 scope and **explicitly names "localized month names selectable"**. This is feasible (the challenger corrected my initial "infeasible" read — letter masks + a parse/serialize pair handle it), but there is **no acceptance criterion** for a textual/localized format: AC-12 covers only a digit reorder. An in-v1-scope requirement therefore ships with no immutable oracle — make_plan would either invent an untested textual-format behavior or silently drop localized month names.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Defer localized/textual month names** (a tracked DEF-NN); scope v1 format-config to digit-reorder masks — matching what AC-12 actually tests | Tightens v1 to what's specified + tested; honest scope; digit reorders cover the common cases (ISO, DD/MM/YYYY, MM/DD/YYYY) | Drops a named affordance from v1 |
| B | **Keep it in v1 and add an AC**: a textual-format oracle (e.g. `format: 'DD MMM YYYY'` round-tripping `"15 Sep 2026"` ⟷ `{2026,9,15}`, invalid month name → unchanged), plus a note that a letter-permissive picture + parse/serialize pair gates it | Honors the AR-203 decision fully; testable | More v1 surface (locale month tables + a textual parser) — larger slice |

**Recommendation:** **Option A** — defer localized/textual month names. AR-203's core value (a configurable field format) is preserved with digit-reorder masks (ISO / DD-MM / MM-DD), which AC-12 already tests; localized month tables are a separable enhancement that otherwise ships with no oracle. This surfaces new information (the missing AC), not a re-litigation of the "format config in v1" decision. _If you prefer to keep the full AR-203 scope, Option B is the alternative — but it needs the new AC._
_Confidence: Medium. Hardening: challenger REFINED — corrected my "infeasible" framing to a completeness/testability gap; the pick changed from "cut as infeasible" to "defer / add AC."_

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.

---

### PF-004: RD-20's three deferred items are not in the central `DEFERRED.md` register 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** RD-20 "Deferred (tracked)" table (lines 173-180), vs `DEFERRED.md`.
**Codebase Evidence:** `DEFERRED.md:45` lists the sibling RD-21's deferral as **DEF-26**, but RD-20's three deferred items (date-range selection, time/datetime picker, multi-month/year views) have no DEF-NN and are absent from `DEFERRED.md`.
**The Problem:** The RD cites the "AR-99 convention (explicit register so nothing is lost)" and RD-21 followed it (DEF-26 in the central register), but RD-20's deferrals live only in an inline table. Inconsistent tracking; the central register is the project's single source for deferrals.

**Options:** One viable path (mechanical consistency fix). Considered and dropped: leaving it inline-only — rejected because it diverges from the just-established RD-21 pattern in the same set.

**Recommendation:** Add the three RD-20 deferrals to `DEFERRED.md` as DEF-27/28/29 (or the next free IDs), cross-referencing the RD-20 inline table.

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.

---

### PF-005: Feature-Overview `CalendarDate` helper list omits `addDays` and `parseISO` 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** Feature Overview line 54 vs Must-Have line 66-70.
**The Problem:** The overview lists helpers `daysInMonth, dayOfWeek, addMonths, compare, toISO` + `fromDate`/`toDate`, but the normative Must-Have list adds `addDays` and `parseISO` (and `parseISO` is load-bearing — AC-1 tests it). Minor drift between the summary and the normative list.

**Recommendation:** Add `addDays` and `parseISO` to the Feature-Overview helper list to match Must-Have. (Purely editorial.)

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.

---

### PF-006: Role precedence when a day is both "today" and "selected" is unspecified 🟡 MINOR

**Dimension:** 9 (Edge Cases)
**Location:** RD-20 lines 80-84, AC-4/AC-5.
**The Problem:** The RD says today (role `getColor(7)`) and selected (distinct role) are drawn distinctly "so both can show at once" — but when the selected day **is** today (same cell), it can only carry one attribute. Which role wins is not stated; AC-4/AC-5 don't cover the overlap.

**Recommendation:** Specify precedence — recommend **selected wins** over today when they coincide (the selection is the user's active choice), and add a one-line AC. Cheap to pin now; avoids an arbitrary implementation choice.

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.

---

### PF-007: ISO week number for a Sunday-started display row is ambiguous 🟡 MINOR

**Dimension:** 1 (Ambiguity) / 9 (Edge Cases)
**Location:** AR-202 (line 257) + AC-9 (lines 331-333).
**The Problem:** AR-202 says the week-number column uses ISO-8601 (Monday-based weeks) "regardless of `firstDayOfWeek`". When `firstDayOfWeek: 0` (Sunday), each displayed row is Sun–Sat, straddling two ISO (Mon–Sun) weeks — so which ISO week number labels a Sunday-started row is undefined (the row's Thursday? its Monday?).

**Recommendation:** Define the rule — recommend "the ISO week of the row's **Thursday**" (the ISO anchor day), so the number is stable regardless of `firstDayOfWeek`, and note it in AR-202/AC-9.

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.

---

### PF-008: DatePicker → Calendar pass-through of `min`/`max`/`isDisabled`/`firstDayOfWeek` not stated 🔵 OBSERVATION

**Dimension:** 4 (Completeness)
**Location:** RD-20 DatePicker section (lines 109-125) vs Calendar options (lines 98-107).
**The Problem:** The `Calendar` exposes `min`/`max`/`isDisabled`/`firstDayOfWeek`/`showWeekNumbers`, but the `DatePicker` section doesn't state these forward to its hosted `Calendar`. Presumably they do (via DatePicker options), but it's implicit.

**Recommendation:** Add one line: the `DatePicker` forwards the relevant `Calendar` options (`min`/`max`/`isDisabled`/`firstDayOfWeek`/`showWeekNumbers`/`today`) to its hosted calendar. Observation only — resolvable at plan time.

**User Decision:** Resolved — User accepted recommendation; fix applied 2026-07-04.
