/**
 * `fmt` — a registry of locale-aware column formatters for `@jsvision/datagrid`, each built on the
 * platform `Intl` APIs. A factory is called **once** per column (creating its `Intl.*` instance) and
 * returns a `format` function the caller spreads into a `column({...})`. The three numeric kinds
 * (`number`/`currency`/`percent`) also ship a matched inverse `parse`, so an editable numeric column
 * round-trips text → value; the temporal, boolean, and label kinds are display-only (edited through the
 * typed cell editors).
 *
 * `Intl` ships no parser, so each inverse is built from `Intl.NumberFormat(locale).formatToParts(...)`
 * to discover the locale's group/decimal/minus symbols (never hard-coded to `.`/`,`) — which is why a
 * `nl-NL` amount whose group separator is `.` parses back correctly. A non-parseable string is a
 * validation failure: `parse` returns the {@link PARSE_FAILED} sentinel, never a silent `NaN`.
 */
import type { CalendarDate } from '@jsvision/ui';
import { toDate } from '@jsvision/ui';
import type { LookupItem } from './cell-editor.js';

/**
 * The sentinel an inverse `parse` returns for a string it cannot convert — distinct from a valid value
 * and from `NaN`, so the commit path can reject an unparseable edit instead of writing garbage.
 *
 * @example
 * ```ts
 * import { fmt, PARSE_FAILED } from '@jsvision/datagrid';
 * const money = fmt.currency({ locale: 'en-US', currency: 'USD' });
 * const v = money.parse('not a number');
 * if (v === PARSE_FAILED) { /* keep the editor open, write nothing *\/ }
 * ```
 */
export const PARSE_FAILED: unique symbol = Symbol('parse-failed');

/** The type of the {@link PARSE_FAILED} sentinel — used to widen a column's `parse` return type. */
export type ParseFailed = typeof PARSE_FAILED;

/** Shared options for the numeric formatters: BCP-47 locale plus fraction-digit control. */
export interface NumberFormatOptions {
  /** BCP-47 locale tag; defaults to the host default locale. */
  readonly locale?: string;
  /** Minimum fraction digits (forwarded to `Intl.NumberFormat`). */
  readonly minimumFractionDigits?: number;
  /** Maximum fraction digits (forwarded to `Intl.NumberFormat`). */
  readonly maximumFractionDigits?: number;
}

/** Currency options — `currency` (an ISO 4217 code) is required; a bare number is never styled implicitly. */
export interface CurrencyFormatOptions extends NumberFormatOptions {
  /** ISO 4217 currency code, e.g. `'EUR'` or `'USD'`. */
  readonly currency: string;
}

/** A formatter that also round-trips: the display string AND its matched inverse. */
export interface InvertibleFormat<V> {
  /** Formats a value for display. */
  readonly format: (value: V, row: unknown) => string;
  /** Inverse of `format`; returns {@link PARSE_FAILED} for a non-parseable string (never `NaN`). */
  readonly parse: (text: string) => V | ParseFailed;
}

/** A display-only formatter (date/datetime/boolean/enum/lookup) — no inverse. */
export interface DisplayFormat<V> {
  /** Formats a value for display. */
  readonly format: (value: V, row: unknown) => string;
}

/**
 * Build the inverse parser for an `Intl.NumberFormat`. Discovers the locale's group, decimal, and
 * minus symbols from `formatToParts` of a representative negative, thousands-scale value, then strips
 * the decoration to a bare ASCII number. `scale` is `100` for percent (whose display is 100× the value)
 * and `1` otherwise.
 */
function numberParser(nf: Intl.NumberFormat, scale: number): (text: string) => number | typeof PARSE_FAILED {
  let group = '';
  let decimal = '.';
  let minus = '-';
  for (const part of nf.formatToParts(-11111.1)) {
    if (part.type === 'group') group = part.value;
    else if (part.type === 'decimal') decimal = part.value;
    else if (part.type === 'minusSign') minus = part.value;
  }
  return (text) => {
    let s = text;
    if (minus !== '-') s = s.split(minus).join('-'); // locale minus → ASCII '-'
    if (group !== '') s = s.split(group).join(''); // drop group separators
    if (decimal !== '.') s = s.split(decimal).join('.'); // locale decimal → '.'
    // Strip whatever remains (currency symbol, percent sign, letters, and any Unicode space such as the
    // U+00A0 that `Intl` inserts before a currency amount) so only a bare ASCII number is left.
    s = s.replace(/[^0-9.-]/g, '');
    if (s === '' || s === '-' || s === '.' || s === '-.') return PARSE_FAILED;
    const n = Number(s);
    if (Number.isNaN(n)) return PARSE_FAILED;
    return n / scale;
  };
}

/** The date-display style options (mapped to `Intl.DateTimeFormat`'s `dateStyle`). */
type DateOnlyStyle = 'short' | 'medium' | 'long';

/**
 * The column-formatter registry. Spread a factory's result into a `column({...})`: `format` supplies
 * the display string, and (for `number`/`currency`/`percent`) `parse` supplies the edit round-trip.
 *
 * @example
 * ```ts
 * import { column, fmt } from '@jsvision/datagrid';
 * interface Account { balance: number; }
 * const balance = column<Account, number>({
 *   id: 'balance', title: 'Balance', align: 'right',
 *   value: (r) => r.balance,
 *   ...fmt.currency({ locale: 'nl-NL', currency: 'EUR' }), // "€ 10.000,25" + a matched inverse parse
 *   set: (r, v) => { r.balance = v; },
 * });
 * ```
 */
export const fmt = {
  /** Locale number formatter + inverse. `parse` strips the locale group/decimal symbols by discovery. */
  number: (o?: NumberFormatOptions): InvertibleFormat<number> => {
    const nf = new Intl.NumberFormat(o?.locale, {
      minimumFractionDigits: o?.minimumFractionDigits,
      maximumFractionDigits: o?.maximumFractionDigits,
    });
    return { format: (v) => nf.format(v), parse: numberParser(nf, 1) };
  },
  /** Locale currency (e.g. `nl-NL` EUR → `"€ 10.000,25"`) + inverse (also strips the currency symbol). */
  currency: (o: CurrencyFormatOptions): InvertibleFormat<number> => {
    const nf = new Intl.NumberFormat(o.locale, {
      style: 'currency',
      currency: o.currency,
      minimumFractionDigits: o.minimumFractionDigits,
      maximumFractionDigits: o.maximumFractionDigits,
    });
    return { format: (v) => nf.format(v), parse: numberParser(nf, 1) };
  },
  /** Locale percent (value `0.25` → `"25%"`) + inverse (strips the percent sign, divides by 100). */
  percent: (o?: NumberFormatOptions): InvertibleFormat<number> => {
    const nf = new Intl.NumberFormat(o?.locale, {
      style: 'percent',
      minimumFractionDigits: o?.minimumFractionDigits,
      maximumFractionDigits: o?.maximumFractionDigits,
    });
    return { format: (v) => nf.format(v), parse: numberParser(nf, 100) };
  },
  /** Locale civil-date display for a `CalendarDate`. Display-only (edit via the date-picker editor). */
  date: (o?: { locale?: string; style?: DateOnlyStyle }): DisplayFormat<CalendarDate> => {
    const df = new Intl.DateTimeFormat(o?.locale, { dateStyle: o?.style ?? 'medium' });
    return { format: (v) => df.format(toDate(v)) };
  },
  /** Locale date+time display for a JS `Date`. Display-only. */
  datetime: (o?: {
    locale?: string;
    dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
    timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  }): DisplayFormat<Date> => {
    const df = new Intl.DateTimeFormat(o?.locale, {
      dateStyle: o?.dateStyle ?? 'medium',
      timeStyle: o?.timeStyle ?? 'short',
    });
    return { format: (v) => df.format(v) };
  },
  /** Boolean → label; default `{ true: 'Yes', false: 'No' }`. Display-only. */
  boolean: (labels?: { true: string; false: string }): DisplayFormat<boolean> => {
    const t = labels?.true ?? 'Yes';
    const f = labels?.false ?? 'No';
    return { format: (v) => (v ? t : f) };
  },
  /** value → label via a record map. An unknown key falls back to `String(value)`. Display-only. */
  enumLabel: (labels: Record<string, string>): DisplayFormat<string> => {
    const map = new Map(Object.entries(labels));
    return { format: (v) => map.get(v) ?? String(v) };
  },
  /** key → label via a lookup-item list. An unknown key falls back to `String(value)`. Display-only. */
  lookupLabel: (items: readonly LookupItem[]): DisplayFormat<string> => {
    const map = new Map(items.map((it) => [it.key, it.label] as const));
    return { format: (v) => map.get(v) ?? String(v) };
  },
};
