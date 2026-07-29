---
title: Date picker
description: DatePicker — a one-line masked date field with a dropdown Calendar; the field and calendar share a two-way CalendarDate value.
---

# Date picker

`DatePicker` is a one-line date field: a masked text [`Input`](/components/controls/input) plus a
trailing `▐↓▌` dropdown button that opens a [`Calendar`](/components/date/calendar) in a popup anchored
to the field. The field text follows the chosen `format` (default ISO `YYYY-MM-DD`); a complete valid
edit updates the selection, while an incomplete or invalid edit leaves it unchanged. The field and
calendar share the picker's `value` and stay in sync.

## Usage

```ts
import { DatePicker, signal } from '@jsvision/ui';
import type { CalendarDate } from '@jsvision/ui';

const value = signal<CalendarDate | null>(null);
const picker = new DatePicker({ value, format: 'DD/MM/YYYY', min: { year: 2020, month: 1, day: 1 } });
picker.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 1 } });
// Type into the field, or press Down / Alt+Down / click the ▐↓▌ button to open the calendar.
```

## Live example

<PlayExample id="date/date-picker"
  title="Date Picker Lab"
  blurb="Edit a masked civil date or choose it from a bounded, deterministic popup calendar."
/>

## Props

`new DatePicker(options)`.

The public surface is `DatePicker`, `DatePickerOptions`, the `DateFormat` union, and the hosted
`Calendar`.

| Prop              | Type                                           | Default         | Description                                            |
| ----------------- | ---------------------------------------------- | --------------- | ------------------------------------------------------ |
| `value`           | `Signal<CalendarDate \| null>`                 | —               | Two-way selected day (`null` = none).                  |
| `i18n`            | `I18n`                                         | English UI      | Localizes the hosted calendar and week start.          |
| `format`          | `'YYYY-MM-DD' \| 'DD/MM/YYYY' \| 'MM/DD/YYYY'` | `'YYYY-MM-DD'`  | Field mask + parse/serialize.                          |
| `today`           | `CalendarDate`                                 | system clock    | Forwarded to the dropdown `Calendar`.                  |
| `min`             | `CalendarDate`                                 | —               | Inclusive lower bound (forwarded).                     |
| `max`             | `CalendarDate`                                 | —               | Inclusive upper bound (forwarded).                     |
| `isDisabled`      | `(d: CalendarDate) => boolean`                 | —               | Disabled-day predicate (forwarded).                    |
| `firstDayOfWeek`  | `0 \| 1`                                       | locale-derived  | Explicit override; English without `i18n` uses Sunday. |
| `showWeekNumbers` | `boolean`                                      | `false`         | ISO week numbers in the dropdown (forwarded).          |
| `density`         | `'compact' \| 'comfortable' \| 'spacious'`     | `'comfortable'` | Hosted calendar geometry and popup size.               |
| `placeholder`     | `string \| Signal<string>`                     | —               | Muted hint while the masked field is empty.            |

## Masked field and value

| Input                      | Result                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| Type in the field          | Masked entry per `format`; a complete valid date updates `value`. |
| **Down / Alt+Down**        | Open the dropdown calendar.                                       |
| **Click** the `▐↓▌` button | Open the dropdown calendar.                                       |
| Pick a day in the calendar | Fill the field and close the popup.                               |

With no overlay host available (headless), opening is a no-op.

## Popup calendar

The popup receives the same value signal, bounds, disabled-date predicate, week start, week-number
flag, density, and deterministic `today` as the field. Selecting a day therefore serializes it into
the active `DateFormat` and closes the popup without a second synchronization layer. Escaping or
dismissing the popup leaves the current value intact.

## Sizing & layout

One row: the masked input plus a trailing 3-cell dropdown button. Give it enough width for the format
(`DD/MM/YYYY` is 10 cells + the button).

## Best practices

- **`format` drives both ends.** It sets the field mask _and_ the parse/serialize, so switching it
  changes the accepted text and the displayed value together — no extra wiring.
- **Bounds forward for free.** `min`/`max`/`isDisabled`/`firstDayOfWeek` pass straight through to the
  dropdown `Calendar`, so the field and popup agree on what's selectable.
- **Trust the edit gate.** A half-typed or invalid field doesn't clobber the selection — only a
  complete valid date commits.

## Theming

The field uses `inputNormal` and `inputSelected`; the popup uses `calendarNormal`,
`calendarSelected`, and the other `calendar*` roles. The `▐↓▌` button draws the shared dropdown
icon with `historyButtonSides` and `historyButtonArrow`.

## Related

- [Calendar](/components/date/calendar) — the month grid opened by the dropdown.
- [Input](/components/controls/input) — the masked field the picker is built on.
- [API reference](/api/ui/classes/DatePicker) — the generated `DatePicker` signature.
