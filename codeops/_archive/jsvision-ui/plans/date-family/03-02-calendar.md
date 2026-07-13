# Calendar: the month-grid view

> **Document**: 03-02-calendar.md
> **Parent**: [Index](00-index.md)

## Overview

`Calendar` is a focusable `View` drawing a **faithful decode** of Turbo Vision's `TCalendarView`
(20×8 month grid), extended with a selectable day, a modern day-navigation cursor, min/max bounds,
disabled days, an optional ISO week-number column, and a configurable first-day-of-week. The **drawing
is a decode, not a design** — geometry, glyphs, hit-zones, and the two decoded colours match
`calendar.cpp` cell-by-cell (GATE-1/GATE-2). The pure grid math is split into `calendar-grid.ts`
(PA-6) so `calendar.ts` stays ≤ 500 lines and the math is unit-testable.

---

## TV decode (GATE 1) — `TCalendarView` (`examples/tvdemo/calendar.cpp`, `calendar.h`)

**Cite every fact below in the `calendar.ts` / `calendar-grid.ts` JSDoc at implementation time; re-open
`calendar.cpp` and diff cell-by-cell at GATE-2 before marking the component done.**

| Piece | Decode | `file:line` |
|-------|--------|-------------|
| View size | **20 cols × 8 rows** — window `TRect(1,1,23,11)`=22×10 (`wnNoNumber`, `flags &= ~(wfZoom\|wfGrow)`), `palette = wpCyanWindow`, inset `r.grow(-1,-1)` → 20×8. The `22` in `draw()` is an over-allocated buffer **clipped to the 20-col view** (PF-001) | `calendar.cpp:268-281`; `objects.h` `grow`; `tview.cpp` `getExtent` |
| Row 0 header | `«month» «year» ▲  ▼` — `setw(9)` month, `" "`, `setw(4)` year, `" "`, CP437 `30`=▲, `"  "`, CP437 `31`=▼, `" "` = 20 cols. ▲ at **col 15**, ▼ at **col 18** | `calendar.cpp:139-144` |
| Month nav (mouse) | local **x=15,y=0 ⇒ ++month** (next); **x=18,y=0 ⇒ −−month** (prev), with year roll | `calendar.cpp:185-204` |
| Month nav (keys) | `+`/kbDown ⇒ next; `-`/kbUp ⇒ prev (TV; our arrows are reassigned to day-nav, AR-199) | `calendar.cpp:206-231` |
| Row 1 weekday | `"Su Mo Tu We Th Fr Sa"` (2-char labels, space-separated) = 20 cols | `calendar.cpp:147` |
| Rows 2-7 grid | 6 rows × 7 cols; day `d` = `setw(2)` right-justified at **col `j*3`**; leading offset `current = 1 - dayOfWeek(1,month,year)`; out-of-range cells = `"   "` (blank) | `calendar.cpp:150-171` |
| Today | today cell in **`getColor(7)`** (bold), all other in-month days in **`getColor(6)`** | `calendar.cpp:134-135,163-166` |
| Colour chain | `getColor(6)`→`cpCyanWindow[6]=0x15`→`cpAppColor[21]=0x3E` **yellow-on-cyan**; `getColor(7)`→`cpCyanWindow[7]=0x16`→`cpAppColor[22]=0x21` **blue-on-green** | `views.h:956`, `app.h:142` |
| Weekday algo | Zeller `dayOfWeek(day,month,year)`, Sunday=0 | `calendar.cpp:100-121` |
| Leap | TV uses `year%4==0` (`calendar.cpp:128-129`); RD-20 corrects to full Gregorian in `daysInMonth` | AR-196 |

**Extensions (no TV counterpart — spec oracles, no diff):** selectable `value`, the day-nav cursor,
min/max, disabled days, week numbers, first-day-of-week ≠ 0. Out-of-month cells stay **blank in the
normal role** (no adjacent-month day numbers, PF-002) — TV draws `"   "` there.

---

## Architecture

### Proposed Changes
Two new files: `calendar-grid.ts` (pure, view-free geometry + week numbers) and `calendar.ts` (the
`View`). Both re-exported through the barrel; `Calendar` + `CalendarOptions` are public.

## Implementation Details

### `calendar-grid.ts` — pure geometry (view-free, PA-6/PA-10)

```ts
/** The 6×7 day matrix for a month: cells hold a CalendarDate or null (leading/trailing blanks). */
export interface MonthGrid {
  readonly weekdayLabels: readonly string[];       // 7 labels rotated by firstDayOfWeek
  readonly rows: readonly (readonly (CalendarDate | null)[])[]; // 6 rows × 7 cols
  readonly weekNumbers: readonly (number | null)[]; // 6 ISO week numbers (row's Thursday), or null
}

/**
 * Build the month matrix. `firstDayOfWeek` (0=Sun|1=Mon) rotates both the labels and the column day 1
 * lands in: leading offset = `((dayOfWeek({y,m,1}) - firstDayOfWeek) + 7) % 7`. Cells before day 1 or
 * after daysInMonth are null (drawn blank). Week numbers per PA-10 (row's Thursday) when requested.
 */
export function buildMonthGrid(
  year: number, month: number,
  opts: { firstDayOfWeek: 0 | 1; weekNumbers: boolean },
): MonthGrid;

/** Column of a day index `j` (0-6) in view coords: `weekNumberColWidth + j*3` (PA-3 `j*3` geometry). */
export function dayColumn(j: number, weekNumberCol: boolean): number;

/** ISO-8601 week number of a date, labelled by its week's Thursday (PA-10). Pure, unit-tested. */
export function isoWeek(date: CalendarDate): number;
```

**Week-number width (PA-10 / AR-202):** when `showWeekNumbers`, a leading column widens the view by a
fixed **3 cells** (`"NN "` — 2-digit week + 1 gap, in `calendarWeekNumber`), so the view is **23×8**;
the day columns shift right by that width but keep their internal `j*3` spacing (AC-9). Weekday-label
row and header shift accordingly.

### `calendar.ts` — the `Calendar` view

```ts
export interface CalendarOptions {
  /** Two-way selected day (`null` = no selection). */
  value: Signal<CalendarDate | null>;
  /** "Today" to highlight (default: system clock at mount, AR-200). */
  today?: CalendarDate;
  /** Inclusive navigation bounds (the cursor never leaves [min,max]; AC-8). */
  min?: CalendarDate;
  max?: CalendarDate;
  /** Dims a day (drawn `calendarDisabled`, navigable, non-committable). */
  isDisabled?: (date: CalendarDate) => boolean;
  /** 0=Sunday (default, TV-faithful) | 1=Monday (ISO). */
  firstDayOfWeek?: 0 | 1;
  /** Opt-in leading ISO week-number column (default false). */
  showWeekNumbers?: boolean;
  /** Fired when `value` changes (Should-Have, PA-8). */
  onChange?: (date: CalendarDate) => void;
}

export class Calendar extends View {
  readonly value: Signal<CalendarDate | null>;
  // internal reactive state:
  //   visibleYear/visibleMonth: Signal<number>  — the shown month
  //   cursor: Signal<CalendarDate>              — the focus cell (PA-9 init: value ?? today ?? day1, clamped)
  select(date: CalendarDate): void;   // programmatic commit (respects disabled/bounds → no-op if invalid)
  today(): void;                      // move the cursor + visible month to today
  goToMonth(year: number, month: number): void; // change the visible month (not value/cursor)
}
```

**Draw (per the decode + precedence PA-4):** header (`«month» «year» ▲ ▼`), weekday row, 6 grid rows.
Each day cell's role via a single `cellRole(date)` helper:

```
focused:   cursor === date        → calendarCursor
           value  === date        → calendarSelected
           today  === date        → calendarToday
           isDisabled(date)       → calendarDisabled
           otherwise              → calendarNormal
unfocused: (drop the cursor branch; selected > today > disabled > normal)
```

Out-of-month cells: `"   "` in `calendarNormal` (blank, PF-002). Week-number column (if on): `"NN "`
in `calendarWeekNumber`. All writes via `DrawContext` (clipped) + core `sanitize`.

**Keymap (`onEvent`, PA-9 / AR-199):** the calendar is focusable; while focused it consumes
- `←/→` → `cursor = clampBounds(addDays(cursor, ∓1))`; `↑/↓` → `addDays(cursor, ∓7)`;
- `PgUp/PgDn` → `addMonths(cursor, ∓1)` (day clamped); `Ctrl+PgUp/PgDn` → `addMonths(cursor, ∓12)`;
- `Home/End` → first/last day of the cursor's visible week;
- a cursor move that crosses the visible month re-points `visibleYear/visibleMonth` to the cursor;
- `+`/`-` → visible month only (cursor + value unchanged); `Enter`/`Space` → `commit(cursor)`.
- Plain arrows are always consumed (never leave the calendar's focus, AC-6).

`clampBounds(d)` = `compare(d,min)<0 ? min : compare(d,max)>0 ? max : d` (only when the respective
bound is set), so the cursor never lands out of `[min,max]` (AC-8).

**Mouse (`onEvent`):** the month-nav hit columns are the decoded TV columns **offset by the
week-number column width** so they track the shifted header (the header, weekday row, and day columns all
shift right by `weekNumberColWidth` when `showWeekNumbers`, and `dayColumn` already applies the same
offset). Concretely: `nextCol = weekNumberColWidth + 15`, `prevCol = weekNumberColWidth + 18`
(`weekNumberColWidth = showWeekNumbers ? 3 : 0`, so with no week numbers they are the faithful TV
`15`/`18`, `calendar.cpp:185-204`). A click at `(nextCol, 0)` ⇒ next month, `(prevCol, 0)` ⇒ prev month.
A click on a day cell ⇒ move the cursor there **and** `commit(that date)` (AR-206; a single click both
moves + commits, matching the picker's one-click-commit — AC-5/AC-10). **The hit columns MUST be derived
from the same `weekNumberColWidth` offset as `dayColumn`** — a fixed `15`/`18` would leave the arrows dead
in week-number mode (the arrows render at `18`/`21` but the click would test `15`/`18`).

**`commit(date)`:** if `isDisabled(date)` or out of `[min,max]` → **no-op** (AC-8); else `value.set(date)`
+ `onChange?.(date)`.

**`today` default (AR-200):** if `today` is not supplied, resolve once at mount from `fromDate(new
Date())`. Injectable for tests.

### Integration Points
- Focusable `View` in the RD-04 focus chain; repaints via RD-03 `invalidate` on any signal change.
- `DatePicker` hosts a `Calendar` in the anchored popup and forwards all options (PF-008).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Commit/click on a disabled or out-of-range day | No-op (`value` unchanged) | AC-8 / AR-198 |
| Cursor move that would leave `[min,max]` | Clamp to the bound (cursor stays in range) | AC-8 / PA-9 |
| `value` = null | Nothing drawn selected; today still highlighted; cursor still initialized | AC-2 / AR-197 |
| Cell is today + selected + cursor simultaneously | Precedence cursor>selected>today (focused) | PA-4 / PF-006 |
| Week-number column on a Sunday-started row | ISO week of the row's Thursday (stable) | PA-10 / PF-007 |

> **Traceability:** every choice references the register. See `00-ambiguity-register.md`.

## Testing Requirements
- Spec (ST-2…ST-9): nullable render, grid geometry (cell-by-cell pre-`serialize`), today/normal
  colours, selection + precedence, day-nav keymap, month nav, min/max + disabled, first-day + week#.
- Impl: cursor init/clamp edges, cross-month re-point, Home/End week ends, `select`/`today`/`goToMonth`,
  `onChange` firing, `buildMonthGrid`/`isoWeek` pure-math tables (leap Feb, year-boundary weeks).
- GATE-2 AFTER-diff: the composed buffer vs `calendar.cpp` (header cols, ▲▼ at 15/18, `j*3` days,
  `0x3E`/`0x21` styles).
