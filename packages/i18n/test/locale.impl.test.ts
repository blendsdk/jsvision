import { describe, expect, test } from 'vitest';
import { I18nError } from '../src/errors.js';
import {
  buildCatalogLocaleChain,
  canonicalizeCatalogLocale,
  canonicalizeFallbackLocales,
  canonicalizeRequestedLocale,
  resolveRequestedLocale,
} from '../src/locale.js';

describe('requested locale normalization', () => {
  test.each(['C', 'POSIX', 'c', 'posix'])('should map %s to English', (locale) => {
    expect(canonicalizeRequestedLocale(locale)).toEqual({
      requested: 'en',
      catalog: 'en',
    });
  });

  test('should normalize a common POSIX locale before canonicalization', () => {
    expect(canonicalizeRequestedLocale('nl_NL.UTF-8@euro')).toEqual({
      requested: 'nl-NL',
      catalog: 'nl-NL',
    });
  });

  test.each(['', 'not_a_locale', 42, null])(
    'should reject invalid explicit locale input without coercion',
    (locale) => {
      expect(() => canonicalizeRequestedLocale(locale)).toThrowError(
        expect.objectContaining({ code: 'INVALID_LOCALE' }),
      );
    },
  );

  test('should retain requested extensions while exposing the base catalog locale', () => {
    expect(canonicalizeRequestedLocale('de-DE-u-nu-latn')).toEqual({
      requested: 'de-DE-u-nu-latn',
      catalog: 'de-DE',
    });
  });

  test('should reject extensions in catalog declarations', () => {
    expect(() => canonicalizeCatalogLocale('de-DE-u-nu-latn')).toThrow(I18nError);
  });
});

describe('fallback and lookup chains', () => {
  test('should deduplicate configured fallbacks and append English', () => {
    expect(canonicalizeFallbackLocales(['de-DE', 'de-DE', 'en'])).toEqual(['de-DE', 'en']);
  });

  test('should reject a non-array fallback collection', () => {
    expect(() => canonicalizeFallbackLocales('de-DE')).toThrowError(
      expect.objectContaining({ code: 'INVALID_LOCALE' }),
    );
  });

  test('should build region then language chains without duplicates', () => {
    expect(buildCatalogLocaleChain('nl-BE', ['nl', 'de-DE', 'en'])).toEqual(['nl-BE', 'nl', 'de-DE', 'de', 'en']);
  });

  test('should default an absent requested locale to English', () => {
    expect(resolveRequestedLocale(undefined)).toEqual({
      requested: 'en',
      catalog: 'en',
    });
  });
});
