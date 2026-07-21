# Formatter Registry (`fmt`): Formatting & Cell Rendering

> **Document**: 03-01-formatter-registry.md
> **Parent**: [Index](00-index.md)

## Overview

A pure, `Intl`-based registry of column formatters. Each factory is called **once** per column (creating
its `Intl.*` instance) and returns a `format` function (and, for the invertible numeric kinds, a matched
`parse`) that the caller spreads into a `column({...})`. No factory touches module state, the DOM, or the
render loop.

## Architecture

### Proposed Changes

New file `packages/datagrid/src/format.ts` exporting `const fmt` plus the option types. Nothing else in
the pipeline changes: a column's `format`/`parse` are already consumed by `toEngineColumn`
(`column.ts:120`) and the RD-02 commit path — `fmt.*` simply *produces* those functions.

## Implementation Details

### New Types/Interfaces

```ts
/** Shared options for the numeric formatters (locale + fraction-digit control). */
export interface NumberFormatOptions {
  /** BCP-47 locale; defaults to the host default locale (AR #2 / RD-04 R2). */
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/** Currency options — `currency` (ISO 4217) is required; styling is never implicit on a bare number. */
export interface CurrencyFormatOptions extends NumberFormatOptions {
  currency: string;
}

/** A formatter that also round-trips: the display string AND its matched inverse. */
export interface InvertibleFormat<V> {
  format: (value: V, row: unknown) => string;
  /** Inverse of `format`; returns the sentinel {@link PARSE_FAILED} for a non-parseable string. */
  parse: (text: string) => V | typeof PARSE_FAILED;
}

/** A display-only formatter (date/datetime/boolean/enumLabel/lookupLabel) — no inverse (AR #4). */
export interface DisplayFormat<V> {
  format: (value: V, row: unknown) => string;
}
```

> **`parse` failure signalling (AR #4 / AR #13).** A non-parseable string is a **validation failure**,
> never a silent `NaN`. `parse` returns a module sentinel `export const PARSE_FAILED = Symbol('parse-failed')`
> rather than `NaN`/`null`. `GridColumn.parse` is **widened** to `(text) => V | typeof PARSE_FAILED`
> (AR #13), so an `fmt.*` invertible spreads straight into a `column({...})`; the commit path rejects the
> sentinel at `editing.ts:263` (the editor stays open, nothing is written), which carries AC-2 within
> RD-04 and leaves richer validation to RD-12. Within this plan the round-trip tests assert
> `parse(format(v)) === v` for valid input **at values representable at the configured fraction-digits**
> (PF-004 — `format` rounds beyond its precision, so the identity holds only there) and
> `parse('abc') === PARSE_FAILED` for garbage.

### New Functions/Methods

```ts
export const fmt = {
  /** Locale number formatter + inverse. `parse` strips group separators & decimal mark by locale. */
  number:   (o?: NumberFormatOptions)  => InvertibleFormat<number>,
  /** Locale currency (e.g. nl-NL EUR → "€ 10.000,25") + inverse (also strips the currency symbol). */
  currency: (o: CurrencyFormatOptions) => InvertibleFormat<number>,
  /** Locale percent (value 0.25 → "25%") + inverse (strips the percent sign, divides by 100). */
  percent:  (o?: NumberFormatOptions)  => InvertibleFormat<number>,
  /** Locale civil-date display for a `CalendarDate`. Display-only (edit via the RD-03 DatePicker). */
  date:     (o?: { locale?: string; style?: 'short'|'medium'|'long' }) => DisplayFormat<CalendarDate>,
  /** Locale date+time display for a JS `Date` (AR #6). Display-only. */
  datetime: (o?: { locale?: string; dateStyle?: DateStyle; timeStyle?: TimeStyle }) => DisplayFormat<Date>,
  /** Boolean → label; default { true:'Yes', false:'No' } (AR #8). Display-only. */
  boolean:  (labels?: { true: string; false: string }) => DisplayFormat<boolean>,
  /** value → label via a record map (AR #7). Unknown key falls back to String(value). Display-only. */
  enumLabel:   (labels: Record<string, string>) => DisplayFormat<string>,
  /** key → label via RD-03 LookupItem[] (AR #7). Unknown key falls back to String(value). Display-only. */
  lookupLabel: (items: LookupItem[]) => DisplayFormat<string>,
};
```

**Inverse-parser algorithm (number/currency/percent).** `Intl` ships no parser, so the inverse is built
from `Intl.NumberFormat(locale).formatToParts(...)` to discover the locale's **group** and **decimal**
symbols (never hard-coded to `.`/`,`), then:

1. Strip the currency symbol / percent sign / any non-numeric decoration and whitespace.
2. Remove every group separator; replace the locale decimal mark with `.`.
3. Normalize a leading/trailing locale minus sign to ASCII `-`.
4. `Number(...)` the residue; if `Number.isNaN`, return `PARSE_FAILED`.
5. For `percent`, divide by 100 after step 4.

The round-trip `parse(format(v)) === v` is asserted per supported locale (at minimum `en-US` and
`nl-NL`, the RD-04 AC-1/AC-2 exemplar) in the spec tests.

### Integration Points

- `toEngineColumn` (`column.ts:120`) calls the column's `format`; `fmt.*().format` slots in unchanged.
- The RD-02 commit path calls the column's `parse`; with `GridColumn.parse` widened (AR #13) a numeric
  column spreads `fmt.number/currency/percent()` **directly**, and `editing.ts:263` rejects `PARSE_FAILED`.
- `fmt.lookupLabel` imports `LookupItem` from `./cell-editor.js` (RD-03) — a type-only import, no cycle.
- `CalendarDate` / `Date` are the two temporal inputs (AR #6); `fmt.date` uses `Intl.DateTimeFormat` on
  `toDate(calendarDate)` (from the ui barrel), `fmt.datetime` on the JS `Date` directly.

## Code Examples

### Example 1: currency column, round-trip

```ts
const money = fmt.currency({ locale: 'nl-NL', currency: 'EUR' });
money.format(10000.25, row);   // "€ 10.000,25"
money.parse('€ 10.000,25');    // 10000.25
money.parse('abc');            // PARSE_FAILED
```

### Example 2: enum label (display-only)

```ts
const status = fmt.enumLabel({ open: 'Open', paid: 'Paid', shipped: 'Shipped' });
status.format('paid', row);    // "Paid"
status.format('void', row);    // "void" (unknown key → String(value))
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `parse` given a non-numeric string | Return `PARSE_FAILED` sentinel (never `NaN`); the commit path rejects it at `editing.ts:263` (RD-12 layers richer validation later) | AR #4 / AR #13 |
| `enumLabel`/`lookupLabel` given an unknown key | Fall back to `String(value)` (no throw) | AR #7 |
| A formatter's output contains control bytes (e.g. from a malicious label passed to `enumLabel`) | Sanitized at the buffer-write boundary (`buffer.ts:211`) — no raw ESC reaches the frame | RD-04 AC-5 |
| `currency` factory called without `currency` | Compile error (`CurrencyFormatOptions.currency` is required) | AR #5 |

> **Traceability:** every strategy references the register entry that resolved it.

## Testing Requirements

- Unit: each factory's `format` output for representative values + locales; the three inverse parsers'
  round-trip and `PARSE_FAILED` path (see `07 §Formatter registry`, ST-1…ST-8).
- Edge: negative/zero/large numbers, `minimum/maximumFractionDigits`, `nl-NL` group/decimal symbols,
  percent scaling, unknown enum/lookup keys, `date`/`datetime` styles.
