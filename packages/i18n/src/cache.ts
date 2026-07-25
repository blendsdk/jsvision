import { I18nError } from './errors.js';

const CACHE_LIMIT = 64;
const PluralRulesConstructor = Intl.PluralRules;
const NumberFormatConstructor = Intl.NumberFormat;
const DateTimeFormatConstructor = Intl.DateTimeFormat;
const CollatorConstructor = Intl.Collator;

const NUMBER_OPTION_KEYS = new Set<PropertyKey>([
  'compactDisplay',
  'currency',
  'currencyDisplay',
  'currencySign',
  'localeMatcher',
  'maximumFractionDigits',
  'maximumSignificantDigits',
  'minimumFractionDigits',
  'minimumIntegerDigits',
  'minimumSignificantDigits',
  'notation',
  'numberingSystem',
  'roundingIncrement',
  'roundingMode',
  'roundingPriority',
  'signDisplay',
  'style',
  'trailingZeroDisplay',
  'unit',
  'unitDisplay',
  'useGrouping',
]);

const DATE_OPTION_KEYS = new Set<PropertyKey>([
  'calendar',
  'dateStyle',
  'day',
  'dayPeriod',
  'era',
  'formatMatcher',
  'fractionalSecondDigits',
  'hour',
  'hour12',
  'hourCycle',
  'localeMatcher',
  'minute',
  'month',
  'numberingSystem',
  'second',
  'timeStyle',
  'timeZone',
  'timeZoneName',
  'weekday',
  'year',
]);

const COLLATOR_OPTION_KEYS = new Set<PropertyKey>([
  'caseFirst',
  'collation',
  'ignorePunctuation',
  'localeMatcher',
  'numeric',
  'sensitivity',
  'usage',
]);

type FormatterOptionValue = string | number | boolean;
type CopiedFormatterOptions = Readonly<Record<string, FormatterOptionValue>>;

/** A small least-recently-used cache with deterministic eviction. */
class LruCache<Value> {
  /** Values in least-to-most-recent order. */
  protected readonly entries = new Map<string, Value>();

  /**
   * Resolve a cached value or create and retain it.
   *
   * @param key Stable formatter identity.
   * @param create Constructor invoked only after a cache miss.
   * @returns Existing or newly created value.
   */
  get(key: string, create: () => Value): Value {
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing;
    }

    const value = create();
    this.entries.set(key, value);
    if (this.entries.size > CACHE_LIMIT) {
      const oldest = this.entries.keys().next().value;
      if (typeof oldest === 'string') this.entries.delete(oldest);
    }
    return value;
  }
}

/** Throw one stable programmer error without exposing an invalid option value. */
function invalidOptions(cause?: unknown): I18nError {
  return new I18nError(
    'INVALID_FORMATTER_OPTIONS',
    'Formatter options contain an unsupported key or value.',
    cause === undefined ? undefined : { cause },
  );
}

/** Copy allowlisted own primitive options without invoking accessors or coercion hooks. */
function copyOptions(input: unknown, allowed: ReadonlySet<PropertyKey>): CopiedFormatterOptions {
  if (input === undefined) return Object.freeze({});
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw invalidOptions();
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch (cause) {
    throw invalidOptions(cause);
  }

  const copied: Record<string, FormatterOptionValue> = {};
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) throw invalidOptions();

    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch (cause) {
      throw invalidOptions(cause);
    }
    if (descriptor === undefined || !('value' in descriptor)) throw invalidOptions();
    const value = descriptor.value;
    if (value === undefined) continue;
    if (
      (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw invalidOptions();
    }
    Object.defineProperty(copied, key, {
      configurable: false,
      enumerable: true,
      value,
      writable: false,
    });
  }
  return Object.freeze(copied);
}

/** Serialize copied options in lexical key order without calling user code. */
function formatterKey(locale: string, options: CopiedFormatterOptions): string {
  const entries = Object.keys(options)
    .sort()
    .map((key) => [key, options[key]] as const);
  return JSON.stringify([locale, entries]);
}

/** Construct one formatter and translate native option failures to the stable error boundary. */
function construct<Value>(create: () => Value): Value {
  try {
    return create();
  } catch (cause) {
    throw invalidOptions(cause);
  }
}

/**
 * Service-owned bounded caches for every supported `Intl` formatter family.
 *
 * Option objects are copied before keying and are never retained. Each family evicts independently
 * after 64 identities, preventing one formatter type from displacing another.
 *
 * @example
 * ```ts
 * const cache = new FormatterCache();
 * cache.numberFormat('nl-NL', { maximumFractionDigits: 2 }).format(12.5);
 * ```
 */
export class FormatterCache {
  /** Cardinal plural rules keyed by canonical locale. */
  protected readonly plurals = new LruCache<Intl.PluralRules>();

  /** Number formatters keyed by locale and copied options. */
  protected readonly numbers = new LruCache<Intl.NumberFormat>();

  /** Date formatters keyed by locale and copied options. */
  protected readonly dates = new LruCache<Intl.DateTimeFormat>();

  /** Collators keyed by locale and copied options. */
  protected readonly collators = new LruCache<Intl.Collator>();

  /**
   * Resolve cached cardinal plural rules.
   *
   * @param locale Canonical message locale.
   * @returns Locale-bound cardinal rules.
   */
  pluralRules(locale: string): Intl.PluralRules {
    return this.plurals.get(locale, () => construct(() => new PluralRulesConstructor(locale, { type: 'cardinal' })));
  }

  /**
   * Resolve a cached number formatter.
   *
   * @param locale Canonical formatting locale.
   * @param options Untrusted public options copied through an allowlist.
   * @returns Locale-bound number formatter.
   */
  numberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
    const copied = copyOptions(options, NUMBER_OPTION_KEYS);
    if (
      copied.style === 'currency' &&
      (typeof copied.currency !== 'string' || !/^[A-Za-z]{3}$/u.test(copied.currency))
    ) {
      throw invalidOptions();
    }
    const key = formatterKey(locale, copied);
    return this.numbers.get(key, () => construct(() => new NumberFormatConstructor(locale, copied)));
  }

  /**
   * Resolve a cached date/time formatter.
   *
   * @param locale Canonical formatting locale.
   * @param options Untrusted public options copied through an allowlist.
   * @returns Locale-bound date/time formatter.
   */
  dateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const copied = copyOptions(options, DATE_OPTION_KEYS);
    const key = formatterKey(locale, copied);
    return this.dates.get(key, () => construct(() => new DateTimeFormatConstructor(locale, copied)));
  }

  /**
   * Resolve a cached locale collator.
   *
   * @param locale Canonical comparison locale.
   * @param options Untrusted public options copied through an allowlist.
   * @returns Locale-bound collator.
   */
  collator(locale: string, options?: Intl.CollatorOptions): Intl.Collator {
    const copied = copyOptions(options, COLLATOR_OPTION_KEYS);
    const key = formatterKey(locale, copied);
    return this.collators.get(key, () => construct(() => new CollatorConstructor(locale, copied)));
  }
}
