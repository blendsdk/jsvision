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
picker.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 1 } };
// Type into the field, or press Down / Alt+Down / click the ▐↓▌ button to open the calendar.
```

## Live example

<PlayComingSoon title="Date picker" />

## Props

`new DatePicker(options)`.

| Prop              | Type                                           | Default        | Description                                   |
| ----------------- | ---------------------------------------------- | -------------- | --------------------------------------------- |
| `value`           | `Signal<CalendarDate \| null>`                 | —              | Two-way selected day (`null` = none).         |
| `format`          | `'YYYY-MM-DD' \| 'DD/MM/YYYY' \| 'MM/DD/YYYY'` | `'YYYY-MM-DD'` | Field mask + parse/serialize.                 |
| `today`           | `CalendarDate`                                 | system clock   | Forwarded to the dropdown `Calendar`.         |
| `min`             | `CalendarDate`                                 | —              | Inclusive lower bound (forwarded).            |
| `max`             | `CalendarDate`                                 | —              | Inclusive upper bound (forwarded).            |
| `isDisabled`      | `(d: CalendarDate) => boolean`                 | —              | Disabled-day predicate (forwarded).           |
| `firstDayOfWeek`  | `0 \| 1`                                       | `0`            | First day of the week (forwarded).            |
| `showWeekNumbers` | `boolean`                                      | `false`        | ISO week numbers in the dropdown (forwarded). |

## Keyboard & mouse

| Input                      | Result                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| Type in the field          | Masked entry per `format`; a complete valid date updates `value`. |
| **Down / Alt+Down**        | Open the dropdown calendar.                                       |
| **Click** the `▐↓▌` button | Open the dropdown calendar.                                       |
| Pick a day in the calendar | Fill the field and close the popup.                               |

With no overlay host available (headless), opening is a no-op.

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

`DatePicker` uses the input roles for the field and the `calendar*` roles for the dropdown; the `▐↓▌`
button draws the shared dropdown icon.

## Related

- [Calendar](/components/date/calendar) — the month grid opened by the dropdown.
- [Input](/components/controls/input) — the masked field the picker is built on.
- [API reference](/api/ui/classes/DatePicker) — the generated `DatePicker` signature.
