# Theme roles + packaging + kitchen-sink + demo

> **Document**: 03-04-theme-packaging.md
> **Parent**: [Index](00-index.md)

## Overview

The additive `calendar*` core theme roles (PA-2/PA-3), the ui packaging (explicit re-exports, zero
deps, ≤500 lines), and the NON-NEGOTIABLE kitchen-sink stories + headless `demo:date` (PA-13).

## Theme roles (`packages/core/src/engine/color/theme.ts`) — additive (PA-3)

Two roles are **TV-decoded** (`getColor(6)`/`getColor(7)` via `wpCyanWindow` → `cpAppColor`); four are
**extensions** (TV has no selection/cursor/disabled/week#). All six pinned:

| Role | Byte | `{ fg, bg }` | Basis |
|------|------|--------------|-------|
| `calendarNormal` | `0x3E` | `{ fg: PALETTE.yellow, bg: PALETTE.cyan }` | TV `getColor(6)` (`calendar.cpp:134,163`) |
| `calendarToday` | `0x21` | `{ fg: PALETTE.blue, bg: PALETTE.green }` | TV `getColor(7)` (`calendar.cpp:135,165`) |
| `calendarSelected` | `0x1F` | `{ fg: PALETTE.white, bg: PALETTE.blue }` | extension (PA-2) |
| `calendarCursor` | `0x3F` | `{ fg: PALETTE.white, bg: PALETTE.cyan }` | extension (PA-1) |
| `calendarDisabled` | `0x38` | `{ fg: PALETTE.darkGray, bg: PALETTE.cyan }` | extension (= clusterDisabled family) |
| `calendarWeekNumber` | `0x30` | `{ fg: PALETTE.black, bg: PALETTE.cyan }` | extension (PA-2) |

- Added to the `Theme` interface + `defaultTheme` with JSDoc citing the decode / PA. **No existing
  role changes.** `encode()` of each must not throw (AC-14).
- **PA-14 cross-RD guard:** adding these 6 keys trips **two** closed-set inventory guards (verified):
  `tabs-theme.spec` **ST-30** (`tabs-theme.spec.test.ts:120` — has a `LATER_ADDITIVE_ROLES` set; append
  the 6 `calendar*` roles) **and** `feedback-theme.spec` **ST-11** (`feedback-theme.spec.test.ts:119` —
  its `knownKeys` has **no** `LATER_ADDITIVE_ROLES` scaffold, so introduce one there mirroring tabs and
  add the 6 roles). `table-theme.spec` has **no** key-inventory guard (only a `cpListViewer` regression
  check) → unaffected. Still `grep -rn "LATER_ADDITIVE_ROLES\|additive\|ONLY" packages/ui/test/*theme*`
  at exec time to catch any guard added since. **Every byte-for-byte assertion stays intact** (prior
  guarantees unchanged); RD-20's own `date-theme.spec` owns the byte guard for the new roles.

## Packaging (`packages/ui/src/index.ts`) — explicit named re-exports (AC-15)

```ts
// RD-20 date family: Calendar month-grid + DatePicker dropdown + the CalendarDate value type.
export { Calendar, DatePicker } from './date/index.js';
export {
  daysInMonth, dayOfWeek, addMonths, addDays, compare, toISO, parseISO, fromDate, toDate,
} from './date/index.js';
export type { CalendarDate, CalendarOptions, DatePickerOptions, DateFormat } from './date/index.js';
```

- `packages/ui/src/date/index.ts` barrel re-exports each file's public symbols.
- `yarn check:deps` passes (zero runtime deps); every `date/` file ≤ 500 lines (grid + format
  pre-split to hold the budget, PA-6).

## Kitchen-sink stories (NON-NEGOTIABLE showcase, PA-13 / AR-209)

Two stories, category **`Date`**, `rd: 'RD-20'`, one `stories/index.ts` line each; both pass
`kitchen-sink.smoke.spec.test.ts` (mount headlessly, paint, unique id, metadata).

- **`stories/calendar.story.ts`** (id `date/calendar`) — a `Calendar` with today highlighted, a bound
  `value` echoed live (e.g. `toISO(value)` in a `Label`), a disabled-day example (e.g. Sundays), and
  `showWeekNumbers: true`; keyboard + mouse both working; blurb + interaction hints.
- **`stories/date-picker.story.ts`** (id `date/date-picker`) — a one-line `DatePicker` field opening
  the calendar popup, with a live `toISO(value)` echo; `format` shown.

## Headless demo — `demo:date` (AR-209)

- `packages/examples/date-demo/main.ts` — a dispatch-driven walkthrough, **an ASCII frame per step**:
  render → arrow day-nav (cursor moves) → PgDn (next month) → pick a day (Enter/click, `value` set) →
  open the picker popup → commit — matching `demo:tabs`/`demo:feedback`.
- `"demo:date"` script in `packages/examples/package.json`;
  `packages/examples/test/date-demo.e2e.test.ts` runs it headless (tsx child) and asserts the frames.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| New roles trip a prior RD's closed-set guard | Extend the allowlist; keep every byte assertion (PA-14) | PA-14 |
| A `date/` file would exceed 500 lines | Grid + format pre-split (PA-6) | AR-208 |

> **Traceability:** every choice references the register. See `00-ambiguity-register.md`.

## Testing Requirements
- Spec (ST-14 theme, ST-15 packaging): 6 roles exist + `encode()` non-throw + no existing role changed;
  re-exports present, `check:deps` clean, files ≤ 500.
- Smoke: both stories mount + paint + unique id + metadata (ST-16); `demo:date` e2e (ST-16).
