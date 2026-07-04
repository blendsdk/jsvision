# Requirements: Date family (`Calendar` + `DatePicker`)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-20](../../requirements/RD-20-date-family.md)

## Feature Overview

A **date family** for `@jsvision/ui`: a **`Calendar`** month-grid `View`, a **`DatePicker`** dropdown
that anchors that calendar under a masked field, and a **`CalendarDate`** civil-date value type with
pure helpers. `Calendar`'s drawing is a faithful **decode** of Turbo Vision's `TCalendarView`
(`examples/tvdemo/calendar.cpp`); day-selection, the day-nav cursor, min/max, disabled days, week
numbers, and the picker are documented extensions (TV had none). See RD-20 for the full narrative;
this document restates the plan-scoped requirements and traces each to the register.

## Functional Requirements

### Must Have

**`CalendarDate` — the civil date value (AR-196 / PA-7)**
- [ ] `readonly { year: number; month: number /* 1-12 */; day: number }`.
- [ ] Pure zero-dep helpers: `daysInMonth(year, month)` (Gregorian leap: Feb=29 when `year%4===0 &&
      (year%100!==0 || year%400===0)`), `dayOfWeek(date)` (0=Sun, `calendar.cpp:100-121`),
      `addMonths(date, n)` / `addDays(date, n)` (day clamped to target month length), `compare(a,b)`
      (−1/0/+1), `toISO(date)` → `"YYYY-MM-DD"`, `parseISO(str)` → `CalendarDate | null`.
- [ ] `Date` interop confined to the boundary: `fromDate(d)` / `toDate(cd)` (±1 month here only).

**`Calendar` — the month-grid view (AR-195 decode + extensions)**
- [ ] Focusable `View` drawing the **20×8** grid (PA-3): header `«month» «year» ▲ ▼`, weekday row
      `Su Mo Tu We Th Fr Sa` (rotated by `firstDayOfWeek`), 6 week rows of 2-digit days at column `j*3`,
      leading/trailing blanks — cell-by-cell per the `calendar.cpp:124-171` decode.
- [ ] **Today** highlighted in `calendarToday` (`0x21`); other in-month days in `calendarNormal` (`0x3E`).
- [ ] **Selected day** (extension) — two-way `value: Signal<CalendarDate | null>`; the selected cell in
      `calendarSelected` (`0x1F`). `null` ⇒ nothing selected (today still highlighted). Selected wins
      over today when they coincide (PF-006 / PA-4).
- [ ] **Focus cursor** (extension, PA-1) — a dedicated `calendarCursor` (`0x3F`) cell, drawn **only
      while focused**, precedence cursor>selected>today>disabled>normal (PA-4).
- [ ] **Month nav (faithful)** — click header ▲ (next) / ▼ (prev) at the decoded columns
      (`calendar.cpp:185-204`); `+`/`-` change month; nav re-renders, leaves `value` + cursor unchanged.
- [ ] **Day nav (extension, AR-199 / PA-9)** — `←/→`=±1 day, `↑/↓`=∓/±1 week, PgUp/PgDn=∓/±1 month,
      Ctrl+PgUp/PgDn=∓/±1 year, Home/End=first/last day of the visible week; a cross-month move
      re-points the visible month; plain arrows never leave the calendar's focus.
- [ ] **Commit (extension, AR-206)** — Enter/Space on the cursor, or a single day click, sets `value`;
      clicking/committing a **disabled** day is a no-op.
- [ ] **Bounds + disabled (AR-198)** — optional `min`/`max` clamp the cursor (out-of-range unreachable);
      optional `isDisabled(date)` dims days (`calendarDisabled` `0x38`) that stay navigable but
      non-committable.
- [ ] **First day of week (AR-201)** — `firstDayOfWeek?: 0 | 1` (default 0=Sun) rotates the header +
      day-1 column.
- [ ] **Week numbers (AR-202 / PA-10)** — opt-in `showWeekNumbers?` adds a leading ISO-8601 week-number
      column (`calendarWeekNumber` `0x30`), each row labelled by its **Thursday**, stable regardless of
      `firstDayOfWeek`.
- [ ] Should-Have methods `select(date)` / `today()` / `goToMonth(year, month)` + `onChange(date)`.

**`DatePicker` — the calendar dropdown (AR-205 extension)**
- [ ] A `Group`: a masked `Input` (`picture` mask, `size: fr`) + a trailing 3-cell `▼` button
      (mirroring `ComboButton`), opening a `Calendar` in the generalized anchored popup (PA-5).
- [ ] **Field format (AR-203 / PA-11)** — `format?: DateFormat` selects the mask + parse/serialize pair
      among 3 digit-reorder masks (default ISO `YYYY-MM-DD`; `DD/MM/YYYY`; `MM/DD/YYYY`). Localized/
      textual month names deferred (DEF-30).
- [ ] **Open/commit/cancel (mirrors `ComboBox`)** — open on Down/Alt+Down/`▼`-click; a single day click
      (or Enter on the cursor) commits + closes; Esc/outside-mouse-down cancels; **no host ⇒ decline**.
- [ ] **Two-way sync** — a complete valid field date ⇒ `value` (positions the calendar); picking ⇒
      `value` ⇒ field text; incomplete/invalid text leaves `value` unchanged.
- [ ] **Options pass-through (PF-008)** — forwards `today`/`min`/`max`/`isDisabled`/`firstDayOfWeek`/
      `showWeekNumbers` to the hosted `Calendar`.

**Anchored-popup generalization (AR-204 / PA-5) — additive to RD-14**
- [ ] Generalize the internal `openAnchoredPopup` to `buildContent(): View` + `contentSize` + `commit()`
      + a `focusTarget` accessor; refactor `History` + `ComboBox` to it with **byte-identical** placement
      (their tests stay green, AC-13); internal (not exported) → additive/non-public-breaking.

**Theme roles — additive `calendar*` (AR-207 / PA-2/PA-3)**
- [ ] Add 6 additive `calendar*` roles to core `Theme` + `defaultTheme`: `calendarNormal` `0x3E`,
      `calendarToday` `0x21`, `calendarSelected` `0x1F`, `calendarCursor` `0x3F`, `calendarDisabled`
      `0x38`, `calendarWeekNumber` `0x30`. No existing role changes. **No** adjacent-month-day role
      (out-of-month cells are blank in the normal role, TV-faithful, PF-002).

**Kitchen-sink + demo (AR-209 / PA-13)**
- [ ] `date/calendar` + `date/date-picker` stories (category `Date`) + headless `demo:date`.

### Should Have
- [ ] `Calendar.select`/`today`/`goToMonth` convenience methods; `onChange(date)` callback (PA-8).

### Won't Have (Out of Scope)
- Colour components (`ColorSwatch`/`ColorPicker`) — sibling RD-21.
- Time-of-day / datetime / timezone — `CalendarDate` is civil-date-only.
- Date-range selection (two endpoints) — DEF-27.
- Multi-month / year / decade views — DEF-29.
- Localized / textual month-name field formats — DEF-30.
- Relative / natural-language field parsing.

## Technical Requirements

### Performance
- Pure grid/format math (`calendar-grid.ts`, `date-format.ts`, `calendar-date.ts`) is O(cells)/O(1);
  the calendar reflows/repaints within the existing RD-03 partial-recompose budget (no new hot path).

### Compatibility
- ESM/NodeNext (`.js` specifiers), TypeScript `strict`, **zero runtime deps** (`check:deps` holds).
- Additive-only cross-package/cross-RD surface (6 core theme roles + the internal popup generalization);
  no existing public API changes; existing RD-14 tests stay green.

### Security
- Every rendered glyph routes through `DrawContext` → `ScreenBuffer` + core `sanitize` (AC-17).
- The field is `picture`-gated; `parseISO`/the format parser **validate ranges** and return `null` on
  malformed/out-of-range input (never throw, never yield an invalid `CalendarDate`).
- All grid/month/day/week/leap indexing is bounds-checked/clamped to `min`/`max` + the month length.

## Scope Decisions

| Decision                              | Options Considered                              | Chosen                                  | Rationale                                                            | AR Ref |
| ------------------------------------- | ----------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | ------ |
| Focus-cursor visual model             | Dedicated role / reuse selected+marker / caret  | Dedicated `calendarCursor` role         | First-class, buffer-testable focus cell; clean AC oracle            | PA-1   |
| Extension role bytes                  | Blue-bg / lightGray-bg selection set            | selected `0x1F` / disabled `0x38` / wk `0x30` | Distinct blue selection vs cyan grid; disabled matches clusterDisabled | PA-2   |
| TV-decoded roles (GATE-1)             | Source decode                                   | normal `0x3E` · today `0x21`            | `wpCyanWindow`→`cpAppColor` chain (`calendar.cpp`)                   | PA-3   |
| Role precedence                       | Source                                          | cursor>selected>today>disabled>normal   | Focus cell wins while focused; selected>today (PF-006)              | PA-4   |
| Anchored-popup generalization         | `buildContent`+size+`commit` / parallel fn      | Generalize in place, byte-identical     | AR-204 refactor; internal, non-public-breaking; unblocks RD-21      | PA-5   |
| `src/date/` file split                | 6 files / fold grid+format                      | 6 files (date/grid/calendar/format/picker/barrel) | ≤500 lines; pure math unit-testable in isolation          | PA-6   |
| CalendarDate helper signatures        | Source                                          | Per RD Must-Have + AC-1                 | Matches AR-196; `parseISO` null-safe                                | PA-7   |
| Calendar/DatePicker option shapes     | Source / house idiom                            | Caller-owned-signal options + methods   | Matches `ComboBox`/`TabView` idiom                                  | PA-8   |
| Cursor init + month-follow            | Source                                          | `value??today??day1`, clamped, month-follow | Deterministic, in-range (AC-8)                                  | PA-9   |
| ISO week-number algorithm             | Source                                          | Row-Thursday ISO-8601                   | Stable regardless of `firstDayOfWeek` (PF-007)                     | PA-10  |
| Field format model                    | Digit-reorder / localized                       | 3 digit-reorder masks; localized→DEF-30 | v1 slice matching AC-12; localized has no v1 oracle                | PA-11  |
| Story ids / demo                      | `category/name` / bare                          | `date/calendar` + `date/date-picker`    | Registry convention; avoids DataGrid drift                          | PA-13  |
| Additive-role guard tripwire          | Extend allowlist / leave broken                 | Extend allowlist, keep byte guards      | feedback PA-11 precedent; prior guarantees intact                   | PA-14  |

> **Traceability:** Every scope decision references its Ambiguity Register entry. See `00-ambiguity-register.md`.

## Acceptance Criteria

The 17 ACs (AC-1…AC-17) are the immutable oracles, restated verbatim from
[RD-20 §Acceptance Criteria](../../requirements/RD-20-date-family.md); the `Calendar` fidelity ACs
(AC-3 geometry, AC-4 today, AC-14 colours) diff against the `TCalendarView` decode pinned at GATE-1/
GATE-2. `07-testing-strategy.md` maps each AC → an ST-case.

1. [ ] **AC-1…AC-17** as specified in RD-20 (encoded as ST-1…ST-17 in `07-testing-strategy.md`).
2. [ ] GATE-1 BEFORE-decode + GATE-2 AFTER-diff of `Calendar` recorded (geometry + glyphs + the
       `getColor` chain), per the NON-NEGOTIABLE TV-fidelity directive.
3. [ ] All spec + impl tests pass; `yarn verify` + `yarn check:deps` clean; files ≤ 500 lines.
4. [ ] Existing RD-14 `History` + `ComboBox` tests stay green after the popup generalization (AC-13).
5. [ ] Kitchen-sink `date/calendar` + `date/date-picker` stories pass smoke; `demo:date` runs headless.
