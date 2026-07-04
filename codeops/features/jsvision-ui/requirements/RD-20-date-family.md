# RD-20: Date family — Calendar + DatePicker (decode-first from `TCalendarView`)

> **Document**: RD-20-date-family.md
> **Status**: Draft
> **Created**: 2026-07-03 (`add_requirement` — date & color components; sibling 1 of 2)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-03 (View/Group spine — done; `Group`/`View`/`DrawContext`, per-view focus, `bind`/`invalidate`), RD-04 (Event loop — done; focus chain, keymap/commands, mouse hit-test), RD-01 (Reactive core — done; `Signal`/`computed`/`Show` drive the grid + selected date), RD-02 (Layout engine — done; the grid + strip fit via the normal layout pass), RD-05 (App shell — done; the `Window`/`Dialog` hosts, the disabled-greying convention, the overlay/`PopupHost` seam the popup uses), RD-06 (Essential controls — done; `Input` + `Cluster`/focus idioms), RD-07 (Essential-control completions — done; the **`picture(mask)`** validator the field mask reuses), RD-14 (Input dropdowns — done; the **anchored-popup primitive** `openAnchoredPopup`/`PopupHost` the `DatePicker` reuses — **generalized here** to host a non-list view, AR-204), `@jsvision/core` (done; the additive `calendar*` theme roles land here at plan GATE-1)
> **Set**: Date & color components (AR-195…AR-224) — 2 sibling RDs; this is **RD-20 (Date family)**; **RD-21 (Color family)** is the sibling.
> **CodeOps Skills Version**: 3.2.0

---

## Feature Overview

A **date family** for `@jsvision/ui`: a **`Calendar`** month-grid view and a **`DatePicker`** dropdown
that anchors that calendar under a masked text field. Together they are the idiomatic way to pick a
civil date (a due date, a booking day, a filter range endpoint) in a TUI form — the calendar for
direct browsing, the picker for a compact one-line field that opens on demand.

**GATE-1 fidelity finding (`magiblot/tvision`).** Turbo Vision **does** have a calendar to decode —
**`TCalendarView`** in the `tvdemo` example (`examples/tvdemo/calendar.cpp:124-172`, header
`calendar.h`). It is a **demo gadget**, not a core class, but it is a real, shippable TV artifact with
exact geometry, glyphs, and colours — so per the **NON-NEGOTIABLE TV-fidelity directive** the
`Calendar`'s *drawing* is a **decode**, not a design. What TV's calendar does **not** have is any notion
of **selecting** a day (it only navigates months and highlights *today*) and there is **no** TV date
*picker* at all. Those are **documented extensions** (AR-195), exactly the latitude the directive
permits ("behavior the original couldn't have may extend TV, but the visual shapes/sizes/colours must
still match") — the same class as the RD-16 DataGrid extending `TListViewer`.

Decoded facts from `TCalendarView::draw()` (`calendar.cpp:124-172`), to be re-verified cell-by-cell at
plan **GATE-1/GATE-2**:

| Piece | TV decode | `file:line` |
|-------|-----------|-------------|
| View size | **20 columns × 8 rows** — the view = window `TRect(1,1,23,11)` (22×10, no zoom/grow, `wpCyanWindow`) inset by `getExtent().grow(-1,-1)` → `TRect(1,1,21,9)` = 20×8. `draw()` fills its buffer to 22 (`moveChar(…,22)`/`writeLine(…,22,…)`) but that is **clipped to the 20-column view** — every content string (header, weekday row, day grid cols 0–19) is exactly 20 wide | `calendar.cpp:270-280`, `tview.cpp:521-524`, `objects.h:148` |
| Row 0 header | `«month name» «year» ▲  ▼` — month right-justified in 9, year in 4, then CP437 `30`=▲ and `31`=▼ | `calendar.cpp:139-144` |
| Month nav (mouse) | click local **x=15 (▲) ⇒ next month** (`++month`); **x=18 (▼) ⇒ prev month** | `calendar.cpp:185-204` |
| Month nav (keys) | `+`/**Down** ⇒ next month; `-`/**Up** ⇒ prev month | `calendar.cpp:206-231` |
| Row 1 weekday labels | `Su Mo Tu We Th Fr Sa` (2-char, space-separated) | `calendar.cpp:147` |
| Rows 2-7 day grid | 6 week rows × 7 columns; each day **2-digit right-justified at column `j*3`**; leading blanks before day 1 via `1 - dayOfWeek(1,month,year)` | `calendar.cpp:150-171` |
| Today highlight | today drawn in **`getColor(7)`** (bold), all other days in **`getColor(6)`** | `calendar.cpp:134-135,163-166` |
| Weekday algorithm | Zeller-style `dayOfWeek(day,month,year)` (Sunday = 0) | `calendar.cpp:100-121` |

**Behavior may extend TV** (a selectable day, keyboard day-nav, min/max, disabled days, week numbers,
locale, the dropdown) but the **grid geometry, glyphs, and colours must match** `TCalendarView`,
decoded/confirmed at plan GATE-1/GATE-2.

The components in scope:

| Component | Basis | Role |
|-----------|-------|------|
| `Calendar` | **decode** — `TCalendarView` (`calendar.cpp`) | A focusable `View` drawing the 20×8 month grid (header + weekday row + 6 week rows), highlighting **today**, and (extension) tracking a **selected day** bound to a `Signal<CalendarDate \| null>`. Month + day keyboard/mouse navigation; min/max bounds; disabled days; optional week-number column; configurable first-day-of-week. |
| `DatePicker` | **extension** — no TV counterpart (built on RD-14 popups) | A `Group`: a masked `Input` (`picture("####-##-##")`) + a trailing `▼` button that opens a `Calendar` in the RD-14 anchored popup. Field text ⟷ calendar selection stay in sync on one shared signal; open on Down/Alt+Down/click; single click on a day commits + closes; Esc cancels. |
| `CalendarDate` | **new value type** | A civil date value — `readonly { year: number; month: number /* 1-12 */; day: number }` — plus pure zero-dep helpers (`daysInMonth`, `dayOfWeek`, `addMonths`, `addDays`, `compare`, `toISO`, `parseISO`) and `Date` interop (`fromDate`/`toDate` doing the ±1 month conversion). No time-of-day, no timezone. |

---

## Functional Requirements

### Must Have

#### `CalendarDate` — the civil date value (AR-196)
- A **plain `readonly` interface** `{ year: number; month: number; day: number }` with **month in 1-12**
  (TV-faithful + human-readable — `TCalendarView` uses 1-based months) and **day in 1-31**.
- **Pure, zero-dep helpers** (no runtime deps; `check:deps` holds): `daysInMonth(year, month)` (leap-year
  correct — Feb = 29 when `year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)`, correcting TV's
  simpler `year % 4 == 0` at `calendar.cpp:128-129`), `dayOfWeek(date)` (0 = Sunday, matching
  `calendar.cpp:100-121`), `addMonths(date, n)` / `addDays(date, n)` (clamping the day to the target
  month's length), `compare(a, b)` (−1/0/+1), `toISO(date)` → `"YYYY-MM-DD"`, `parseISO(str)` →
  `CalendarDate | null`.
- **`Date` interop at the boundary only**: `fromDate(d: Date): CalendarDate` (reads `getFullYear`/
  `getMonth()+1`/`getDate`) and `toDate(cd: CalendarDate): Date` (`new Date(y, m-1, d)`) — the ±1 month
  conversion is confined to these two functions so the rest of the API is 1-based.

#### `Calendar` — the month-grid view (AR-195, decode of `TCalendarView`)
- A **focusable `View`** (`ofSelectable`, `calendar.cpp:84`) drawing the **20×8** month grid exactly per
  the decode table above: header row (`«month» «year» ▲ ▼`), weekday row (`Su Mo Tu We Th Fr Sa`, shifted
  by `firstDayOfWeek`), and **6 week rows** of 2-digit days at column `j*3`, with leading/trailing blanks.
- **Today** (resolved from the `today` input, AR-200) is always highlighted in the today role
  (`getColor(7)` decode); all other in-month days in the normal role (`getColor(6)`).
- **Selected day (extension, AR-195/AR-197):** a two-way **`value: Signal<CalendarDate | null>`** — the
  selected day is drawn in a distinct **selected** role (reverse/highlight, decoded at GATE-1, visually
  distinct from *today* so both can show at once). `null` = no selection (nothing drawn selected; today
  still highlighted). When the selected day **is** today (same cell), the **selected** role wins — the
  user's active choice takes visual precedence over the today highlight.
- **Month navigation (faithful):** click the header **▲ (next month) / ▼ (prev month)** at the decoded
  hit columns (`calendar.cpp:185-204`; ▲=next is TV's semantics — confirmed at GATE-2), and `+`/`-`
  change month. Navigating month re-renders the grid; the selected `value` is **unchanged** by month
  navigation (only day activation changes it).
- **Day navigation (extension keymap, AR-199 — documented deviation from TV):** a **navigation cursor**
  (the focused cell) moves with **`←`/`→` = ±1 day**, **`↑`/`↓` = ∓/±1 week (7 days)**, **PgUp/PgDn =
  ∓/±1 month**, **Ctrl+PgUp/Ctrl+PgDn = ∓/±1 year**, **Home/End = first/last day of the visible week**.
  Moving the cursor across a month boundary re-renders the neighbouring month. `+`/`-` remain month
  shortcuts. (TV bound `↑↓` to month-change because it had no day cursor, `calendar.cpp:206-229`; the
  selectable-day extension reassigns arrows to day-nav — recorded as a deliberate deviation.)
- **Commit (extension, AR-206):** **Enter/Space** on the cursor, or a **single mouse click on a day
  cell**, sets `value` to that day. A click on a day **also** commits when hosted in a `DatePicker`
  (AR-205). Clicking/committing a **disabled** day is a **no-op** (AR-198).
- **Bounds + disabled days (AR-198):** optional **`min`/`max`: CalendarDate** clamp navigation (the cursor
  never moves before `min` or after `max`; out-of-range days are not reachable) and an optional
  **`isDisabled?(date: CalendarDate): boolean`** predicate — disabled days are **still drawn** (in a
  dimmed/disabled role) and **still navigable**, but **not committable** (Enter/Space/click is a no-op).
- **First day of week (AR-201):** **`firstDayOfWeek?: 0 | 1`** (0 = Sunday default, TV-faithful; 1 =
  Monday for ISO locales) rotates the weekday header labels and the column that day 1 lands in.
- **Week-number column (AR-202):** opt-in **`showWeekNumbers?: boolean`** (default `false`) adds a leading
  column of **ISO-8601** week numbers (per ISO 8601 §, the week containing the year's first Thursday is
  week 1; weeks start Monday for the ISO calc regardless of `firstDayOfWeek`), widening the view by the
  week-number column (kept legible, decoded colour at GATE-1). Each displayed row shows the ISO week of
  that row's **Thursday**, so a Sunday-started row (which straddles two ISO weeks) maps unambiguously to
  one ISO week number.

#### `DatePicker` — the calendar dropdown (AR-205, extension)
- A **`Group`** composing a masked **`Input`** (the focus target, `size: fr`) + a trailing **`▼` button**
  (a fixed 3-cell `View`, mirroring `ComboButton`, `combo-box.ts:67-88`), opening a **`Calendar`** in the
  RD-14 **anchored popup** (`openAnchoredPopup`, **generalized to host a non-list view**, AR-204).
- **Field mask (AR-203):** the field uses **`picture("####-##-##")`** (RD-07, `picture.ts:397`) so only
  `YYYY-MM-DD`-shaped input is accepted; **format is configurable** (AR-203) — a `format?` option selects
  the mask + parse/serialize pair among **digit-reorder masks** (default ISO `YYYY-MM-DD`; e.g. `DD/MM/YYYY`,
  `MM/DD/YYYY`). **Localized/textual month-name formats are deferred** (DEF-30, preflight PF-003) — feasible
  via a letter-permissive `picture` mask (`?`/`&`) + a locale parse/serialize pair, but out of the v1 slice
  (see Deferred). The picker binds one **`value: Signal<CalendarDate | null>`**; the
  field text is derived from `value` via the format and parsed back on edit.
- **Open / commit / cancel (mirrors `ComboBox`, `combo-box.ts:175-214`):** opens on the field's
  **Down / Alt+Down** or a **click on `▼`**; the popup calendar takes focus; a **single click on a day**
  (or **Enter** on the cursor) **commits** the date **and closes** the popup; **Esc** or an **outside
  mouse-down** cancels (value unchanged); **no overlay host ⇒ decline to open** (headless — the ComboBox
  `host === undefined` guard, `combo-box.ts:191`).
- **Two-way sync:** typing a complete valid date in the field parses to `value` (moving the calendar
  cursor + selection when opened); picking in the calendar sets `value` (⇒ field text via the format).
  Incomplete/invalid field text leaves `value` at its last committed value (or `null`).
- **Calendar options pass-through:** the `DatePicker` forwards `today`/`min`/`max`/`isDisabled`/
  `firstDayOfWeek`/`showWeekNumbers` to its hosted `Calendar` — the picker is a thin host around the same grid.

#### Anchored-popup generalization (AR-204) — additive to RD-14
- **Generalize the internal `openAnchoredPopup`** (`packages/ui/src/dropdown/popup.ts:59-78,199`) from
  *list-only* to hosting **any fixed-size `View`**: replace the `buildList(): ListView<T>` +
  `onPick(index)` + `maxRows`-based height with a **`buildContent(): View`** factory + a caller-supplied
  **content size** (a `Calendar` is fixed 20×8 + optional week column) + a **`commit()`** callback the
  content invokes on activation. **`History` and `ComboBox` are refactored to call the generalized
  primitive unchanged** (they pass a `ListView` builder + the `maxRows`-derived size + their pick handler).
  The primitive is **internal (not exported)** — this is an **additive, non-public-breaking** change
  (`popup.ts`'s exports `openAnchoredPopup`/`AnchoredPopupOptions` are consumed only within `dropdown/`).
  The catcher, frame chrome, anchor/clamp math (`absoluteRect`, the `THistory` rect sequence
  `popup.ts:144-160`), focus save/restore, and Esc/outside-click dismissal are **reused as-is**.

#### Theme roles — additive faithful `calendar*` colours (AR-207)
- Add a small set of **additive `calendar*` roles** to core `@jsvision/core` `Theme` + `defaultTheme`:
  **today** (the `getColor(7)` decode), **selected** (a distinct highlight for the selected day),
  **normal** in-month day, **disabled** day, and (if the GATE-1 decode
  needs it) the **week-number** colour — each decoded through the **`wpCyanWindow` → `cpAppColor`** chain
  at **plan GATE-1** and pinned to an exact attribute byte per the fidelity directive. Same additive,
  non-breaking cross-package pattern as the RD-06/07/11/15/16/17/18 roles (AR-97/112/122/149/159/180/192).
  **Exact role count + attribute bytes pinned at plan GATE-1/GATE-2.** There is **no** adjacent-month-day
  role: leading/trailing out-of-month cells are drawn **blank in the normal role**, TV-faithful
  (`calendar.cpp:155-156` moves `"   "` in `getColor(6)`; TV draws no adjacent-month day numbers). Drawing
  adjacent-month days would be a documented TV deviation — deferred, not in this RD.

#### Kitchen-sink stories + headless demo (AR-209)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`Calendar` story** and a **`DatePicker`
  story** (category `Date`) — the calendar with a visible selected-date echo, today highlighted, a
  disabled-day example, and week numbers toggled on; the picker as a one-line field opening the calendar
  popup — both passing the headless smoke test, plus a headless **`demo:date`** walkthrough (dispatch-
  driven, an ASCII frame per step: render → arrow day-nav → PgDn month → pick a day → open the picker
  popup → commit), matching `demo:tabs`/`demo:table`/`demo:feedback`.

### Should Have
- **`Calendar.select(date)` / `today()` / `goToMonth(year, month)`** convenience methods (drive the same
  signals programmatically).
- **`onChange(date)`** callback fired when `value` changes (parallel to how RD-17 offers `onChange`).
- **A range-selection mode** (`selectionMode: 'range'` → `Signal<[CalendarDate, CalendarDate] | null>`) —
  **deferred** below unless promoted.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- **All color components** (`ColorSwatch`/`ColorPicker`) — the sibling **RD-21** (AR-210+).
- **Time-of-day / datetime / timezone** — `CalendarDate` is civil-date-only (AR-196); a time or datetime
  picker is a separate component.
- **Date-range selection** (two endpoints) — single-date only for v1 (see Deferred).
- **Multi-month / year-grid / decade views** — one month at a time, matching `TCalendarView`.
- **Relative/natural-language parsing** ("tomorrow", "+3d") in the field — the format mask is structural.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention); mirrored in the central
[`DEFERRED.md`](DEFERRED.md) as DEF-27…DEF-30:**

| Deferred item | DEF | From decision | Target | Rationale |
|---------------|-----|---------------|--------|-----------|
| Date-range selection (two endpoints, range highlight) | DEF-27 | Should-Have | later (post-set) | A selection-mode variant on the same grid; single-date is the common case. |
| Time / datetime picker | DEF-28 | AR-196 (civil-date-only) | later | A distinct component (time spinner + calendar); out of the date-family MVP. |
| Multi-month / year / decade browsing views | DEF-29 | out-of-scope | later | Geometry variants on the same renderer; one month matches TV. |
| Localized / textual month-name field formats (e.g. `15 Sep 2026`) | DEF-30 | AR-203 (preflight PF-003) | later | Feasible via a letter-permissive `picture` mask (`?`/`&`) + a locale parse/serialize pair; v1 ships digit-reorder masks only (which AC-12 tests). |

---

## Technical Requirements

### New subsystem (AR-208)
- One new subsystem dir **`packages/ui/src/date/`** (dir-per-concern, AR-133/148/160/181/193):
  `calendar-date.ts` (the `CalendarDate` type + pure helpers + `Date`/ISO interop, view-free),
  `calendar.ts` (the `Calendar` `View` — grid draw, month/day nav, bounds/disabled, week numbers,
  first-day-of-week), `date-picker.ts` (the `DatePicker` `Group` — masked `Input` + `▼` + the generalized
  anchored popup + format), one barrel `index.ts`; per-file ≤ 500 lines (split the grid renderer out —
  e.g. `calendar-grid.ts` — if `calendar.ts` would exceed 500, mirroring the `*-rows.ts` split). **Explicit
  named re-exports** from `src/index.ts` (the layout-convention rule, AR-81/102/113). *(Exact file split
  confirmed at plan time.)*
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Cross-package + cross-RD edits (additive only)
- **`@jsvision/core`** `Theme` + `defaultTheme` gain the additive **`calendar*` roles** (AR-207), decoded
  from `wpCyanWindow`/`cpAppColor` at plan GATE-1 (exact bytes pinned). No existing role changes.
- **RD-14 `dropdown/popup.ts`** internal primitive is **generalized** to host an arbitrary sized `View`
  (AR-204); `history.ts` + `combo-box.ts` are updated to the generalized call, behavior unchanged. This is
  the only edit to shipped RD-14 code and is **additive/refactor-only** (internal surface; no public API
  change). Covered by the existing RD-14 tests staying green + new picker tests.

### Reuse (no new engine primitives)
- **Popup/overlay (RD-14/RD-05):** the `DatePicker` reuses the generalized `openAnchoredPopup` +
  `PopupHost` seam + the `absoluteRect` anchor math + the catcher/Esc/outside-click dismissal
  (`popup.ts`), exactly as `ComboBox` does.
- **Field mask (RD-07):** `picture("####-##-##")` + the `Validator` model gate the field (`picture.ts`).
- **Frame chrome (RD-05):** the calendar view sits inside the popup frame RD-14 already draws; the
  standalone `Calendar` is a bare grid `View` (its host `Window`/`Dialog` supplies any frame), matching
  how `TCalendarView` is a bare view inside `TCalendarWindow` (`calendar.cpp:268-281`).
- **Reactivity/draw (RD-01/RD-03):** `Signal`/`computed` drive the grid + selection + cursor; RD-03
  `bind`/`invalidate`; all writes via `DrawContext` → `ScreenBuffer` + core `sanitize`.
- **Focus/keys/mouse (RD-04):** the `Calendar` is a focusable `View` in the focus chain; the day/month
  keymap routes through the RD-04 keymap; clicks hit-test through the standard mouse path.
- **Disabled greying (RD-06):** disabled days reuse the Button/Cluster disabled-colour convention.

---

## Integration Points

- **View/Group + reactivity (RD-03/RD-01):** `Calendar` is a focusable `View`; `DatePicker` is a `Group`
  (`Input` + button), the same composition `ComboBox` uses.
- **Input dropdowns (RD-14):** `DatePicker` is the third client of the anchored popup (after `History` +
  `ComboBox`); this RD **generalizes** that primitive so a non-list view can be hosted — a change that
  also unblocks RD-21's `ColorPicker`.
- **Essential controls (RD-06/07):** the field is an `Input` + a `picture` validator; the button mirrors
  `ComboButton`.
- **App shell (RD-05):** a `Calendar`/`DatePicker` mounts in a `Window`/`Dialog`/`Desktop` like any
  focusable widget; the picker needs the overlay `PopupHost` (present in a shell or a bare `Dialog`, PA-9).
- **Core theme (core):** the additive `calendar*` roles extend the same `Theme` every other subsystem
  reads; `defaultTheme` stays the single source of truth.
- **Kitchen-sink (examples):** `Calendar` + `DatePicker` stories + `demo:date`.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-195** — RD-20 is **decode-first for `Calendar`** (TV counterpart `TCalendarView`, `calendar.cpp`)
  and a **documented extension for `DatePicker` + day-selection** (TV had neither).
- **AR-196** — `CalendarDate` = `readonly {year, month(1-12), day}` + pure zero-dep helpers + `Date`/ISO
  interop confined to the boundary.
- **AR-197** — the date is **nullable** (`Signal<CalendarDate | null>`); the field/calendar can be empty.
- **AR-198** — **min/max clamp** navigation; an **`isDisabled` predicate** dims days that stay visible +
  navigable but **non-committable**.
- **AR-199** — **modern day-nav keymap** (`←→` day, `↑↓` week, PgUp/Dn month, Ctrl+PgUp/Dn year, Home/End),
  a **documented deviation** from TV's `↑↓`=month (TV had no day cursor); `+`/`-` kept as month shortcuts.
- **AR-200** — **`today`** is an **optional injectable input**; default resolves from the system clock at
  mount; today is always highlighted (the `getColor(7)` decode).
- **AR-201** — **`firstDayOfWeek`** configurable, default **Sunday** (TV-faithful).
- **AR-202** — **week-number column** opt-in (`showWeekNumbers`, default off), **ISO-8601** numbering.
- **AR-203** — **configurable date format/locale** is **in scope** for v1 (default ISO `YYYY-MM-DD` via the
  `picture` mask; alternative masks + localized month names selectable).
- **AR-204** — **generalize `openAnchoredPopup`** (RD-14, internal) to host an arbitrary fixed-size `View`;
  `History`/`ComboBox` refactored to the generalized call; additive, no public break.
- **AR-205** — `DatePicker` = masked `Input` + `▼` + generalized anchored `Calendar` popup; open on
  Down/Alt+Down/click, Esc/outside cancels — mirroring `ComboBox`.
- **AR-206** — **single click on a day commits + closes** (Enter/Space also commit); arrow-nav moves the
  cursor without committing.
- **AR-207** — additive **`calendar*` theme roles** (today/selected/normal/disabled/[week#]; **no**
  adjacent-month-day role — out-of-month cells are blank in the normal role, TV-faithful, preflight PF-002),
  bytes pinned through `wpCyanWindow`/`cpAppColor` at **plan GATE-1**.
- **AR-208** — new `src/date/` subsystem, explicit named re-exports.
- **AR-209** — kitchen-sink `Calendar` + `DatePicker` stories + headless `demo:date`.

> **Traceability:** AR-197/198/199/202/203/204 are explicit user choices (RD-20 `add_requirement` gate,
> 2026-07-03, resolved via the design-review question set); AR-195/196/200/201/205/206/207/208/209 are
> source-determined or single-dominant decisions (the GATE-1 finding, the house value/idiom/subsystem/demo
> patterns) recorded for traceability.

---

## Security Considerations

> RD-20 adds a **date view + a dropdown picker** over the existing in-process TUI. No network, no
> persistence, no new untrusted external surface. The input boundaries are keystroke/mouse → view state
> and field text → date parse → screen:
- Every rendered glyph (month/weekday labels, day digits, week numbers) routes through the RD-03
  `DrawContext` → `ScreenBuffer` + core **`sanitize`** boundary — no raw escape sequence reaches the
  terminal (the canonical injection boundary the whole UI uses).
- The field is gated by the RD-07 **`picture` validator** (structural allowlist — only `YYYY-MM-DD`-shaped
  input accepted); parsing (`parseISO`/the format parser) **validates ranges** (month 1-12, day 1-
  `daysInMonth`) and returns **`null`** on any malformed/out-of-range input — never throws, never yields
  an invalid `CalendarDate`.
- All grid indexing (cursor moves, month/day math, week rows, `daysInMonth`, leap-year) is
  **bounds-checked/clamped** to `min`/`max` and the month length — no out-of-range indexing for any month,
  leap year, empty selection, or `firstDayOfWeek`/week-number configuration.
- The `today` input (or the system-clock default) is read only to **highlight**, never to auto-commit a
  value; `onChange`/callbacks are caller-supplied and invoked only on user action; no date text is
  interpreted as code.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode. The `Calendar` fidelity ACs (AC-3 geometry, AC-4
today, AC-11 colours) diff against the **`TCalendarView` decode** (`calendar.cpp`), pinned at plan
GATE-1/GATE-2; the extension ACs encode the selection/nav/picker behavior.

- **AC-1** (`CalendarDate` value + helpers) — `daysInMonth(2024, 2)` = `29` and `daysInMonth(2100, 2)` =
  `28` (Gregorian leap rule); `daysInMonth(2026, 4)` = `30`; `dayOfWeek({year:2026,month:9,day:1})` = `2`
  (Tuesday, Sunday=0); `toISO({2026,9,15})` = `"2026-09-15"`; `parseISO("2026-13-01")` and
  `parseISO("2026-02-30")` and `parseISO("nope")` each return `null`; `fromDate`/`toDate` round-trip a
  civil date with `month` 1-based (a `Date` for March gives `month:3`). *(AR-196)*
- **AC-2** (nullable value + empty) — a `Calendar`/`DatePicker` with `value: signal(null)` renders with **no
  day selected** (today still highlighted); the picker field is **blank**; nothing crashes. *(AR-197)*
- **AC-3** (grid geometry, faithful) — for a given `{year, month}` the `Calendar` draws a **20-column**
  block (the view extent after `getExtent().grow(-1,-1)`; the draw buffer is filled to 22 but clipped to
  20): row 0 `«month» «year» ▲ ▼` (▲/▼ at the decoded columns), row 1 the weekday labels, and **6 week
  rows** where day `d` sits **2-digit right-justified at column `j*3`** with the correct leading blanks
  (day 1's column = `dayOfWeek(1)` shifted by `firstDayOfWeek`); asserted against the buffer pre-`serialize`
  and matched to the `calendar.cpp:124-171` decode. *(AR-195/AR-201)*
- **AC-4** (today highlight, faithful) — with `today = {2026,9,3}` the day **3** cell renders in the
  **today** role and every other in-month day in the **normal** role (the `getColor(7)`/`getColor(6)`
  decode); the selected day (if any, AC-5) renders in the distinct **selected** role so today and selection
  are visually separable. *(AR-195/AR-200/AR-207)*
- **AC-5** (select a day) — Enter/Space on the cursor, or a single click on a day cell, sets
  `value` to that `CalendarDate`; the cell repaints in the selected role (selecting **today** repaints it
  in the **selected** role — selected wins over today when they coincide); month navigation
  (▲/▼/`+`/`-`/PgUp/Dn) does **not** change `value`. *(AR-195/AR-206)*
- **AC-6** (day-nav keymap) — from a focused cursor: `→` moves +1 day (crossing into next month at
  month-end, re-rendering it), `←` −1 day, `↓` +7 days, `↑` −7 days, **PgDn/PgUp** ±1 month, **Ctrl+PgDn/
  Ctrl+PgUp** ±1 year, **Home/End** to the visible week's first/last day. Plain arrows do **not** leave the
  calendar's focus. *(AR-199)*
- **AC-7** (month nav, faithful) — a click at the decoded **▲** column advances to the next month and **▼**
  to the previous (`calendar.cpp:185-204`); `+`/`-` do the same; the grid re-renders for the new month with
  today/selection preserved. *(AR-195)*
- **AC-8** (min/max + disabled) — with `min`/`max` set, the cursor cannot move before `min` or after `max`
  and those days are unreachable; an `isDisabled(date)` day is **drawn dimmed**, is **navigable**, but
  Enter/Space/click on it is a **no-op** (`value` unchanged). *(AR-198)*
- **AC-9** (first-day-of-week + week numbers) — `firstDayOfWeek: 1` renders the weekday header starting
  `Mo` and shifts day 1's column accordingly; `showWeekNumbers: true` adds a leading **ISO-8601** week-
  number column (per ISO 8601: week 1 contains the year's first Thursday; each row's number is the ISO
  week of that row's **Thursday**, stable regardless of `firstDayOfWeek`) without disturbing the day
  columns' `j*3` geometry. *(AR-201/AR-202)*
- **AC-10** (`DatePicker` field + mask + open/commit/cancel) — the field accepts only `YYYY-MM-DD`-shaped
  input (`picture` mask); **Down/Alt+Down** or a click on **▼** opens the `Calendar` popup (a no-op with no
  `PopupHost`); a **single click on a day** (or Enter on the cursor) sets `value` **and closes** the popup;
  **Esc**/outside-mouse-down closes **without** changing `value`. *(AR-203/AR-204/AR-205/AR-206)*
- **AC-11** (two-way field ⟷ calendar sync) — setting `value` updates the field text via the format;
  typing a complete valid date and reopening positions the calendar cursor/selection on it; incomplete/
  invalid field text leaves `value` unchanged. *(AR-205)*
- **AC-12** (configurable format) — with `format: 'DD/MM/YYYY'` the field mask/parse/serialize use that
  order (`15/09/2026` ⟷ `{2026,9,15}`); the default is ISO `YYYY-MM-DD`. *(AR-203)*
- **AC-13** (anchored-popup generalization; RD-14 intact) — `openAnchoredPopup` hosts an arbitrary fixed-
  size `View` (the `Calendar`) via `buildContent()` + a caller size + `commit()`; the **existing `History`
  + `ComboBox` tests stay green** (refactored to the generalized call, behavior unchanged); no public
  export of `dropdown/` changes. *(AR-204)*
- **AC-14** (theme roles) — `defaultTheme` exposes the additive `calendar*` roles (today/selected/normal/
  disabled[/week#], `cpAppColor`-decoded); `encode()` of each does not throw; no existing role
  changes. *(AR-207)*
- **AC-15** (packaging) — the date family lives in `packages/ui/src/date/` with explicit named re-exports
  from `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines. *(AR-208)*
- **AC-16** (stories + demo) — `Calendar` and `DatePicker` kitchen-sink stories (category **`Date`**;
  selected-date echo, today, a disabled day, week numbers on; the picker opening its popup) pass the
  headless smoke test; **`demo:date`** runs headless with an ASCII frame per step (render → arrow day-nav →
  PgDn month → pick a day → open the picker popup → commit). *(AR-209)*
- **AC-17** (security) — every label/digit/week-number is sanitized to the screen; the field is `picture`-
  gated and the parser returns `null` (never throws / never an invalid date) on malformed or out-of-range
  input; all grid/month/day indexing is bounds-checked for every month, leap year, empty selection, and
  `firstDayOfWeek`/week-number setting. *(security standard)*

---

> **Next step:** run the make_plan skill on RD-20 (spec-first: spec oracles RED → implement → GREEN → impl
> tests). Because `Calendar` **has a TV counterpart** (GATE-1), the plan's GATE-1/GATE-2 work is mandatory:
> **decode `TCalendarView::draw()` cell-by-cell** (`calendar.cpp:124-172` — the 20×8 view geometry, `«month»
> «year» ▲▼` header + hit columns, weekday row, `j*3` day columns, leading-blank offset), **pin the
> `calendar*` theme-role attribute bytes through the `wpCyanWindow`/`cpAppColor` chain**, and record the
> decode + the two BEFORE/AFTER gate tasks in `99-execution-plan.md`; the day-selection/nav/picker
> extensions get spec oracles but no diff. Then optionally preflight, then exec_plan. **RD-21 (Color
> family)** is the sibling and reuses the AR-204 popup generalization landed here.
