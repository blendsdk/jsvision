/**
 * Captured native `Intl` constructors with observable allocation counters.
 *
 * Capturing protects runtime behavior from later global replacement. Internal monotonic counters
 * let performance tests observe cache misses without invoking a replaced ambient constructor.
 */

const NativePluralRules = Intl.PluralRules;
const NativeNumberFormat = Intl.NumberFormat;
const NativeDateTimeFormat = Intl.DateTimeFormat;
const NativeCollator = Intl.Collator;

/** Monotonic trusted-construction counts by formatter family. */
export interface IntlConstructionCounts {
  /** Cardinal plural-rule instances. */
  readonly pluralRules: number;
  /** Number formatter instances. */
  readonly numberFormats: number;
  /** Date/time formatter instances. */
  readonly dateTimeFormats: number;
  /** Collator instances. */
  readonly collators: number;
}

const constructionCounts = {
  pluralRules: 0,
  numberFormats: 0,
  dateTimeFormats: 0,
  collators: 0,
};

/**
 * Read trusted `Intl` construction counts.
 *
 * This internal instrumentation is intentionally absent from the package entry point.
 *
 * @returns Frozen counter snapshot.
 */
export function getIntlConstructionCounts(): IntlConstructionCounts {
  return Object.freeze({ ...constructionCounts });
}

/** Create trusted cardinal plural rules and record the allocation. */
export function createPluralRules(locale: string): Intl.PluralRules {
  const options = { type: 'cardinal' } as const;
  constructionCounts.pluralRules += 1;
  return new NativePluralRules(locale, options);
}

/** Create a trusted number formatter and record the allocation. */
export function createNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  constructionCounts.numberFormats += 1;
  return options === undefined ? new NativeNumberFormat(locale) : new NativeNumberFormat(locale, options);
}

/** Create a trusted date/time formatter and record the allocation. */
export function createDateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  constructionCounts.dateTimeFormats += 1;
  return options === undefined ? new NativeDateTimeFormat(locale) : new NativeDateTimeFormat(locale, options);
}

/** Create a trusted collator and record the allocation. */
export function createCollator(locale: string, options?: Intl.CollatorOptions): Intl.Collator {
  constructionCounts.collators += 1;
  return options === undefined ? new NativeCollator(locale) : new NativeCollator(locale, options);
}
