# Date family (`Calendar` + `DatePicker`) Implementation Plan

> **Feature**: A `Calendar` month-grid view + a `DatePicker` dropdown + a `CalendarDate` value type for `@jsvision/ui`
> **Status**: Planning Complete
> **Created**: 2026-07-04
> **Implements**: jsvision-ui/RD-20
> **CodeOps Skills Version**: 3.2.0

## Overview

RD-20 adds a **date family** to `@jsvision/ui`: a **`Calendar`** month-grid view (a faithful decode
of Turbo Vision's `TCalendarView`, `examples/tvdemo/calendar.cpp`) extended with a selectable day + a
modern day-navigation cursor + bounds/disabled days + optional ISO week numbers + a configurable
first-day-of-week; a **`DatePicker`** dropdown (a masked `Input` + a `▼` button that anchors the
`Calendar` in the RD-14 popup); and a **`CalendarDate`** civil-date value type with pure, zero-dep
helpers and `Date`/ISO interop.

`Calendar`'s **drawing is a decode, not a design** (the NON-NEGOTIABLE TV-fidelity directive): the
20×8 grid geometry, the `«month» «year» ▲▼` header + hit columns, the `Su Mo Tu…` weekday row, the
`j*3` day columns, and the two decoded colours (normal `getColor(6)`→`0x3E` yellow-on-cyan, today
`getColor(7)`→`0x21` blue-on-green) all match `TCalendarView` cell-by-cell, verified at GATE-1/GATE-2.
Day **selection**, the **day-nav cursor**, **min/max**, **disabled days**, **week numbers**, and the
**picker** are documented extensions (TV had none) — they get spec oracles but no `.cpp` diff.

The one cross-RD change is **additive**: RD-14's internal `openAnchoredPopup` is generalized from
list-only to host any fixed-size `View` (so the `DatePicker` reuses it, and RD-21's `ColorPicker` is
unblocked); `History` + `ComboBox` are refactored to the generalized call with **byte-identical**
placement, and their existing tests stay green. Six additive `calendar*` theme roles land in
`@jsvision/core`. No existing public API changes.

## Document Index

| #   | Document                                              | Description                                        |
| --- | ---------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate decisions (PA-1…PA-14)         |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)                   | Feature requirements and scope (Source: RD-20)     |
| 02  | [Current State](02-current-state.md)                 | Reuse points + the anchored-popup generalization   |
| 03-01 | [CalendarDate value + helpers](03-01-calendar-date.md) | The civil-date type + pure helpers + interop     |
| 03-02 | [Calendar view](03-02-calendar.md)                 | The 20×8 grid, nav cursor, selection, bounds, week# |
| 03-03 | [DatePicker + popup generalization](03-03-date-picker.md) | Masked field + `▼` + anchored calendar popup |
| 03-04 | [Theme roles + packaging + stories](03-04-theme-packaging.md) | The 6 `calendar*` roles + demo/stories    |
| 07  | [Testing Strategy](07-testing-strategy.md)           | ST-1…ST-17 spec oracles ↔ AC-1…AC-17               |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases, sessions, and task checklist               |

## Quick Reference

### Usage Examples

```ts
import { signal } from '@jsvision/ui';
import { Calendar, DatePicker, toISO, parseISO } from '@jsvision/ui';

// A standalone calendar bound to a nullable civil date.
const picked = signal<CalendarDate | null>(null);
const cal = new Calendar({
  value: picked,
  today: { year: 2026, month: 9, day: 3 },
  min: { year: 2026, month: 1, day: 1 },
  isDisabled: (d) => dayOfWeek(d) === 0, // Sundays disabled
  firstDayOfWeek: 1,                     // Monday
  showWeekNumbers: true,
  onChange: (d) => console.log(toISO(d)),
});

// A one-line picker field opening the same grid on demand.
const dp = new DatePicker({ value: picked, format: 'DD/MM/YYYY' });
```

### Key Decisions

| Decision                                   | Outcome                                                                | AR Ref |
| ------------------------------------------ | --------------------------------------------------------------------- | ------ |
| Focus-cursor visual model                  | Dedicated `calendarCursor` role (buffer-testable, focused-only)       | PA-1   |
| Extension theme-role bytes                 | Blue-bg selection: selected `0x1F` / disabled `0x38` / week# `0x30`   | PA-2   |
| TV-decoded roles (GATE-1)                  | normal `0x3E` yellow-on-cyan · today `0x21` blue-on-green             | PA-3   |
| Role precedence                            | focused: cursor>selected>today>disabled>normal; else drop cursor      | PA-4   |
| Anchored-popup generalization              | `buildContent()`+`contentSize`+`commit()`; History/ComboBox byte-identical | PA-5 |
| `src/date/` file split                     | date + grid + calendar + format + picker + barrel (6 files, ≤500)     | PA-6   |
| Field format model                         | 3 digit-reorder masks over `picture`; localized → DEF-30              | PA-11  |
| Kitchen-sink ids / demo                    | `date/calendar` + `date/date-picker`; `demo:date`                    | PA-13  |

## Related Files

**New** — `packages/ui/src/date/`: `calendar-date.ts`, `calendar-grid.ts`, `calendar.ts`,
`date-format.ts`, `date-picker.ts`, `index.ts`.
**Modified (additive)** — `packages/core/src/engine/color/theme.ts` (6 `calendar*` roles),
`packages/ui/src/dropdown/popup.ts` (generalize `openAnchoredPopup`, PA-5),
`packages/ui/src/dropdown/history.ts` + `combo-box.ts` (call the generalized primitive),
`packages/ui/src/index.ts` (explicit re-exports).
**New examples** — `packages/examples/kitchen-sink/stories/{calendar,date-picker}.story.ts`,
`packages/examples/date-demo/`, `packages/examples/test/date-demo.e2e.test.ts`.
