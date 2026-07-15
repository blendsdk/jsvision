<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Date & color pickers

Calendars, date pickers, color swatches, and color pickers.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## addDays

Add `n` days (may be negative); rolls across month and year boundaries.

```ts
addDays(date: CalendarDate, n: number): CalendarDate
```

## addMonths

Add `n` months (may be negative); the day is **clamped** to the target month's length, so the result is always a valid date.

```ts
addMonths(date: CalendarDate, n: number): CalendarDate
```

## Calendar

A focusable month-grid day picker.

```ts
new Calendar(opts: CalendarOptions)   // extends View
// methods & signals:
value: Signal<CalendarDate | null>
select(date: CalendarDate): void
today(): void
goToMonth(year: number, month: number): void
```

## CalendarDate

A civil (wall-clock) date — no time-of-day, no timezone.

```ts
interface CalendarDate {
  year: number;
  month: number;   // 1-based month: 1 = January … 12 = December.
  day: number;   // Day of the month, 1-31.
}
```

## CalendarDensity

How much room the month grid gets.

```ts
type CalendarDensity = 'compact' | 'comfortable' | 'spacious'
```

## CalendarOptions

Options for a Calendar.

```ts
interface CalendarOptions {
  value: Signal<CalendarDate | null>;   // Two-way selected day (`null` = no selection).
  today?: CalendarDate;   // The day to highlight as "today" (default: the system clock at construction; pass it for tests).
  min?: CalendarDate;   // Inclusive navigation lower bound (the cursor never leaves `[min,max]`).
  max?: CalendarDate;   // Inclusive navigation upper bound.
  isDisabled?: (date: CalendarDate) => boolean;   // Predicate that dims a day: it stays navigable but cannot be committed.
  firstDayOfWeek?: 0 | 1;   // 0 = Sunday (default) | 1 = Monday (ISO).
  showWeekNumbers?: boolean;   // Opt-in leading ISO week-number column (default false; adds 3 columns).
  density?: CalendarDensity;   // Layout density (default `'comfortable'`): `'compact'` is tightest (~20×8), `'comfortable'` is the roomy default (4-wide cells + a `Today` footer, ~28×10), `'spacious'` adds breathing room (5-wide cells + blank week spacers, ~35×15).
  onChange?: (date: CalendarDate) => void;   // Fired when `value` changes.
}
```

## ColorPicker

A one-line color picker: a color chip that opens a swatch (plus an optional hex field) in a dropdown anchored to the field.

```ts
new ColorPicker(opts: ColorPickerOptions)   // extends Group
// methods & signals:
value: Signal<Color>
```

## ColorPickerOptions

Options for a ColorPicker.

```ts
interface ColorPickerOptions {
  value: Signal<Color>;   // Two-way selected color (shared with the hosted swatch + hex field).
  colors?: readonly Color[];   // Palette forwarded to the `ColorSwatch` (default ANSI16_ORDER).
  columns?: number;   // Columns forwarded to the `ColorSwatch` (default 4).
  allowCustom?: boolean;   // Include a hex `Input` in the popup for arbitrary `#rrggbb` truecolor (default true).
  label?: string;   // Optional chip caption prefix (used when `nameFor` is absent).
  nameFor?: (c: Color) => string;   // Optional name accessor for the chip caption.
  onInput?: (c: Color) => void;   // Fired on every live value change in the popup (arrow / click / drag).
  onChange?: (c: Color) => void;   // Fired on the discrete commit gesture (Enter / Space / mouse-up), which also closes the popup.
}
```

## ColorSwatch

A focusable grid of color cells.

```ts
new ColorSwatch(opts: ColorSwatchOptions)   // extends View
// methods & signals:
value: Signal<Color>
nameFor?: (c: Color) => string
select(color: Color): void
```

## ColorSwatchOptions

Options for a ColorSwatch.

```ts
interface ColorSwatchOptions {
  value: Signal<Color>;   // Two-way selected color.
  colors?: readonly Color[];   // Palette to display (default ANSI16_ORDER, the DOS-16 colors).
  columns?: number;   // Columns per row (default 4).
  onInput?: (c: Color) => void;   // Fired on every live value change (arrow / click / drag).
  onChange?: (c: Color) => void;   // Fired on the discrete commit gesture — Enter, Space, or a mouse-up over a cell.
  nameFor?: (c: Color) => string;   // Pure color-name accessor — used by a hosting `ColorPicker` to caption its chip.
}
```

## compare

Order two dates: -1 if a<b, 0 if equal, +1 if a>b (compared by year, then month, then day).

```ts
compare(a: CalendarDate, b: CalendarDate): -1 | 0 | 1
```

## DateFormat

The supported field formats (digit reorder only; default ISO).

```ts
type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY'
```

## DatePicker

A one-line date picker: a masked text field that opens a `Calendar` in a dropdown anchored to the field.

```ts
new DatePicker(opts: DatePickerOptions)   // extends Group
// methods & signals:
value: Signal<CalendarDate | null>
input: Input
```

## DatePickerOptions

Options for a DatePicker.

```ts
interface DatePickerOptions {
  value: Signal<CalendarDate | null>;   // Two-way selected day (`null` = none).
  format?: DateFormat;   // Field format (default ISO `YYYY-MM-DD`).
  today?: CalendarDate;   // The "today" day, forwarded to the dropdown `Calendar`.
  min?: CalendarDate;   // Inclusive lower bound, forwarded to the dropdown `Calendar`.
  max?: CalendarDate;   // Inclusive upper bound, forwarded to the dropdown `Calendar`.
  isDisabled?: (d: CalendarDate) => boolean;   // Disabled-day predicate, forwarded to the dropdown `Calendar`.
  firstDayOfWeek?: 0 | 1;   // First day of the week (0 = Sunday, 1 = Monday), forwarded to the dropdown `Calendar`.
  showWeekNumbers?: boolean;   // Show ISO week numbers in the dropdown `Calendar`.
  density?: CalendarDensity;   // Density of the dropdown `Calendar` (default `'comfortable'`; the popup sizes to it).
}
```

## dayOfWeek

Day of week for a civil date, 0 = Sunday … 6 = Saturday.

```ts
dayOfWeek(date: CalendarDate): number
```

## daysInMonth

Days in a month, Gregorian leap-year-correct.

```ts
daysInMonth(year: number, month: number): number
```

## fromDate

Read a JS `Date`'s local-time fields into a civil date.

```ts
fromDate(d: Date): CalendarDate
```

## parseISO

Parse `"YYYY-MM-DD"` into a range-validated `CalendarDate`, or `null` on any malformed or out-of-range input (wrong shape, month outside 1-12, or day outside the month's length).

```ts
parseISO(str: string): CalendarDate | null
```

## toDate

Materialize a JS `Date` at local midnight.

```ts
toDate(cd: CalendarDate): Date
```

## toISO

Serialize to `"YYYY-MM-DD"` (zero-padded).

```ts
toISO(date: CalendarDate): string
```
