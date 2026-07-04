/**
 * `date-format.ts` — the pure, view-free field-format model for the RD-20 `DatePicker` (PA-11). Three
 * digit-reorder formats, each mapping to a `picture`-mask + a range-validating `parse` + a zero-padding
 * `serialize`. Localized / textual month names are deferred (DEF-30). No reactivity, no drawing.
 *
 * `parse` returns `null` on any incomplete / malformed / out-of-range input (never throws, never yields
 * an invalid `CalendarDate`) so an in-progress or bad field edit leaves the picker's value unchanged
 * (AC-11/AC-17).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { CalendarDate } from './calendar-date.js';
import { daysInMonth } from './calendar-date.js';

/** The supported field formats (digit reorder only; default ISO). */
export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

/** A resolved format: its `picture` mask + `parse`/`serialize` pair. */
export interface DateFormatSpec {
  /** The `picture(mask)` pattern gating the field (`#` = a digit). */
  readonly mask: string;
  /** Parse the field text → a range-validated `CalendarDate`, or `null` (incomplete / invalid). */
  parse(text: string): CalendarDate | null;
  /** Serialize a date → the masked field text (zero-padded, in this format's order). */
  serialize(date: CalendarDate): string;
}

/** Per-format config: the mask, a strict regex, and where each field lands in the match groups. */
interface FormatConfig {
  readonly mask: string;
  readonly re: RegExp;
  /** 1-based capture-group index of the year / month / day in `re`. */
  readonly yearGroup: number;
  readonly monthGroup: number;
  readonly dayGroup: number;
  serialize(date: CalendarDate): string;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

const CONFIGS: Record<DateFormat, FormatConfig> = {
  'YYYY-MM-DD': {
    mask: '####-##-##',
    re: /^(\d{4})-(\d{2})-(\d{2})$/,
    yearGroup: 1,
    monthGroup: 2,
    dayGroup: 3,
    serialize: (d) => `${pad(d.year, 4)}-${pad(d.month, 2)}-${pad(d.day, 2)}`,
  },
  'DD/MM/YYYY': {
    mask: '##/##/####',
    re: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    dayGroup: 1,
    monthGroup: 2,
    yearGroup: 3,
    serialize: (d) => `${pad(d.day, 2)}/${pad(d.month, 2)}/${pad(d.year, 4)}`,
  },
  'MM/DD/YYYY': {
    mask: '##/##/####',
    re: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    monthGroup: 1,
    dayGroup: 2,
    yearGroup: 3,
    serialize: (d) => `${pad(d.month, 2)}/${pad(d.day, 2)}/${pad(d.year, 4)}`,
  },
};

/**
 * Resolve a format to its `{ mask, parse, serialize }`. Defaults to ISO `YYYY-MM-DD`.
 *
 * @param format The desired field format (default `'YYYY-MM-DD'`).
 * @returns The {@link DateFormatSpec}.
 */
export function dateFormat(format: DateFormat = 'YYYY-MM-DD'): DateFormatSpec {
  const cfg = CONFIGS[format];
  return {
    mask: cfg.mask,
    serialize: cfg.serialize,
    parse(text: string): CalendarDate | null {
      const m = cfg.re.exec(text);
      if (m === null) return null;
      const year = Number(m[cfg.yearGroup]);
      const month = Number(m[cfg.monthGroup]);
      const day = Number(m[cfg.dayGroup]);
      if (month < 1 || month > 12) return null;
      if (day < 1 || day > daysInMonth(year, month)) return null;
      return { year, month, day };
    },
  };
}
