import { I18nError } from './errors.js';

/** Canonical requested locale and its extension-free catalog lookup locale. */
export interface ResolvedLocale {
  /** Canonical locale retained for Intl formatting. */
  readonly requested: string;
  /** Canonical base name used to match catalogs. */
  readonly catalog: string;
}

/** Remove POSIX encoding/modifier syntax before BCP-47 canonicalization. */
function cleanPosixLocale(value: string): string {
  const trimmed = value.trim();
  if (/^(?:c|posix)$/iu.test(trimmed)) return 'en';
  const base = trimmed.split(/[.@]/u, 1)[0] ?? '';
  if (base.includes('_') && !/^[A-Za-z]{2,3}_(?:[A-Za-z]{2}|[0-9]{3})$/u.test(base)) {
    return '';
  }
  return base.replaceAll('_', '-');
}

/**
 * Canonicalize an explicit locale without silently accepting invalid values.
 *
 * @param value Untrusted locale input.
 * @returns Canonical locale suitable for `Intl`.
 * @throws {@link I18nError} when the input is not one valid locale.
 *
 * @example
 * ```ts
 * canonicalizeRequestedLocale('nl_NL.UTF-8').requested; // "nl-NL"
 * ```
 */
export function canonicalizeRequestedLocale(value: unknown): ResolvedLocale {
  if (typeof value !== 'string') {
    throw new I18nError('INVALID_LOCALE', 'Locale must be a string.');
  }

  const cleaned = cleanPosixLocale(value);
  if (cleaned.length === 0) {
    throw new I18nError('INVALID_LOCALE', 'Locale must not be empty.');
  }

  let requested: string;
  try {
    const canonical = Intl.getCanonicalLocales(cleaned);
    if (canonical.length !== 1) {
      throw new RangeError('Expected exactly one locale.');
    }
    requested = canonical[0] ?? '';
  } catch (cause) {
    throw new I18nError('INVALID_LOCALE', 'Locale is not a valid BCP-47 tag.', { cause });
  }

  const locale = new Intl.Locale(requested);
  return Object.freeze({
    requested,
    catalog: locale.baseName,
  });
}

/**
 * Canonicalize a catalog locale and reject formatting-only or private extensions.
 *
 * @param value Untrusted catalog locale input.
 * @returns Canonical extension-free BCP-47 locale.
 * @throws {@link I18nError} when the locale is invalid or contains extensions.
 *
 * @example
 * ```ts
 * canonicalizeCatalogLocale('pt-pt'); // "pt-PT"
 * ```
 */
export function canonicalizeCatalogLocale(value: unknown): string {
  const resolved = canonicalizeRequestedLocale(value);
  if (resolved.requested !== resolved.catalog) {
    throw new I18nError('INVALID_LOCALE', 'Catalog locale must not contain Unicode or private-use extensions.');
  }
  return resolved.catalog;
}

/** Detect one environment locale without importing Node-specific modules. */
function detectAutomaticLocale(): string {
  if (typeof navigator !== 'undefined') {
    const candidate = navigator.languages[0] ?? navigator.language;
    if (candidate) return candidate;
  }

  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

/**
 * Resolve an optional requested locale, including the explicit `auto` opt-in.
 *
 * @param value Requested locale, `auto`, or `undefined`.
 * @returns Canonical requested and catalog locales.
 *
 * @example
 * ```ts
 * resolveRequestedLocale(undefined).requested; // "en"
 * ```
 */
export function resolveRequestedLocale(value: unknown): ResolvedLocale {
  if (value === undefined) return canonicalizeRequestedLocale('en');
  if (value === 'auto') return canonicalizeRequestedLocale(detectAutomaticLocale());
  return canonicalizeRequestedLocale(value);
}

/**
 * Canonicalize configured fallbacks, remove duplicates, and append final English.
 *
 * @param values Untrusted fallback list.
 * @returns Frozen canonical requested locales in lookup order.
 * @throws {@link I18nError} when the input is not an array of valid locales.
 *
 * @example
 * ```ts
 * canonicalizeFallbackLocales(['de-DE']); // ["de-DE", "en"]
 * ```
 */
export function canonicalizeFallbackLocales(values: unknown): readonly string[] {
  if (values !== undefined && !Array.isArray(values)) {
    throw new I18nError('INVALID_LOCALE', 'Fallback locales must be an array.');
  }

  const unique = new Set<string>();
  if (Array.isArray(values)) {
    for (const value of values) {
      unique.add(canonicalizeRequestedLocale(value).requested);
    }
  }
  unique.add('en');
  return Object.freeze([...unique]);
}

/** Append a catalog locale and its language fallback without duplicates. */
function appendCatalogLocale(chain: string[], seen: Set<string>, locale: string): void {
  const canonical = canonicalizeRequestedLocale(locale).catalog;
  if (!seen.has(canonical)) {
    seen.add(canonical);
    chain.push(canonical);
  }

  const language = new Intl.Locale(canonical).language;
  if (!seen.has(language)) {
    seen.add(language);
    chain.push(language);
  }
}

/**
 * Build the deterministic locale-first catalog lookup chain.
 *
 * @param requested Canonical requested locale.
 * @param fallbackLocales Canonical configured fallbacks including English.
 * @returns Frozen extension-free catalog locales, ending in English.
 *
 * @example
 * ```ts
 * buildCatalogLocaleChain('nl-BE', ['de-DE', 'en']); // ["nl-BE", "nl", "de-DE", "de", "en"]
 * ```
 */
export function buildCatalogLocaleChain(requested: string, fallbackLocales: readonly string[]): readonly string[] {
  const chain: string[] = [];
  const seen = new Set<string>();

  appendCatalogLocale(chain, seen, requested);
  for (const fallback of fallbackLocales) appendCatalogLocale(chain, seen, fallback);
  appendCatalogLocale(chain, seen, 'en');

  return Object.freeze(chain);
}
