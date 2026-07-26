/**
 * Specification tests for the browser-safe translation service.
 *
 * These expectations describe the public contract independently of implementation details. They
 * intentionally import only the package's public entry module.
 */
import { describe, expect, test, vi } from 'vitest';
import { I18nError, createI18n, defineCatalog, plural, select, validateCatalog } from '../src/index.js';
import {
  applicationEnglish,
  frameworkDutch,
  initialRuntimeCatalog,
  newerDutch,
  olderDutch,
  polishCardinals,
  primitiveSelections,
  replacementRuntimeCatalog,
} from './fixtures/catalogs.js';

describe('public browser entry', () => {
  test('exports the documented construction and message helpers', () => {
    expect(createI18n).toBeTypeOf('function');
    expect(defineCatalog).toBeTypeOf('function');
    expect(plural).toBeTypeOf('function');
    expect(select).toBeTypeOf('function');
  });
});

describe('catalog definition', () => {
  test('canonicalizes and copies a valid locale catalog', () => {
    const input = {
      schema: 1 as const,
      locale: 'nl-nl',
      messages: {
        'app.hello': 'Hallo',
      },
    };

    const catalog = defineCatalog(input);
    input.messages['app.hello'] = 'Gewijzigd';

    expect(catalog.locale).toBe('nl-NL');
    expect(catalog.messages['app.hello']).toBe('Hallo');
  });

  test.each([
    ['unsupported schema', { schema: 2, locale: 'en', messages: {} }, 'UNSUPPORTED_SCHEMA'],
    ['unknown top-level field', { schema: 1, locale: 'en', messages: {}, unexpected: true }, 'INVALID_CATALOG'],
    ['invalid message key', { schema: 1, locale: 'en', messages: { Invalid: 'No' } }, 'INVALID_KEY'],
    [
      'nested structured message',
      {
        schema: 1,
        locale: 'en',
        messages: {
          'app.count': {
            kind: 'plural',
            parameter: 'count',
            cases: {
              other: {
                kind: 'select',
                parameter: 'state',
                cases: { other: 'Nested' },
              },
            },
          },
        },
      },
      'INVALID_MESSAGE',
    ],
    [
      'structured message without other',
      {
        schema: 1,
        locale: 'en',
        messages: {
          'app.count': {
            kind: 'plural',
            parameter: 'count',
            cases: { one: 'One' },
          },
        },
      },
      'INVALID_MESSAGE',
    ],
  ])('rejects an %s without publishing a usable catalog', (_label, input, expectedCode) => {
    const issues = validateCatalog(input);

    expect(issues.map((issue) => issue.code)).toContain(expectedCode);
    expect(() => defineCatalog(input)).toThrow(I18nError);
  });
});

describe('translation resolution', () => {
  test('uses English defaults and returns an unknown key unchanged', () => {
    const i18n = createI18n();

    expect(i18n.locale).toBe('en');
    expect(i18n.fallbackLocales).toEqual(['en']);
    expect(i18n.t('missing.key')).toBe('missing.key');
  });

  test('resolves locale before layer while newer layers win inside one locale', () => {
    const i18n = createI18n({
      locale: 'nl-BE',
      catalogs: [olderDutch, frameworkDutch, newerDutch, applicationEnglish],
    });

    expect(i18n.t('app.greeting')).toBe('Nederlands');
    expect(i18n.t('app.layered')).toBe('Nieuw');
  });

  test('uses English string and structured call-site defaults before returning the key', () => {
    const i18n = createI18n({ locale: 'nl' });

    expect(i18n.t('app.default-string', { defaultMessage: 'English fallback' })).toBe('English fallback');
    expect(
      i18n.t('app.default-plural', {
        defaultMessage: plural('count', { one: 'One item', other: '${count} items' }),
        params: { count: 2 },
      }),
    ).toBe('2 items');
    expect(i18n.t('app.no-default')).toBe('app.no-default');
  });

  test('interpolates own parameters and emits an escaped placeholder literally', () => {
    const i18n = createI18n({ locale: 'nl', catalogs: [frameworkDutch] });

    expect(i18n.t('app.escaped', { params: { name: 'Ada' } })).toBe('Hi Ada; ${name}');
  });
});

describe('parameter safety', () => {
  test('leaves missing and inherited parameters visible and records value-free diagnostics', () => {
    const inherited: Record<string, string> = Object.create({ name: 'Inherited' });
    const i18n = createI18n({ locale: 'nl', catalogs: [frameworkDutch] });

    expect(i18n.t('app.named')).toBe('Hallo ${name}');
    expect(i18n.t('app.named', { params: inherited })).toBe('Hallo ${name}');
    expect(i18n.diagnostics.some((diagnostic) => diagnostic.code === 'MISSING_PARAMETER')).toBe(true);
    expect(JSON.stringify(i18n.diagnostics)).not.toContain('Inherited');
  });

  test('never coerces objects or inserts unsafe text into a translated message', () => {
    let coercions = 0;
    const hostile = {
      toString(): string {
        coercions += 1;
        return 'coerced-secret';
      },
    };
    const i18n = createI18n({ locale: 'nl', catalogs: [frameworkDutch] });

    const objectResult = Reflect.apply(i18n.t, i18n, ['app.named', { params: { name: hostile } }]);
    const unsafeResult = i18n.t('app.named', { params: { name: '\u001B[31msecret' } });

    expect(objectResult).toBe('Hallo ${name}');
    expect(unsafeResult).toBe('Hallo ${name}');
    expect(coercions).toBe(0);
    expect(JSON.stringify(i18n.diagnostics)).not.toContain('secret');
    expect(JSON.stringify(i18n.diagnostics)).not.toContain('coerced');
  });
});

describe('structured message controllers', () => {
  test.each([
    [1, '1:one'],
    [2, '2:few'],
    [22, '22:few'],
    [5, '5:many'],
    [12, '12:many'],
    [1.5, '1,5:other'],
  ] as const)('uses Polish cardinal rules for %s', (count, expected) => {
    const i18n = createI18n({ locale: 'pl', catalogs: [polishCardinals] });

    expect(i18n.t('items.count', { params: { count } })).toBe(expected);
  });

  test.each([
    ['absent', {}],
    ['not a number', { count: Number.NaN }],
    ['positive infinity', { count: Number.POSITIVE_INFINITY }],
    ['negative infinity', { count: Number.NEGATIVE_INFINITY }],
    ['wrong primitive', { count: '2' }],
  ] as const)('renders other without hiding an unresolved %s plural controller', (_label, params) => {
    const i18n = createI18n({ locale: 'pl', catalogs: [polishCardinals] });

    expect(i18n.t('items.count', { params })).toBe('${count}:other');
    expect(i18n.diagnostics.map((diagnostic) => diagnostic.code)).toContain('INVALID_CONTROLLER');
  });

  test.each([
    ['string', 'alpha', 'string'],
    ['finite number', 42, 'number'],
    ['boolean', true, 'boolean'],
    ['bigint', 9007199254740993n, 'bigint'],
    ['unmatched primitive', 'missing', 'other'],
  ] as const)('matches a %s select controller exactly', (_label, choice, expected) => {
    const i18n = createI18n({ locale: 'en', catalogs: [primitiveSelections] });

    expect(i18n.t('choice.value', { params: { choice } })).toBe(expected);
  });

  test.each([
    ['missing', {}],
    ['non-finite', { choice: Number.NaN }],
  ] as const)('diagnoses an %s select controller and uses other', (_label, params) => {
    const i18n = createI18n({ locale: 'en', catalogs: [primitiveSelections] });

    expect(i18n.t('choice.value', { params })).toBe('other');
    expect(i18n.diagnostics.map((diagnostic) => diagnostic.code)).toContain('INVALID_CONTROLLER');
  });

  test('uses select other without coercing an object controller', () => {
    let coercions = 0;
    const hostile = {
      toString(): string {
        coercions += 1;
        return 'alpha';
      },
    };
    const i18n = createI18n({ locale: 'en', catalogs: [primitiveSelections] });

    expect(Reflect.apply(i18n.t, i18n, ['choice.value', { params: { choice: hostile } }])).toBe('other');
    expect(coercions).toBe(0);
  });
});

describe('locale services', () => {
  test('formats allowed numeric and date inputs exactly like native Intl services', () => {
    const locale = 'nl-NL';
    const i18n = createI18n({ locale });
    const epoch = Date.UTC(2025, 0, 2, 12, 30);
    const date = new Date(epoch);
    const numberOptions = { maximumFractionDigits: 2 } as const;
    const dateOptions = {
      dateStyle: 'medium',
      timeZone: 'UTC',
    } as const;

    expect(i18n.number(1234.5, numberOptions)).toBe(new Intl.NumberFormat(locale, numberOptions).format(1234.5));
    expect(i18n.number(9007199254740993n)).toBe(new Intl.NumberFormat(locale).format(9007199254740993n));
    expect(i18n.date(date, dateOptions)).toBe(new Intl.DateTimeFormat(locale, dateOptions).format(date));
    expect(i18n.date(epoch, dateOptions)).toBe(new Intl.DateTimeFormat(locale, dateOptions).format(epoch));
  });

  test('compares canonically equivalent strings exactly like native Intl', () => {
    const locale = 'fr-FR';
    const composed = '\u00E9';
    const decomposed = 'e\u0301';
    const i18n = createI18n({ locale });

    expect(i18n.compare(composed, decomposed)).toBe(new Intl.Collator(locale).compare(composed, decomposed));
    expect(i18n.compare(composed, decomposed)).toBe(0);
  });

  test.each([
    ['NaN', () => createI18n().number(Number.NaN)],
    ['positive infinity', () => createI18n().number(Number.POSITIVE_INFINITY)],
    ['negative infinity', () => createI18n().number(Number.NEGATIVE_INFINITY)],
    ['invalid Date', () => createI18n().date(new Date(Number.NaN))],
    ['currency without a currency', () => createI18n().number(1, { style: 'currency' })],
    ['invalid locale', () => createI18n({ locale: 'not_a_locale' })],
  ])('throws a stable typed error for %s', (_label, action) => {
    let first: unknown;
    let second: unknown;

    try {
      action();
    } catch (error) {
      first = error;
    }
    try {
      action();
    } catch (error) {
      second = error;
    }

    expect(first).toBeInstanceOf(I18nError);
    expect(second).toBeInstanceOf(I18nError);
    if (!(first instanceof I18nError) || !(second instanceof I18nError)) {
      throw new Error('Expected both operations to throw I18nError');
    }
    expect(second).toMatchObject({
      code: first.code,
      message: first.message,
    });
  });

  test('rejects object formatter inputs without invoking coercion hooks', () => {
    let coercions = 0;
    const hostile = {
      valueOf(): number {
        coercions += 1;
        return 1;
      },
      toString(): string {
        coercions += 1;
        return '2025-01-01';
      },
    };
    const i18n = createI18n();

    expect(() => Reflect.apply(i18n.number, i18n, [hostile])).toThrow(I18nError);
    expect(() => Reflect.apply(i18n.date, i18n, [hostile])).toThrow(I18nError);
    expect(coercions).toBe(0);
  });
});

describe('runtime catalog replacement', () => {
  test('replaces the complete runtime overlay instead of merging it', () => {
    const i18n = createI18n({ locale: 'en' });

    i18n.setCatalog(initialRuntimeCatalog);
    i18n.setCatalog(replacementRuntimeCatalog);

    expect(i18n.t('runtime.kept')).toBe('replacement bytes');
    expect(i18n.t('runtime.removed')).toBe('runtime.removed');
  });

  test('keeps every previous translation byte-identical when replacement is invalid', () => {
    const i18n = createI18n({ locale: 'en' });
    i18n.setCatalog(initialRuntimeCatalog);
    const before = {
      kept: i18n.t('runtime.kept'),
      removed: i18n.t('runtime.removed'),
    };
    const invalidReplacement = {
      schema: 1 as const,
      locale: 'en',
      messages: { 'runtime.kept': { kind: 'select', parameter: 'value', cases: {} } },
    };

    expect(() => i18n.setCatalog(invalidReplacement)).toThrow(I18nError);
    expect({
      kept: i18n.t('runtime.kept'),
      removed: i18n.t('runtime.removed'),
    }).toEqual(before);
  });
});

describe('recoverable diagnostics', () => {
  test('deduplicates identical faults, caps distinct faults, hides data, and swallows sink errors', () => {
    const messages = Object.fromEntries(
      Array.from({ length: 120 }, (_, index) => [
        `fault.key-${index}`,
        plural(`secret${index}`, { other: `private text ${index}: \${secret${index}}` }),
      ]),
    );
    let sinkCalls = 0;
    const i18n = createI18n({
      locale: 'en',
      catalogs: [{ schema: 1, locale: 'en', messages }],
      diagnosticSink: () => {
        sinkCalls += 1;
        throw new Error('sink failure');
      },
    });

    for (let index = 0; index < 120; index += 1) {
      expect(i18n.t('fault.key-0')).toContain('${secret0}');
    }
    expect(i18n.diagnostics).toHaveLength(1);

    for (let index = 0; index < 120; index += 1) {
      expect(i18n.t(`fault.key-${index}`)).toContain(`\${secret${index}}`);
    }

    expect(i18n.diagnostics).toHaveLength(100);
    expect(sinkCalls).toBe(120);
    expect(JSON.stringify(i18n.diagnostics)).not.toMatch(/private text|secret\d+/);
    expect(i18n.t('fault.key-119')).toContain('${secret119}');
  });

  test('reuses Intl formatters across repeated warm calls', () => {
    const pluralRules = vi.spyOn(Intl, 'PluralRules');
    const numberFormat = vi.spyOn(Intl, 'NumberFormat');

    try {
      const i18n = createI18n({ locale: 'pl', catalogs: [polishCardinals] });
      const expectedPlural = i18n.t('items.count', { params: { count: 22 } });
      const expectedNumber = i18n.number(1234.5);
      const pluralConstructions = pluralRules.mock.calls.length;
      const numberConstructions = numberFormat.mock.calls.length;

      // Cache correctness needs more than one lookup, but it does not depend on a wall-clock workload.
      // Keep this oracle deliberately small so shared CI runner speed cannot change its outcome.
      for (let index = 0; index < 32; index += 1) {
        expect(i18n.t('items.count', { params: { count: 22 } })).toBe(expectedPlural);
        expect(i18n.number(1234.5)).toBe(expectedNumber);
      }

      expect(pluralRules).toHaveBeenCalledTimes(pluralConstructions);
      expect(numberFormat).toHaveBeenCalledTimes(numberConstructions);
    } finally {
      pluralRules.mockRestore();
      numberFormat.mockRestore();
    }
  });
});
