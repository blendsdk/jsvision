/**
 * Specification tests for the browser-safe translation service.
 *
 * These expectations describe the public contract independently of implementation details. They
 * intentionally import only the package's public entry module.
 */
import { describe, expect, test } from 'vitest';
import { I18nError, createI18n, defineCatalog, plural, select, validateCatalog } from '../src/index.js';
import { applicationEnglish, frameworkDutch, newerDutch, olderDutch } from './fixtures/catalogs.js';

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
