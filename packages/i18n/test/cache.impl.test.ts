import { describe, expect, test } from 'vitest';
import { FormatterCache } from '../src/cache.js';
import { I18nError } from '../src/errors.js';

describe('stable formatter identities', () => {
  test('should reuse number formatters across option insertion order', () => {
    const cache = new FormatterCache();

    const first = cache.numberFormat('en', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
    const second = cache.numberFormat('en', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 1,
    });

    expect(second).toBe(first);
  });

  test('should reuse plural, date, and collator identities independently', () => {
    const cache = new FormatterCache();

    expect(cache.pluralRules('pl')).toBe(cache.pluralRules('pl'));
    expect(cache.dateTimeFormat('en', { dateStyle: 'medium' })).toBe(
      cache.dateTimeFormat('en', { dateStyle: 'medium' }),
    );
    expect(cache.collator('en', { sensitivity: 'accent' })).toBe(cache.collator('en', { sensitivity: 'accent' }));
  });
});

describe('formatter option safety', () => {
  test('should reject accessor options without invoking them', () => {
    const cache = new FormatterCache();
    let reads = 0;
    const options = Object.defineProperty({}, 'style', {
      enumerable: true,
      get() {
        reads += 1;
        return 'decimal';
      },
    });

    expect(() => Reflect.apply(cache.numberFormat, cache, ['en', options])).toThrow(I18nError);
    expect(reads).toBe(0);
  });

  test.each([
    ['unknown option', { unknown: true }],
    ['object value', { style: { toString: (): string => 'decimal' } }],
    ['non-finite value', { maximumFractionDigits: Number.NaN }],
    ['invalid native enum', { style: 'invalid' }],
    ['missing currency', { style: 'currency' }],
    ['malformed currency', { style: 'currency', currency: 'EURO' }],
  ])('should reject %s with the stable option error', (_label, options) => {
    const cache = new FormatterCache();

    expect(() => Reflect.apply(cache.numberFormat, cache, ['en', options])).toThrowError(
      expect.objectContaining({ code: 'INVALID_FORMATTER_OPTIONS' }),
    );
  });

  test('should accept a lowercase three-letter currency like native Intl', () => {
    const cache = new FormatterCache();

    expect(cache.numberFormat('en', { style: 'currency', currency: 'eur' }).format(1)).toBe(
      new Intl.NumberFormat('en', { style: 'currency', currency: 'eur' }).format(1),
    );
  });
});

describe('least-recently-used bounds', () => {
  test('should evict the least-recent number formatter after 64 identities', () => {
    const cache = new FormatterCache();
    const first = cache.numberFormat('en');
    for (let index = 0; index < 64; index += 1) {
      cache.numberFormat(`en-x-c${index.toString(36)}`);
    }

    expect(cache.numberFormat('en')).not.toBe(first);
  });

  test('should not let number entries evict plural-rule entries', () => {
    const cache = new FormatterCache();
    const plural = cache.pluralRules('pl');
    for (let index = 0; index < 65; index += 1) {
      cache.numberFormat(`en-x-n${index.toString(36)}`);
    }

    expect(cache.pluralRules('pl')).toBe(plural);
  });
});
