---
title: Calendar
description: Calendar — a focusable month-grid day picker with a day cursor, min/max bounds, three densities, and a two-way CalendarDate value.
---

# Calendar

`Calendar` is a focusable month-grid view for selecting a day. It shows one month at a time — a
header, a weekday row, and a 6×7 day grid — and lets the user move a day cursor and commit a day.
Selection is a two-way `Signal<CalendarDate | null>` (`null` = nothing selected), where a
`CalendarDate` is a plain `{ year, month, day }` civil date (helpers: `daysInMonth`, `dayOfWeek`,
`addMonths`, `addDays`, `compare`, `toISO`, `parseISO`, `fromDate`, `toDate`).

## Usage

```ts
import { Calendar, signal } from '@jsvision/ui';
import type { CalendarDate } from '@jsvision/ui';

const value = signal<CalendarDate | null>({ year: 2026, month: 9, day: 14 });
const cal = new Calendar({
  value,
  today: { year: 2026, month: 7, day: 10 }, // pass it for deterministic tests
  density: 'comfortable',
  onChange: (d) => console.log('picked', d),
});
cal.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 28, height: 10 } };
// Arrows move the cursor; Enter/Space commit; T jumps to today.
```

## Live example

<PlayComingSoon title="Calendar" />

## Props

`new Calendar(options)`.

| Prop              | Type                                       | Default         | Description                                                     |
| ----------------- | ------------------------------------------ | --------------- | --------------------------------------------------------------- |
| `value`           | `Signal<CalendarDate \| null>`             | —               | Two-way selected day (`null` = none).                           |
| `today`           | `CalendarDate`                             | system clock    | The day highlighted as "today"; pass it for reproducible tests. |
| `min`             | `CalendarDate`                             | —               | Inclusive lower bound — the cursor never leaves `[min, max]`.   |
| `max`             | `CalendarDate`                             | —               | Inclusive upper bound.                                          |
| `isDisabled`      | `(date: CalendarDate) => boolean`          | —               | Dims a day: navigable but not committable.                      |
| `firstDayOfWeek`  | `0 \| 1`                                   | `0` (Sunday)    | `1` = Monday (ISO).                                             |
| `showWeekNumbers` | `boolean`                                  | `false`         | Leading ISO week-number column (adds 3 columns).                |
| `density`         | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | Trades screen space for roominess (see Sizing).                 |
| `onChange`        | `(date: CalendarDate) => void`             | —               | Fired when `value` changes.                                     |

## Keyboard & mouse

| Input                   | Result                                                    |
| ----------------------- | --------------------------------------------------------- |
| **← / → / ↑ / ↓**       | Move the cursor one day / one week.                       |
| **PgUp / PgDn**         | Change the month.                                         |
| **Ctrl+PgUp / PgDn**    | Change the year.                                          |
| **Home / End**          | Jump to the start / end of the cursor's week.             |
| **+ / −**               | Page the visible month without moving the cursor.         |
| **T**                   | Jump to today.                                            |
| **Enter / Space**       | Commit the cursor's day.                                  |
| **Click** a day         | Move the cursor there and commit it.                      |
| Header **↑↓** arrows    | Change the visible month (left pair) / year (right pair). |
| Footer **Today** button | Jump to and select today (comfortable / spacious).        |

## Sizing & layout

Density sets the footprint: `'compact'` ≈ 20×8 (tightest), `'comfortable'` ≈ 28×10 (4-wide cells + a
`Today` footer, the default), `'spacious'` ≈ 35×15 (5-wide cells + blank week spacers). Use the
widget's `measure()` to size it to the chosen density; enabling `showWeekNumbers` adds 3 columns.

## Best practices

- **Pass `today` in tests.** It defaults to the system clock at construction — supply it explicitly so
  golden output stays stable.
- **Bound with `min`/`max`.** They clamp both the cursor and the visible month, so the user can't
  navigate out of the allowed range.
- **Disable, don't remove.** An `isDisabled` day stays visible and navigable but can't be committed —
  clearer than hiding it.

## Theming

| Role                 | Applies to                                      |
| -------------------- | ----------------------------------------------- |
| `calendarNormal`     | A normal day: yellow on cyan                    |
| `calendarToday`      | The "today" day: blue on green                  |
| `calendarSelected`   | The selected day: filled blue                   |
| `calendarCursor`     | The focused cursor cell: reverse black-on-white |
| `calendarDisabled`   | A dimmed, non-committable day                   |
| `calendarWeekNumber` | The ISO week-number column                      |

## Related

- [Date picker](/components/date/date-picker) — a one-line field that opens a Calendar in a popup.
- [API reference](/api/ui/classes/Calendar) — the generated `Calendar` signature.
