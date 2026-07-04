# Testing Strategy: Date family

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core business logic (grid/format/date pure math, calendar draw+nav) | 90% |
| Supporting modules (DatePicker glue, popup generalization) | 80% |
| UI / glue / stories / demo | 60% |

- Test names state behavior: `should [expected] when [condition]`.
- Render-through-loop idiom (the `tab-strip.spec`/`feedback` pattern): mount via `createEventLoop` +
  `mount`, dispatch synthetic key/mouse events, assert the **pre-`serialize` buffer** cell-by-cell for
  the fidelity oracles.
- `Calendar` fidelity ST-cases (ST-3 geometry, ST-4 colours) diff against the `TCalendarView` decode
  pinned at GATE-1 (03-02); the extension ST-cases encode selection/nav/picker behavior.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from `01-requirements.md`, the `03-*` specs, the `calendar.cpp` decode, and the
> register. Immutable oracles — if the implementation disagrees, the **implementation** is wrong (for
> the TV-derived `Calendar`, a spec oracle that disagrees with a faithful `calendar.cpp` decode is the
> defect, per the CLAUDE.md TV-fidelity exception). ST-n ↔ AC-n (RD-20).

### CalendarDate value + helpers

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `daysInMonth(2024,2)`, `daysInMonth(2100,2)`, `daysInMonth(2026,4)`; `dayOfWeek({2026,9,1})`; `toISO({2026,9,15})`; `parseISO("2026-13-01")`/`parseISO("2026-02-30")`/`parseISO("nope")`; `fromDate`/`toDate` round-trip a March date | `29`; `28`; `30`; `2` (Tue); `"2026-09-15"`; each `parseISO` → `null`; round-trip yields `month:3` (1-based) | AC-1 / AR-196 / PA-7 |

### Calendar view

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-2 | `Calendar` with `value = signal(null)` | No day drawn selected (today still highlighted); nothing crashes | AC-2 / AR-197 |
| ST-3 | `Calendar` for a given `{year,month}` | **20-col** block: row 0 `«month» «year» ▲ ▼` (▲ col 15, ▼ col 18), row 1 weekday labels, 6 week rows with day `d` 2-digit right-justified at col `j*3`, correct leading blanks (day 1 col = `dayOfWeek(1)` shifted by `firstDayOfWeek`) — asserted pre-`serialize`, matched to `calendar.cpp:124-171` | AC-3 / AR-195 / PA-3 |
| ST-4 | `today = {2026,9,3}` | Day 3 cell in `calendarToday` (`0x21` blue-on-green); every other in-month day in `calendarNormal` (`0x3E` yellow-on-cyan); a selected day (ST-5) in `calendarSelected` — today + selection visually separable | AC-4 / AR-200 / PA-3 |
| ST-5 | Enter/Space on the cursor, or a single click on a day cell; then month-nav (▲/▼/`+`/`-`/PgUp/Dn) | `value` = that date; the cell repaints selected (selecting **today** repaints it selected — selected wins over today, PA-4); month nav leaves `value` unchanged | AC-5 / AR-206 / PF-006 |
| ST-6 | From a focused cursor: `→`, `←`, `↓`, `↑`, PgDn/PgUp, Ctrl+PgDn/PgUp, Home/End | +1 day (crossing into next month re-renders it), −1 day, +7, −7, ±1 month, ±1 year, visible-week first/last; plain arrows do **not** leave the calendar's focus | AC-6 / AR-199 / PA-9 |
| ST-7 | Click at the decoded ▲ col; ▼ col; `+`/`-` | ▲/`+` → next month, ▼/`-` → prev month; grid re-renders with today/selection/cursor preserved | AC-7 / AR-195 |
| ST-8 | `min`/`max` set; an `isDisabled(date)` day | Cursor cannot move before `min` / after `max` (those days unreachable); a disabled day is **drawn dimmed** (`calendarDisabled`), is **navigable**, but Enter/Space/click on it is a **no-op** (`value` unchanged) | AC-8 / AR-198 |
| ST-9 | `firstDayOfWeek: 1`; `showWeekNumbers: true` | Weekday header starts `Mo`, day 1's column shifts accordingly; a leading ISO-8601 week-number column (each row = its **Thursday**'s ISO week, stable regardless of `firstDayOfWeek`) without disturbing the `j*3` day geometry; **with week numbers on, a click on the rendered header ▲/▼ still navigates month** (the hit columns shift by `weekNumberColWidth`, not fixed 15/18) | AC-9 / AR-201 / AR-202 / PA-10 |

### DatePicker

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-10 | Field input; Down/Alt+Down or ▼-click (with + without a `PopupHost`); a day click / Enter; Esc / outside mouse-down | Only `YYYY-MM-DD`-shaped input accepted (`picture`); opens the calendar popup (a **no-op with no host**); a single day click (or Enter) sets `value` **and closes**; Esc/outside closes **without** changing `value` | AC-10 / AR-203/204/205/206 |
| ST-11 | Set `value`; type a complete valid date + reopen; type incomplete/invalid text | Field text updates via the format; reopening positions the calendar cursor/selection on it; incomplete/invalid text leaves `value` unchanged | AC-11 / AR-205 |
| ST-12 | `format: 'DD/MM/YYYY'` | Field mask/parse/serialize use that order (`15/09/2026` ⟷ `{2026,9,15}`); default is ISO `YYYY-MM-DD` | AC-12 / AR-203 / PA-11 |

### Popup generalization + theme + packaging + showcase

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-13 | `openAnchoredPopup` hosting an arbitrary fixed-size `View` (the `Calendar`) via `buildContent()`+`contentSize`+`commit()`; the RD-14 `History`+`ComboBox` suites | The `Calendar` is hosted + focused + commits; **existing History + ComboBox tests stay green** (refactored to the generalized call, behavior unchanged); no `dropdown/` public export changes | AC-13 / AR-204 / PA-5 |
| ST-14 | `defaultTheme` + `encode()` | The 6 `calendar*` roles exist (bytes per PA-3); `encode()` of each does not throw; **no existing role changed** | AC-14 / AR-207 / PA-2/PA-3 |
| ST-15 | Package layout | `packages/ui/src/date/` with explicit named re-exports from `src/index.ts`; `yarn check:deps` passes; every `date/` file ≤ 500 lines | AC-15 / AR-208 / PA-6 |
| ST-16 | Kitchen-sink `date/calendar` + `date/date-picker` stories (category `Date`); `demo:date` | Both stories pass the headless smoke (mount + paint + unique id + metadata); `demo:date` runs headless with an ASCII frame per step | AC-16 / AR-209 / PA-13 |
| ST-17 | Malformed/out-of-range field + all glyphs + all grid/month/day/week indexing | Every label/digit/week-number sanitized to the screen; the field is `picture`-gated + the parser returns `null` (never throws / never an invalid date); all indexing bounds-checked for every month, leap year, empty selection, `firstDayOfWeek`/week-number setting | AC-17 / security |

> **⚠️ AUTHORING RULE:** expectations come from the specs + the `calendar.cpp` decode — never from
> imagined implementation output. If an expectation can't be determined from the spec, it's an
> ambiguity → register it and resolve with the user before writing the test.

## Test Categories

### Specification Tests (from ST-cases above) — written BEFORE implementation

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `calendar-date.spec.test.ts` | ST-1 | CalendarDate helpers |
| `calendar.spec.test.ts` | ST-2…ST-9 | Calendar view |
| `date-picker.spec.test.ts` | ST-10…ST-12 | DatePicker + format |
| `date-popup.spec.test.ts` | ST-13 | Popup generalization (+ History/ComboBox green) |
| `date-theme.spec.test.ts` | ST-14 | `calendar*` roles |
| `date.packaging.spec.test.ts` | ST-15 | Re-exports / deps / line budget |
| `kitchen-sink.smoke.spec.test.ts` (extend) | ST-16 | Stories |
| (security assertions folded into the above spec files) | ST-17 | Security |

### Implementation Tests (edge cases, internals) — written AFTER implementation

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `calendar-date.impl.test.ts` | `addDays`/`addMonths` boundary rolls, `compare` branches, `parseISO` malformed shapes | High |
| `calendar-grid.impl.test.ts` | `buildMonthGrid` leading offset per `firstDayOfWeek`, leap Feb, `isoWeek` year-boundary weeks | High |
| `calendar.impl.test.ts` | cursor init/clamp edges, cross-month re-point, Home/End week ends, `select`/`today`/`goToMonth`, `onChange`, precedence matrix | High |
| `date-format.impl.test.ts` | each format's parse/serialize incl. null cases | Med |
| `date-picker.impl.test.ts` | no-host guard, open→pick→close, Esc/outside cancel, `DateButton` draw | Med |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| `demo:date` walkthrough | render → arrow day-nav → PgDn month → pick a day → open picker → commit | ASCII frame per step; `value` set; `date-demo.e2e.test.ts` green |
| RD-14 regression | run `history.*` + `combo-box.*` suites after the generalization | All green, unchanged (AC-13) |

## Test Data

### Fixtures Needed
- Fixed reference months (e.g. Sept 2026, Feb 2024 leap, Feb 2100 non-leap) + a fixed injected `today`
  for deterministic geometry/colour oracles.
- A Unicode-capable caps profile (default); no ASCII fallback needed (calendar glyphs are BMP).

### Mock Requirements
- Inject `today` (no real clock in tests). A fake `PopupHost` for the picker open/commit path (or the
  app-shell overlay, as ComboBox tests do). No other mocks — real signals/views.

## Verification Checklist
- [ ] All ST-1…ST-17 defined with concrete input/output pairs
- [ ] Every ST traces to an AC / spec / decode / AR entry
- [ ] Spec tests written BEFORE implementation and verified to FAIL (red)
- [ ] All spec tests pass after implementation (green); implementation fixed on any failure, never the test
- [ ] GATE-2 AFTER-diff of `Calendar` vs `calendar.cpp` recorded
- [ ] Impl tests written for edges/internals; RD-14 suites still green
- [ ] `yarn verify` + `yarn check:deps` clean; no regressions
