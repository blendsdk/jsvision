# Execution Plan: Date family (`Calendar` + `DatePicker`)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-04 11:24
> **Progress**: 35/35 tasks (100%)
> **CodeOps Skills Version**: 3.2.0

## Overview

Implement `CalendarDate` + `Calendar` + `DatePicker` in a new `src/date/` subsystem over the shipped
RD-01…RD-14 facilities, plus 6 additive core `calendar*` theme roles, the **additive generalization**
of RD-14's internal `openAnchoredPopup` (History/ComboBox stay byte-identical), kitchen-sink stories,
and a headless `demo:date`. `Calendar` **has a TV counterpart** (`TCalendarView`, `calendar.cpp`), so
the GATE-1 BEFORE-decode + GATE-2 AFTER-diff are **mandatory** (per the NON-NEGOTIABLE TV-fidelity
directive + `codeops/tv-fidelity-gate.md`): decode the 20×8 geometry + `«month» «year» ▲▼` header + hit
columns + `j*3` day columns + the `getColor` chain (normal `0x3E`, today `0x21`) BEFORE, and diff the
rendered buffer cell-by-cell AFTER. The selection/nav/picker extensions get spec oracles but no diff.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | GATE-1 decode + core `calendar*` roles + anchored-popup generalization | 10 |
| 2 | `CalendarDate` value + pure helpers (spec-first) | 4 |
| 3 | `Calendar` view — grid, nav cursor, selection, bounds, week# (spec-first) | 5 |
| 4 | `DatePicker` + `date-format` (spec-first) | 5 |
| 5 | GATE-2 AFTER-diff + impl tests & hardening | 4 |
| 6 | Packaging, kitchen-sink stories, `demo:date` | 7 |

**Total: 35 tasks across 6 phases.**

---

## Phase 1: GATE-1 decode + core `calendar*` roles + anchored-popup generalization

### Step 1.1: GATE-1 BEFORE-decode + the 6 theme roles (spec-first)

**Reference**: [03-02](03-02-calendar.md) · [03-04](03-04-theme-packaging.md)
**Objective**: Record the fidelity decode; land the 6 additive roles spec-first; extend the cross-RD guard.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 1.1.1 | **[GATE-1 BEFORE-decode]** Record in `03-02` (already drafted) + confirm/expand: the 20×8 view geometry (`grow(-1,-1)`, PF-001), header `«month» «year» ▲▼` with ▲ col 15 / ▼ col 18, weekday row, `j*3` day columns, leading-blank offset, and the `getColor(6)`→`0x3E` / `getColor(7)`→`0x21` chain via `wpCyanWindow`→`cpAppColor`. This decode is echoed into the `calendar.ts`/`calendar-grid.ts` JSDoc in Phase 3. | `03-02-calendar.md` |
| 1.1.2 | Write `date-theme.spec.test.ts` (ST-14): the 6 `calendar*` roles exist with the PA-3 bytes, `encode()` non-throw, and an additive-guard snapshot (no existing role changed). | `packages/ui/test/date-theme.spec.test.ts` |
| 1.1.3 | Run spec tests — verify **FAIL** (red) | — |
| 1.1.4 | Implement the 6 additive `calendar*` roles in `Theme` + `defaultTheme` (bytes from 1.1.1, JSDoc citing the decode/PA). **PA-14:** extend the **two** closed-set guards — `tabs-theme.spec` ST-30 (append to its `LATER_ADDITIVE_ROLES`) + `feedback-theme.spec` ST-11 (add a `LATER_ADDITIVE_ROLES` set — it has none) — with the 6 roles; `table-theme.spec` is unaffected. Still `grep -rn "LATER_ADDITIVE_ROLES\|additive\|ONLY" packages/ui/test/*theme*` to catch any newer guard. **Keep every byte assertion**. | `packages/core/src/engine/color/theme.ts`, `packages/ui/test/*theme*.spec.test.ts` |
| 1.1.5 | Run spec tests — verify **PASS** (green); `yarn verify` | — |

### Step 1.2: Generalize `openAnchoredPopup` (RD-14 refactor, spec-first)

**Reference**: [03-03 Part A](03-03-date-picker.md) · [02](02-current-state.md)
**Objective**: Host any fixed-size `View`; refactor History/ComboBox byte-identical; their tests stay green.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 1.2.1 | Write `date-popup.spec.test.ts` (ST-13): `openAnchoredPopup` hosts a fixed-size **non-list** `View` via `buildContent()` + `contentSize` + `commit()` + `focusTarget` — focuses the content, commits on activation, dismisses on Esc/outside. MUST NOT read impl logic. | `packages/ui/test/date-popup.spec.test.ts` |
| 1.2.2 | Run — verify **FAIL** (red) | — |
| 1.2.3 | Generalize `openAnchoredPopup`: swap `buildList`/`onPick`/`maxRows`(+`<T>`) for `buildContent(commit)`/`contentSize`/`focusTarget`; `placePopup` intermediate height = `contentHeight + 2` then the **identical** intersect-clamp + `−1` (kept verbatim); the popup **injects** `commit = () => { if (!dismissed) dismiss(); }` into `buildContent`; rewire focus + focus-loss dismissal to `focusTarget`; **remove** the internal `list.selected()` pick effect + `firstSelection` guard; catcher/frame/`absoluteRect`/`createRoot` unchanged. Keep it internal (no barrel export). | `packages/ui/src/dropdown/popup.ts` |
| 1.2.4 | Refactor `history.ts` + `combo-box.ts` to the generalized call: `contentSize = { height: maxRows + 1 }` (reproduces the current rect **exactly** — NOT `maxRows + 2`), `focusTarget = (c) => (c as ListView).rows`, and a `ListView.onSelect` that runs the moved `onPick`/`pick` body **then** calls the injected `commit()`. | `packages/ui/src/dropdown/history.ts`, `packages/ui/src/dropdown/combo-box.ts` |
| 1.2.5 | Run `date-popup.spec` **PASS** (green) **and** the full RD-14 `history.*` + `combo-box.*` suites **green, unchanged** (AC-13 — fix code, never their tests); `yarn verify` | — |

**Deliverables**:
- [x] GATE-1 BEFORE-decode recorded (geometry + hit columns + `getColor` chain)
- [x] 6 `calendar*` roles land additively; guard allowlist extended; no existing role/byte changed
- [x] `openAnchoredPopup` generalized; History/ComboBox byte-identical + their tests green
- [x] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 2: `CalendarDate` value + pure helpers (spec-first)

### Step 2.1: Specification tests → implementation

**Reference**: [03-01](03-01-calendar-date.md) · [07](07-testing-strategy.md)
**Objective**: The civil-date value + zero-dep helpers, oracle-first.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 2.1.1 | Write `calendar-date.spec.test.ts` (ST-1: leap/century `daysInMonth`, `dayOfWeek`, `toISO`, `parseISO` null cases, `fromDate`/`toDate` 1-based round-trip). MUST NOT read impl. Run — verify **FAIL** (red). | `packages/ui/test/calendar-date.spec.test.ts` |
| 2.1.2 | Verify red (documented) | — |
| 2.2.1 | Implement `calendar-date.ts` (`CalendarDate` + `daysInMonth`/`dayOfWeek`/`addMonths`/`addDays`/`compare`/`toISO`/`parseISO`/`fromDate`/`toDate`; pure, zero-dep, `parseISO` null-safe). ≤ 500 lines. | `packages/ui/src/date/calendar-date.ts` |
| 2.2.2 | Run `calendar-date.spec` **PASS** (green; fix code, never the spec); `yarn verify` | — |

**Deliverables**:
- [x] `calendar-date.spec` red before impl, green after
- [x] `calendar-date.ts` implemented, zero-dep, `parseISO` never throws
- [x] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 3: `Calendar` view — grid, nav cursor, selection, bounds, week# (spec-first)

### Step 3.1: Specification tests (BEFORE implementation)

**Reference**: [03-02](03-02-calendar.md) · [07](07-testing-strategy.md)
**Objective**: Encode the geometry + colour + selection + nav oracles before any view code.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 3.1.1 | Write `calendar.spec.test.ts` (ST-2…ST-9): render-through-loop (`createEventLoop`+`mount`); ST-3 grid geometry + ST-4 today/normal colours asserted **cell-by-cell pre-`serialize`** vs the `calendar.cpp` decode; ST-5 selection + precedence; ST-6 day-nav keymap; ST-7 month nav; ST-8 min/max + disabled; ST-9 first-day + week#. Inject a fixed `today`. MUST NOT read impl. | `packages/ui/test/calendar.spec.test.ts` |
| 3.1.2 | Run — verify **FAIL** (red) | — |

### Step 3.2: Implementation

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 3.2.1 | Implement `calendar-grid.ts` (pure): `buildMonthGrid` (leading offset + `firstDayOfWeek` rotation + null blanks), `dayColumn`, `isoWeek` (row-Thursday ISO-8601, PA-10). Record the decode/PA in JSDoc. | `packages/ui/src/date/calendar-grid.ts` |
| 3.2.2 | Implement `calendar.ts` (`Calendar extends View`): draw (header + weekday row + grid via `calendar-grid`), the `cellRole` precedence helper (PA-4), day/month keymap (PA-9/AR-199), cursor `Signal` init+clamp, mouse (header hit-cols + day click→move+commit), `commit` (disabled/bounds no-op), `today` default at mount, `select`/`today`/`goToMonth`/`onChange`. **Record the GATE-1 decode in the JSDoc.** ≤ 500 lines. | `packages/ui/src/date/calendar.ts` |
| 3.2.3 | Run `calendar.spec` **PASS** (green; on any fidelity mismatch the **code** is wrong — fix against `calendar.cpp`); `yarn verify` | — |

**Deliverables**:
- [x] `calendar.spec` red before impl, green after
- [x] `calendar-grid.ts` + `calendar.ts` implemented; GATE-1 decode in JSDoc; files ≤ 500 lines
- [x] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 4: `DatePicker` + `date-format` (spec-first)

### Step 4.1: Specification tests (BEFORE implementation)

**Reference**: [03-03 Part B](03-03-date-picker.md) · [07](07-testing-strategy.md)

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 4.1.1 | Write `date-picker.spec.test.ts` (ST-10 field mask + open/commit/cancel + no-host guard; ST-11 two-way sync; ST-12 `DD/MM/YYYY` format). Use a fake/app-shell `PopupHost` (the ComboBox test idiom). MUST NOT read impl. | `packages/ui/test/date-picker.spec.test.ts` |
| 4.1.2 | Run — verify **FAIL** (red) | — |

### Step 4.2: Implementation

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 4.2.1 | Implement `date-format.ts` (pure): `DateFormat`, `dateFormat()` → `{mask, parse, serialize}` for the 3 digit-reorder masks, range-validated `parse` (null on incomplete/invalid). | `packages/ui/src/date/date-format.ts` |
| 4.2.2 | Implement `date-picker.ts` (`DatePicker extends Group`): masked `Input` (`picture(spec.mask)`) + trailing `DateButton` (`▼`, mirrors `ComboButton`) + open via the generalized `openAnchoredPopup` hosting a `Calendar` (options forwarded, PF-008) + two-way field⟷value sync + the `host===undefined` no-op guard. ≤ 500 lines. | `packages/ui/src/date/date-picker.ts` |
| 4.2.3 | Run `date-picker.spec` **PASS** (green; fix code, never the spec); `yarn verify` | — |

**Deliverables**:
- [x] `date-picker.spec` red before impl, green after
- [x] `date-format.ts` + `date-picker.ts` implemented; files ≤ 500 lines
- [x] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 5: GATE-2 AFTER-diff + impl tests & hardening

### Step 5.1: Fidelity diff + edge/internal tests

**Reference**: [03-02](03-02-calendar.md) · [07](07-testing-strategy.md)
**Objective**: Verify the rendered grid against `calendar.cpp`; cover edges.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 5.1.1 | **[GATE-2 AFTER-diff]** Re-open `calendar.cpp` and diff the composed `Calendar` buffer **cell-by-cell**: header column math + ▲ col 15 / ▼ col 18, `Su Mo Tu…` row, `j*3` day columns + leading blanks, and the `0x3E`/`0x21` styles at representative `(year,month,today)`. Record the diff result in the code JSDoc / commit; fix code on any disagreement (the C++ outranks our spec for TV-derived draws). | `calendar.ts`/`calendar-grid.ts` JSDoc / commit |
| 5.1.2 | Write `calendar-date.impl.test.ts` (`addDays`/`addMonths` rolls, `compare` branches, `parseISO` malformed shapes) + `calendar-grid.impl.test.ts` (`buildMonthGrid` offsets per `firstDayOfWeek`, leap Feb, `isoWeek` year-boundary weeks). | `packages/ui/test/calendar-date.impl.test.ts`, `calendar-grid.impl.test.ts` |
| 5.1.3 | Write `calendar.impl.test.ts` (cursor init/clamp edges, cross-month re-point, Home/End week ends, `select`/`today`/`goToMonth`, `onChange`, precedence matrix) + `date-format.impl.test.ts` + `date-picker.impl.test.ts` (no-host guard, open→pick→close, Esc/outside cancel). | `packages/ui/test/calendar.impl.test.ts`, `date-format.impl.test.ts`, `date-picker.impl.test.ts` |
| 5.1.4 | Full verification | — |

**Deliverables**:
- [x] AFTER-diff passes (rendered output matches `calendar.cpp`) and is recorded
- [x] Impl/edge tests written and passing
- [x] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 6: Packaging, kitchen-sink stories, `demo:date`

### Step 6.1: Packaging (spec-first)

**Reference**: [03-04](03-04-theme-packaging.md)

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 6.1.1 | Write `date.packaging.spec.test.ts` (ST-15): re-exports present, `check:deps` clean, `date/` files ≤ 500. | `packages/ui/test/date.packaging.spec.test.ts` |
| 6.1.2 | Run — verify **FAIL** (red) | — |
| 6.1.3 | Add `date/index.ts` barrel + explicit named re-exports (`Calendar`/`DatePicker`/`CalendarDate`/helpers + `CalendarOptions`/`DatePickerOptions`/`DateFormat`) to the ui public entry. | `packages/ui/src/date/index.ts`, `packages/ui/src/index.ts` |
| 6.1.4 | Run — verify **PASS** (green) | — |

### Step 6.2: Kitchen-sink stories + headless demo (NON-NEGOTIABLE showcase)

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 6.2.1 | **Kitchen-sink stories for `Calendar` + `DatePicker` (+ smoke, ST-16)** — `stories/calendar.story.ts` (id `date/calendar`, category `Date`, `rd:'RD-20'`; today, live `toISO(value)` echo, a disabled-day example, `showWeekNumbers`) + `stories/date-picker.story.ts` (id `date/date-picker`; field opening the popup + echo) + two `stories/index.ts` lines; both pass `kitchen-sink.smoke.spec.test.ts`. | `packages/examples/kitchen-sink/stories/calendar.story.ts`, `date-picker.story.ts`, `stories/index.ts` |
| 6.2.2 | Headless `demo:date` — `date-demo/main.ts` (ASCII frame per step: render → arrow day-nav → PgDn month → pick a day → open the picker popup → commit) + `"demo:date"` script + `date-demo.e2e.test.ts` (ST-16). | `packages/examples/date-demo/main.ts`, `packages/examples/package.json`, `packages/examples/test/date-demo.e2e.test.ts` |
| 6.2.3 | Full verification incl. `yarn check:deps`; update CLAUDE.md/roadmap on completion (exec_plan post-analysis). | — |

**Deliverables**:
- [x] Re-exports land; `check:deps` clean; files ≤ 500
- [x] Both stories registered + smoke passing; `demo:date` runs headless + e2e passing
- [x] `yarn verify` passing

**Verify**: `yarn verify`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp immediately on completion; update the
> Progress header after every task; never batch. Immutable-oracle rule: a failing spec test means the
> code is wrong — fix the code, never the spec (for the TV-derived `Calendar`, a spec oracle that
> disagrees with a faithful `calendar.cpp` decode is the defect — fix it against the source, cite the `.cpp`).

### Phase 1: GATE-1 decode + `calendar*` roles + popup generalization
- [x] 1.1.1 [GATE-1 BEFORE-decode] Record 20×8 geometry + hit columns + `getColor` chain (0x3E/0x21) in 03-02 — 2026-07-04 (verified vs calendar.cpp:124-171,268-281)
- [x] 1.1.2 Write `date-theme.spec.test.ts` (ST-14) — 2026-07-04
- [x] 1.1.3 Run spec tests — verify RED — 2026-07-04 (2 failed: roles undefined)
- [x] 1.1.4 Implement 6 `calendar*` roles in core `theme.ts`; extend the PA-14 guard allowlist(s) — 2026-07-04 (tabs-theme + feedback-theme LATER_ADDITIVE_ROLES)
- [x] 1.1.5 Run spec tests — verify GREEN; `yarn verify` — 2026-07-04 (all 8 turbo tasks green)
- [x] 1.2.1 Write `date-popup.spec.test.ts` (ST-13) — 2026-07-04 (non-list probe view; focus/commit/Esc/outside/focus-loss)
- [x] 1.2.2 Run — verify RED — 2026-07-04 (6 failed: new API not wired)
- [x] 1.2.3 Generalize `openAnchoredPopup` (`buildContent(commit)`/`contentSize`/`focusTarget`; inject `commit`, remove the `selected()` watch) — 2026-07-04
- [x] 1.2.4 Refactor `history.ts` + `combo-box.ts` to the generalized call (byte-identical) — 2026-07-04 (**PA-16 runtime**: pick via a `selected()`-watch in `buildContent`, not `onSelect` — preserves click+keyboard pick; **PA-15 runtime**: migrated `popup.spec`/`popup.impl` to the new API)
- [x] 1.2.5 Run `date-popup.spec` GREEN + RD-14 History/ComboBox suites GREEN (AC-13); `yarn verify` — 2026-07-04 (75 dropdown tests green; full verify 8/8)

### Phase 2: `CalendarDate` value + pure helpers
- [x] 2.1.1 Write `calendar-date.spec.test.ts` (ST-1) — 2026-07-04
- [x] 2.1.2 Run — verify RED — 2026-07-04 (module absent)
- [x] 2.2.1 Implement `calendar-date.ts` (helpers + interop, `parseISO` null-safe) — 2026-07-04 (JDN day-walk for addDays, zero-dep)
- [x] 2.2.2 Run — verify GREEN; `yarn verify` — 2026-07-04 (6 spec green; full verify 8/8)

### Phase 3: `Calendar` view
- [x] 3.1.1 Write `calendar.spec.test.ts` (ST-2…ST-9; ST-3/ST-4 cell-by-cell pre-serialize) — 2026-07-04 (Sept 2026 reference; 15 cases)
- [x] 3.1.2 Run — verify RED — 2026-07-04 (module absent)
- [x] 3.2.1 Implement `calendar-grid.ts` (buildMonthGrid, dayColumn, isoWeek — pure) — 2026-07-04 (row-Thursday ISO week, null for all-out-of-month rows)
- [x] 3.2.2 Implement `calendar.ts` (draw+precedence, keymap, cursor, commit, bounds/disabled, week#, methods; GATE-1 decode in JSDoc) — 2026-07-04 (~330 lines)
- [x] 3.2.3 Run `calendar.spec` GREEN (fix code, never the spec); `yarn verify` — 2026-07-04 (15 spec green; 2 test-authoring fixes: right-justified month → `.includes`; full verify 8/8)

### Phase 4: `DatePicker` + `date-format`
- [x] 4.1.1 Write `date-picker.spec.test.ts` (ST-10…ST-12) — 2026-07-04 (9 cases, ComboBox PopupHost idiom)
- [x] 4.1.2 Run — verify RED — 2026-07-04 (modules absent)
- [x] 4.2.1 Implement `date-format.ts` (3 masks, parse/serialize — pure) — 2026-07-04
- [x] 4.2.2 Implement `date-picker.ts` (masked Input + ▼ + anchored Calendar popup + sync + no-host guard) — 2026-07-04 (ComboBox two-way bind idiom, untrack guard)
- [x] 4.2.3 Run `date-picker.spec` GREEN; `yarn verify` — 2026-07-04 (9 spec green first try; full verify 8/8)

- [x] 5.1.1 [GATE-2 AFTER-diff] Cell-by-cell diff of the composed Calendar vs `calendar.cpp`; record — 2026-07-04 (re-verified, recorded in calendar.ts JSDoc; ST-3/ST-4 are the executable oracle; no mismatch)
- [x] 5.1.2 Write `calendar-date.impl` + `calendar-grid.impl` — 2026-07-04 (14 cases; ISO year-boundary weeks verified)
- [x] 5.1.3 Write `calendar.impl` + `date-format.impl` + `date-picker.impl` — 2026-07-04 (21 cases; precedence matrix, format disambiguation, open/pick/cancel)
- [x] 5.1.4 Full verification — 2026-07-04 (8/8 turbo tasks green)

### Phase 6: Packaging, kitchen-sink stories, `demo:date`
- [x] 6.1.1 Write `date.packaging.spec.test.ts` (ST-15) — 2026-07-04
- [x] 6.1.2 Run — verify RED — 2026-07-04 (re-exports absent)
- [x] 6.1.3 Add `date/index.ts` barrel + explicit re-exports in `src/index.ts` — 2026-07-04
- [x] 6.1.4 Run — verify GREEN — 2026-07-04 (3 packaging spec green; files ≤500)
- [x] 6.2.1 Kitchen-sink `date/calendar` + `date/date-picker` stories (+ smoke, ST-16) — 2026-07-04 (33 smoke green incl. 2 ST-16)
- [x] 6.2.2 `demo:date` headless walkthrough + script + e2e (ST-16) — 2026-07-04 (date-demo.e2e green; Calendar nav/commit + DatePicker popup)
- [x] 6.2.3 Full verification incl. `check:deps`; post-completion re-analysis — 2026-07-04 (verify 8/8, check:deps clean, e2e 13/13)

---

## Dependencies

```
Phase 1 (GATE-1 decode + calendar* roles + popup generalization)
    ↓
Phase 2 (CalendarDate value + helpers)
    ↓
Phase 3 (Calendar view — needs the roles + CalendarDate + grid math)
    ↓
Phase 4 (DatePicker — needs the Calendar + the generalized popup + CalendarDate)
    ↓
Phase 5 (GATE-2 AFTER-diff + impl tests — need the rendered output)
    ↓
Phase 6 (packaging + stories + demo — need the public API)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 35 tasks completed
2. ✅ `yarn verify` passing (typecheck + build + test across packages)
3. ✅ No warnings/errors; `yarn check:deps` clean (zero runtime deps)
4. ✅ No dead code — no unused parameters, functions, or modules
5. ✅ Security hardened — `picture`-gated field + null-safe range-validating parser (never throws / never an invalid date), all grid/month/day/week/leap indexing bounds-checked/clamped, every glyph sanitized
6. ✅ GATE-1 BEFORE + GATE-2 AFTER fidelity tasks done and the decode recorded in code/commit (20×8, hit columns, `0x3E`/`0x21`)
7. ✅ Existing RD-14 `History` + `ComboBox` tests stay green after the popup generalization (AC-13)
8. ✅ Kitchen-sink `date/calendar` + `date/date-picker` stories pass smoke; `demo:date` runs headless + e2e
9. ✅ 6 additive `calendar*` roles land; no existing role/byte changed; guard allowlist extended (PA-14)
10. ✅ Documentation/roadmap updated (post-completion re-analysis handled by the exec_plan skill)
