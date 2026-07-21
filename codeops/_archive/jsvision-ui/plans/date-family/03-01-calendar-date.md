# CalendarDate: value type + pure helpers

> **Document**: 03-01-calendar-date.md
> **Parent**: [Index](00-index.md)

## Overview

`CalendarDate` is the civil-date value the whole family passes around — a plain, immutable
`{ year, month(1-12), day }` with **pure, zero-dep** helpers and `Date`/ISO interop confined to two
boundary functions. It is view-free (`calendar-date.ts`), so it is unit-testable in isolation and
carries no reactivity. (AR-196 / PA-7)

## Architecture

### Proposed Changes
New file `packages/ui/src/date/calendar-date.ts`. No existing code changes. Re-exported from the ui
barrel (03-04).

## Implementation Details

### New Types/Interfaces

```ts
/** A civil (wall-clock) date — no time-of-day, no timezone. `month` is 1-12, `day` is 1-31. (PA-7) */
export interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1-12 (TV-faithful: TCalendarView uses 1-based months)
  readonly day: number;   // 1-31
}
```

### New Functions/Methods

```ts
/**
 * Days in a month, Gregorian leap-correct: Feb = 29 when `year%4===0 && (year%100!==0 || year%400===0)`
 * (correcting TV's simpler `year%4==0`, calendar.cpp:128-129). `month` is 1-12.
 */
export function daysInMonth(year: number, month: number): number;

/** Day of week, 0 = Sunday … 6 = Saturday (Zeller, matching calendar.cpp:100-121). */
export function dayOfWeek(date: CalendarDate): number;

/** Add `n` months (may be negative); the day is clamped to the target month's length. */
export function addMonths(date: CalendarDate, n: number): CalendarDate;

/** Add `n` days (may be negative); rolls across month/year boundaries via a day-count walk. */
export function addDays(date: CalendarDate, n: number): CalendarDate;

/** Order two dates: -1 if a<b, 0 if equal, +1 if a>b (year, then month, then day). */
export function compare(a: CalendarDate, b: CalendarDate): -1 | 0 | 1;

/** Serialize to `"YYYY-MM-DD"` (zero-padded). */
export function toISO(date: CalendarDate): string;

/**
 * Parse `"YYYY-MM-DD"` → a range-validated CalendarDate, or **null** on any malformed / out-of-range
 * input (bad shape, month∉1-12, day∉1-daysInMonth). Never throws, never yields an invalid date. (AC-1/AC-17)
 */
export function parseISO(str: string): CalendarDate | null;

/** Read a JS Date into a civil date (getFullYear / getMonth()+1 / getDate). The +1 lives ONLY here. */
export function fromDate(d: Date): CalendarDate;

/** Materialize a JS Date at local midnight (`new Date(y, m-1, d)`). The −1 lives ONLY here. */
export function toDate(cd: CalendarDate): Date;
```

### Integration Points
- `Calendar` + `DatePicker` consume these for cursor math, bounds compares, and field parse/serialize.
- `date-grid.ts` uses `daysInMonth` + `dayOfWeek` for the month matrix; `date-format.ts` uses the
  range-validating parse for non-ISO masks.

## Code Examples

```ts
daysInMonth(2024, 2);                       // 29 (leap)
daysInMonth(2100, 2);                       // 28 (century, not /400)
dayOfWeek({ year: 2026, month: 9, day: 1 }); // 2 (Tuesday)
toISO({ year: 2026, month: 9, day: 15 });    // "2026-09-15"
parseISO("2026-02-30");                      // null
addDays({ year: 2026, month: 1, day: 31 }, 1); // { 2026, 2, 1 }
addMonths({ year: 2026, month: 1, day: 31 }, 1); // { 2026, 2, 28 } (clamped)
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Malformed / out-of-range `parseISO` input | Return `null` (never throw / never an invalid date) | AC-1/AC-17 / PA-7 |
| `addMonths` day overflows the target month | Clamp the day to `daysInMonth(targetYear, targetMonth)` | PA-7 |
| `daysInMonth` century leap edge (1900/2100 vs 2000) | Full Gregorian rule, not TV's `year%4==0` | AR-196 |

> **Traceability:** every design choice references the register. See `00-ambiguity-register.md`.

## Testing Requirements
- Unit (spec ST-1): the AC-1 table (`daysInMonth` leap + century, `dayOfWeek`, `toISO`, `parseISO`
  null cases, `fromDate`/`toDate` 1-based round-trip).
- Impl: `addDays`/`addMonths` boundary rolls (Dec→Jan, Jan-31→Feb clamp), `compare` all branches,
  negative `n`, `parseISO` of every malformed shape (non-digits, wrong separators, short/long).
