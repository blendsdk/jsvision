import { createCatalogSnapshot, replaceCatalogOverlay, type CatalogSnapshot } from './catalog.js';
import { FormatterCache } from './cache.js';
import { DiagnosticStore } from './diagnostics.js';
import { I18nError } from './errors.js';
import { MESSAGE_KEY_PATTERN } from './grammar.js';
import { copyDenseArray, inspectArray } from './input.js';
import { buildCatalogLocaleChain, canonicalizeFallbackLocales, resolveRequestedLocale } from './locale.js';
import { compileMessage, evaluateMessage, isSafeText } from './messages.js';
import type {
  CatalogInput,
  CreateI18nOptions,
  DiagnosticSink,
  I18n,
  I18nCode,
  I18nDiagnostic,
  Message,
  TranslateOptions,
} from './types.js';
import { defineCatalog } from './validation.js';

const MAX_KEY_SCALARS = 512;
const CONSTRUCTION_OPTION_KEYS = new Set<PropertyKey>(['locale', 'fallbackLocales', 'catalogs', 'diagnosticSink']);
const TRANSLATE_OPTION_KEYS = new Set<PropertyKey>(['params', 'defaultMessage']);

/** Safely read one own data property without invoking an accessor. */
function ownDataProperty(value: object, key: PropertyKey): { readonly valid: boolean; readonly value?: unknown } {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { valid: true };
    return 'value' in descriptor ? { valid: true, value: descriptor.value } : { valid: false };
  } catch {
    return { valid: false };
  }
}

/** Validate a namespaced public message key before lookup or diagnostics. */
function validateMessageKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !MESSAGE_KEY_PATTERN.test(value) ||
    [...value].length > MAX_KEY_SCALARS ||
    !isSafeText(value)
  ) {
    throw new I18nError('INVALID_KEY', 'Message key is not a valid namespaced key.');
  }
  return value;
}

/** Read one construction option and reject accessor-backed configuration. */
function constructionOption(options: object, key: PropertyKey): unknown {
  const result = ownDataProperty(options, key);
  if (!result.valid) {
    throw new I18nError('INVALID_CATALOG', 'Internationalization options must use data properties.');
  }
  return result.value;
}

/** Reject unknown, symbolic, or accessor-backed option members. */
function validateOptionKeys(options: object, allowed: ReadonlySet<PropertyKey>, code: I18nCode): void {
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(options);
  } catch (cause) {
    throw new I18nError(code, 'Options could not be inspected safely.', { cause });
  }
  for (const key of keys) {
    if (!allowed.has(key) || !ownDataProperty(options, key).valid) {
      throw new I18nError(code, 'Options contain an unsupported or accessor-backed member.');
    }
  }
}

/** Validate and copy public service construction options. */
function resolveConstructionOptions(input: CreateI18nOptions): {
  readonly locale: ReturnType<typeof resolveRequestedLocale>;
  readonly fallbackLocales: readonly string[];
  readonly catalogs: readonly unknown[];
  readonly diagnosticSink?: DiagnosticSink;
} {
  if (typeof input !== 'object' || input === null || inspectArray(input) !== false) {
    throw new I18nError('INVALID_CATALOG', 'Internationalization options must be an object.');
  }
  validateOptionKeys(input, CONSTRUCTION_OPTION_KEYS, 'INVALID_CATALOG');

  const locale = resolveRequestedLocale(constructionOption(input, 'locale'));
  const rawFallbackLocales = constructionOption(input, 'fallbackLocales');
  const fallbackValues = rawFallbackLocales === undefined ? undefined : copyDenseArray(rawFallbackLocales);
  if (rawFallbackLocales !== undefined && fallbackValues === undefined) {
    throw new I18nError('INVALID_LOCALE', 'Fallback locales must be an array.');
  }
  const fallbackLocales = canonicalizeFallbackLocales(fallbackValues);
  const rawCatalogs = constructionOption(input, 'catalogs');
  const copiedCatalogs = rawCatalogs === undefined ? Object.freeze([]) : copyDenseArray(rawCatalogs);
  if (copiedCatalogs === undefined) {
    throw new I18nError('INVALID_CATALOG', 'Catalogs must be an array.');
  }
  const rawSink = constructionOption(input, 'diagnosticSink');
  if (rawSink !== undefined && typeof rawSink !== 'function') {
    throw new I18nError('INVALID_CATALOG', 'Diagnostic sink must be a function.');
  }

  const diagnosticSink: DiagnosticSink | undefined =
    typeof rawSink === 'function'
      ? (diagnostic) => {
          Reflect.apply(rawSink, undefined, [diagnostic]);
        }
      : undefined;
  return Object.freeze({
    locale,
    fallbackLocales,
    catalogs: copiedCatalogs,
    ...(diagnosticSink === undefined ? {} : { diagnosticSink }),
  });
}

/** Validate and copy a call-site default through the catalog message boundary. */
function copyDefaultMessage(value: unknown): Message {
  const catalog = defineCatalog({
    schema: 1,
    locale: 'en',
    messages: { 'default.message': value },
  });
  const message = catalog.messages['default.message'];
  if (message === undefined) {
    throw new I18nError('INVALID_MESSAGE', 'Default message could not be copied.');
  }
  return message;
}

/** Validate translate-call options without retaining the caller object. */
function resolveTranslateOptions(input: TranslateOptions | undefined): {
  readonly params?: unknown;
  readonly defaultMessage?: Message;
} {
  if (input === undefined) return {};
  if (typeof input !== 'object' || input === null || inspectArray(input) !== false) {
    throw new I18nError('INVALID_PARAMETER', 'Translation options must be an object.');
  }
  validateOptionKeys(input, TRANSLATE_OPTION_KEYS, 'INVALID_PARAMETER');
  const params = ownDataProperty(input, 'params');
  const defaultMessage = ownDataProperty(input, 'defaultMessage');
  if (!params.valid || !defaultMessage.valid) {
    throw new I18nError('INVALID_PARAMETER', 'Translation options must use data properties.');
  }
  return Object.freeze({
    ...(params.value === undefined ? {} : { params: params.value }),
    ...(defaultMessage.value === undefined ? {} : { defaultMessage: copyDefaultMessage(defaultMessage.value) }),
  });
}

/** Browser-safe synchronous implementation behind the public {@link I18n} interface. */
class I18nService implements I18n {
  /** Canonical requested locale retained for formatting. */
  readonly #locale: string;

  /** Canonical configured fallbacks including final English. */
  readonly #fallbackLocales: readonly string[];

  /** Catalog lookup order derived once at construction. */
  readonly #catalogChain: readonly string[];

  /** Service-owned bounded formatter families. */
  readonly #formatters = new FormatterCache();

  /** Service-owned bounded recoverable diagnostics. */
  readonly #diagnosticStore: DiagnosticStore;

  /** Complete immutable lookup graph swapped only after successful publication. */
  #snapshot: CatalogSnapshot;

  /**
   * Creates a synchronous locale-bound service.
   *
   * @param options Validated and copied construction options.
   */
  constructor(options: ReturnType<typeof resolveConstructionOptions>) {
    this.#locale = options.locale.requested;
    this.#fallbackLocales = options.fallbackLocales;
    this.#catalogChain = buildCatalogLocaleChain(this.#locale, this.#fallbackLocales);
    this.#diagnosticStore = new DiagnosticStore(options.diagnosticSink);
    this.#snapshot = createCatalogSnapshot(options.catalogs.map((catalog) => Object.freeze({ catalog })));
    Object.freeze(this);
  }

  /** Canonical requested locale retained for formatting. */
  get locale(): string {
    return this.#locale;
  }

  /** Canonical configured fallbacks including final English. */
  get fallbackLocales(): readonly string[] {
    return this.#fallbackLocales;
  }

  /** Sorted catalog locales currently available to lookup. */
  get availableLocales(): readonly string[] {
    return this.#snapshot.availableLocales;
  }

  /** Deduplicated recoverable diagnostics, bounded to 100 records. */
  get diagnostics(): readonly I18nDiagnostic[] {
    return this.#diagnosticStore.records;
  }

  /**
   * Resolve and evaluate one translated message.
   *
   * @param key Namespaced message key.
   * @param options Safe parameters and optional English default.
   * @returns Resolved text, the call-site default, or the key.
   */
  t(key: string, options?: TranslateOptions): string {
    const validatedKey = validateMessageKey(key);
    const resolvedOptions = resolveTranslateOptions(options);
    const snapshot = this.#snapshot;

    for (const locale of this.#catalogChain) {
      const layers = snapshot.locales.get(locale);
      if (layers === undefined) continue;
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        const layer = layers[index];
        const message = layer?.messages.get(validatedKey);
        if (message === undefined || layer === undefined) continue;
        return evaluateMessage(message, {
          locale,
          params: resolvedOptions.params,
          getPluralRules: () => this.#formatters.pluralRules(locale),
          formatNumber: (value) => this.#formatters.numberFormat(locale).format(value),
          report: (code) => this.#record(code, validatedKey, locale, layer.source),
        });
      }
    }

    this.#record('MISSING_TRANSLATION', validatedKey, this.#locale);
    if (resolvedOptions.defaultMessage !== undefined) {
      return evaluateMessage(compileMessage(resolvedOptions.defaultMessage), {
        locale: 'en',
        params: resolvedOptions.params,
        getPluralRules: () => this.#formatters.pluralRules('en'),
        formatNumber: (value) => this.#formatters.numberFormat('en').format(value),
        report: (code) => this.#record(code, validatedKey, 'en'),
      });
    }
    return validatedKey;
  }

  /**
   * Format a finite number or bigint for the service locale.
   *
   * @param value Numeric value to format.
   * @param options Copied native formatting options.
   * @returns Locale-formatted number.
   */
  number(value: number | bigint, options?: Intl.NumberFormatOptions): string {
    if (
      (typeof value !== 'number' && typeof value !== 'bigint') ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new I18nError('INVALID_NUMBER', 'Number value must be finite or a bigint.');
    }
    return this.#formatters.numberFormat(this.#locale, options).format(value);
  }

  /**
   * Format a valid date or finite epoch milliseconds for the service locale.
   *
   * @param value Date value to format.
   * @param options Copied native formatting options.
   * @returns Locale-formatted date.
   */
  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
    let epoch: number;
    if (typeof value === 'number') {
      epoch = value;
    } else if (value instanceof Date) {
      try {
        epoch = Date.prototype.getTime.call(value);
      } catch (cause) {
        throw new I18nError('INVALID_DATE', 'Date value is invalid.', { cause });
      }
    } else {
      throw new I18nError('INVALID_DATE', 'Date value must be a Date or epoch milliseconds.');
    }
    if (!Number.isFinite(epoch)) {
      throw new I18nError('INVALID_DATE', 'Date value must represent a finite instant.');
    }
    return this.#formatters.dateTimeFormat(this.#locale, options).format(epoch);
  }

  /**
   * Compare normalized strings with a locale-bound collator.
   *
   * @param left First string.
   * @param right Second string.
   * @param options Copied native collation options.
   * @returns Negative, zero, or positive comparison result.
   */
  compare(left: string, right: string, options?: Intl.CollatorOptions): number {
    if (typeof left !== 'string' || typeof right !== 'string' || !isSafeText(left) || !isSafeText(right)) {
      throw new I18nError('UNSAFE_TEXT', 'Comparison values must be safe strings.');
    }
    return this.#formatters.collator(this.#locale, options).compare(left.normalize('NFC'), right.normalize('NFC'));
  }

  /**
   * Report whether a key exists in one locale's configured fallback chain.
   *
   * @param key Namespaced message key.
   * @param locale Optional locale override for introspection only.
   * @returns `true` when a catalog message can be resolved.
   */
  has(key: string, locale?: string): boolean {
    const validatedKey = validateMessageKey(key);
    const chain =
      locale === undefined
        ? this.#catalogChain
        : buildCatalogLocaleChain(resolveRequestedLocale(locale).requested, this.#fallbackLocales);
    const snapshot = this.#snapshot;
    for (const candidate of chain) {
      const layers = snapshot.locales.get(candidate);
      if (layers?.some((layer) => layer.messages.has(validatedKey))) return true;
    }
    return false;
  }

  /**
   * Atomically replace the highest-priority runtime overlay for one locale.
   *
   * @param catalog Untrusted catalog input validated before publication.
   */
  setCatalog(catalog: CatalogInput): void {
    const replacement = replaceCatalogOverlay(this.#snapshot, catalog);
    this.#snapshot = replacement;
  }

  /** Record one value-free recoverable diagnostic. */
  #record(code: I18nCode, key: string, locale: string, source?: string): void {
    this.#diagnosticStore.record({
      code,
      severity: 'warning',
      key,
      locale,
      ...(source === undefined ? {} : { source }),
    });
  }
}

/**
 * Create a synchronous locale-bound internationalization service.
 *
 * English is the default requested locale and remains the final catalog fallback. Catalog inputs
 * are validated, copied, and compiled before the service becomes observable.
 *
 * @param options Locale, fallback, catalog, and diagnostic configuration.
 * @returns Ready-to-use internationalization service.
 * @throws {@link I18nError} when configuration or any initial catalog is invalid.
 *
 * @example
 * ```ts
 * const i18n = createI18n({
 *   locale: 'nl-NL',
 *   catalogs: [{ schema: 1, locale: 'nl', messages: { 'app.ok': 'Oké' } }],
 * });
 * i18n.t('app.ok');
 * ```
 */
export function createI18n(options: CreateI18nOptions = {}): I18n {
  return new I18nService(resolveConstructionOptions(options));
}
