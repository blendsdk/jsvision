import { describe, expect, test } from 'vitest';
import { FormatterCache } from '../src/cache.js';
import { getIntlConstructionCounts } from '../src/intl.js';
import { getMessageCompilationCount, getTemplateCompilationCount } from '../src/messages.js';
import { createI18n, defineCatalog, plural, validateCatalog } from '../src/index.js';

describe('review hardening for observable warm-path work', () => {
  test('should expose formatter construction to the warm-path oracle', () => {
    const before = getIntlConstructionCounts();
    const i18n = createI18n({
      locale: 'en',
      catalogs: [
        {
          schema: 1,
          locale: 'en',
          messages: {
            'items.count': plural('count', {
              one: '${count} item',
              other: '${count} items',
            }),
          },
        },
      ],
    });
    i18n.t('items.count', { params: { count: 2 } });
    i18n.number(12);
    const afterFirstUse = getIntlConstructionCounts();

    expect(afterFirstUse.pluralRules).toBeGreaterThan(before.pluralRules);
    expect(afterFirstUse.numberFormats).toBeGreaterThan(before.numberFormats);
    for (let index = 0; index < 1_000; index += 1) {
      i18n.t('items.count', { params: { count: 2 } });
      i18n.number(12);
    }
    expect(getIntlConstructionCounts()).toEqual(afterFirstUse);
  });

  test('should compile during publication but never during warm translation', () => {
    const before = getMessageCompilationCount();
    const i18n = createI18n({
      catalogs: [defineCatalog({ schema: 1, locale: 'en', messages: { 'app.title': 'Title' } })],
    });
    const afterPublication = getMessageCompilationCount();

    expect(afterPublication).toBeGreaterThan(before);
    for (let index = 0; index < 1_000; index += 1) {
      expect(i18n.t('app.title')).toBe('Title');
    }
    expect(getMessageCompilationCount()).toBe(afterPublication);
  });

  test('should resolve plural categories once while validating one catalog', () => {
    const before = getIntlConstructionCounts().pluralRules;

    defineCatalog({
      schema: 1,
      locale: 'en',
      messages: {
        'first.count': plural('count', { one: 'One', other: 'Other' }),
        'second.count': plural('count', { one: 'One', other: 'Other' }),
        'third.count': plural('count', { one: 'One', other: 'Other' }),
      },
    });

    expect(getIntlConstructionCounts().pluralRules - before).toBe(1);
  });

  test('should not construct plural rules for a literal-only translation', () => {
    const before = getIntlConstructionCounts().pluralRules;
    const i18n = createI18n({
      catalogs: [{ schema: 1, locale: 'en', messages: { 'app.title': 'Title' } }],
    });

    expect(i18n.t('app.title')).toBe('Title');
    expect(getIntlConstructionCounts().pluralRules).toBe(before);
  });

  test('should share the default formatter identity with empty options', () => {
    const before = getIntlConstructionCounts().numberFormats;
    const cache = new FormatterCache();
    cache.numberFormat('en');
    const afterDefault = getIntlConstructionCounts().numberFormats;
    cache.numberFormat('en', {});

    expect(afterDefault).toBeGreaterThan(before);
    expect(getIntlConstructionCounts().numberFormats).toBe(afterDefault);
  });

  test('should stop compiling after an aggregate catalog text limit is crossed', () => {
    const large = 'x'.repeat(65_536);
    const messages = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`bulk.item-${index}`, large]));
    const before = getTemplateCompilationCount();

    expect(validateCatalog({ schema: 1, locale: 'en', messages })).toContainEqual(
      expect.objectContaining({ code: 'CATALOG_LIMIT_EXCEEDED' }),
    );
    const compiled = getTemplateCompilationCount() - before;
    expect(compiled).toBeLessThanOrEqual(257);
    expect(compiled).toBeLessThan(300);
  });
});
