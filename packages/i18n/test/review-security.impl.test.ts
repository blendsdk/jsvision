import { describe, expect, test } from 'vitest';
import { I18nError, createI18n, defineCatalog, mergeCatalogs, select, validateCatalog } from '../src/index.js';

const VALID_CATALOG = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'app.greeting': 'Hello ${name}',
  },
};

describe('review hardening for public object boundaries', () => {
  test('should recover when a parameter proxy refuses descriptor inspection', () => {
    const params = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('proxy-secret');
        },
      },
    );
    const i18n = createI18n({ catalogs: [VALID_CATALOG] });

    expect(i18n.t('app.greeting', { params })).toBe('Hello ${name}');
    expect(i18n.diagnostics).toEqual([
      expect.objectContaining({
        code: 'MISSING_PARAMETER',
        key: 'app.greeting',
      }),
    ]);
    expect(JSON.stringify(i18n.diagnostics)).not.toContain('proxy-secret');
  });

  test('should translate a hostile catalog-array proxy into a typed error', () => {
    const catalogs = new Proxy([], {
      getOwnPropertyDescriptor(_target, property) {
        if (property === 'length') throw new Error('array-secret');
        return undefined;
      },
    });

    expect(() => createI18n({ catalogs })).toThrowError(
      expect.objectContaining({
        name: 'I18nError',
        code: 'INVALID_CATALOG',
      }),
    );
  });

  test('should reject a revoked catalog proxy without leaking a native TypeError', () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(validateCatalog(revocable.proxy)).toEqual([
      expect.objectContaining({
        code: 'INVALID_CATALOG',
        path: [],
      }),
    ]);
    expect(() => defineCatalog(revocable.proxy)).toThrow(I18nError);
  });

  test('should translate revoked public option and collection proxies into typed errors', () => {
    const i18n = createI18n({ catalogs: [VALID_CATALOG] });
    const translationOptions = Proxy.revocable({}, {});
    const formatterOptions = Proxy.revocable({}, {});
    const catalogInputs = Proxy.revocable([], {});
    translationOptions.revoke();
    formatterOptions.revoke();
    catalogInputs.revoke();

    expect(() => Reflect.apply(i18n.t, i18n, ['app.greeting', translationOptions.proxy])).toThrowError(
      expect.objectContaining({ code: 'INVALID_PARAMETER' }),
    );
    expect(() => Reflect.apply(i18n.number, i18n, [1, formatterOptions.proxy])).toThrowError(
      expect.objectContaining({ code: 'INVALID_FORMATTER_OPTIONS' }),
    );
    expect(() => Reflect.apply(mergeCatalogs, undefined, [catalogInputs.proxy])).toThrowError(
      expect.objectContaining({ code: 'INVALID_CATALOG' }),
    );
  });

  test('should reject accessor-backed validation options without executing them', () => {
    let reads = 0;
    const options = Object.defineProperty({}, 'source', {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error('source-secret');
      },
    });

    expect(validateCatalog(VALID_CATALOG, options)).toEqual([
      expect.objectContaining({
        code: 'INVALID_CATALOG',
        path: ['options', 'source'],
      }),
    ]);
    expect(reads).toBe(0);
  });

  test('should keep service state non-enumerable and runtime read-only', () => {
    const i18n = createI18n({ locale: 'en', catalogs: [VALID_CATALOG] });

    expect(Object.keys(i18n)).toEqual([]);
    expect(Object.isFrozen(i18n)).toBe(true);
    expect(Reflect.get(i18n, 'snapshot')).toBeUndefined();
    expect(Reflect.set(i18n, 'locale', 'de')).toBe(false);
    expect(Reflect.defineProperty(i18n, 'locale', { value: 'de' })).toBe(false);
    expect(i18n.locale).toBe('en');
    expect(i18n.t('app.greeting', { params: { name: 'Ada' } })).toBe('Hello Ada');
  });
});

describe('review hardening for catalog resource limits', () => {
  test('should reject a structured message with more than 256 select cases', () => {
    const cases = Object.fromEntries([
      ...Array.from({ length: 256 }, (_, index) => [`case-${index}`, `Value ${index}`]),
      ['other', 'Other'],
    ]);

    expect(
      validateCatalog({
        schema: 1,
        locale: 'en',
        messages: {
          'app.selection': { kind: 'select', parameter: 'value', cases },
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'CATALOG_LIMIT_EXCEEDED',
        path: ['messages', 'app.selection', 'cases'],
      }),
    );
  });

  test('should reject an overlong select case name', () => {
    const longCase = 'x'.repeat(513);

    expect(() => select('value', { [longCase]: 'Long', other: 'Other' })).toThrowError(
      expect.objectContaining({
        code: 'CATALOG_LIMIT_EXCEEDED',
      }),
    );
  });

  test('should bound the total number of structured cases in one catalog', () => {
    const cases = Object.fromEntries([
      ...Array.from({ length: 255 }, (_, index) => [`case-${index}`, `Value ${index}`]),
      ['other', 'Other'],
    ]);
    const messages = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [
        `selection.item-${index}`,
        { kind: 'select', parameter: 'value', cases },
      ]),
    );

    expect(validateCatalog({ schema: 1, locale: 'en', messages })).toContainEqual(
      expect.objectContaining({
        code: 'CATALOG_LIMIT_EXCEEDED',
      }),
    );
  });
});

describe('review hardening for strict validation policy', () => {
  test('should reject unknown validation modes instead of silently using partial mode', () => {
    const issues = Reflect.apply(validateCatalog, undefined, [VALID_CATALOG, { mode: 'bogus' }]);

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'INVALID_CATALOG',
        path: ['options', 'mode'],
      }),
    ]);
  });

  test('should reject malformed nested manifests instead of silently omitting checks', () => {
    const issues = Reflect.apply(validateCatalog, undefined, [
      VALID_CATALOG,
      {
        mode: 'strict',
        acceleratorManifest: {
          scopes: [{ name: 'main', keys: 'app.greeting' }],
        },
      },
    ]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_CATALOG',
        path: ['options', 'acceleratorManifest', 'scopes', '0', 'keys'],
      }),
    );
  });

  test('should reject overlong message keys in every nested validation policy', () => {
    const longKey = `app.${'x'.repeat(509)}`;
    const policies = [
      { referenceKeys: [longKey] },
      { placeholderManifest: { [longKey]: [] } },
      {
        acceleratorManifest: {
          scopes: [{ name: 'main', keys: [longKey], requiredKeys: [longKey] }],
        },
      },
    ];

    for (const policy of policies) {
      expect(Reflect.apply(validateCatalog, undefined, [VALID_CATALOG, policy])).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_CATALOG',
        }),
      );
    }
  });

  test('should allow an explicitly optional unaccelerated label in a collision scope', () => {
    const catalog = {
      schema: 1 as const,
      locale: 'en',
      messages: {
        'menu.open': '~O~pen',
        'menu.help': 'Help',
      },
    };

    expect(
      validateCatalog(catalog, {
        mode: 'strict',
        acceleratorManifest: {
          scopes: [
            {
              name: 'main',
              keys: ['menu.open', 'menu.help'],
              requiredKeys: ['menu.open'],
            },
          ],
        },
      }),
    ).toEqual([]);
  });

  test('should still reject a missing marker for a required accelerator label', () => {
    const catalog = {
      schema: 1 as const,
      locale: 'en',
      messages: {
        'menu.open': 'Open',
      },
    };

    expect(
      validateCatalog(catalog, {
        mode: 'strict',
        acceleratorManifest: {
          scopes: [
            {
              name: 'main',
              keys: ['menu.open'],
              requiredKeys: ['menu.open'],
            },
          ],
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_MESSAGE',
        key: 'menu.open',
      }),
    );
  });

  test('should sort issues independently of ambient locale comparison', () => {
    const issues = validateCatalog({
      schema: 1,
      locale: 'en',
      messages: {
        'z.invalid': { kind: 'select', parameter: 'value', cases: {} },
        'a.invalid': { kind: 'select', parameter: 'value', cases: {} },
      },
    });

    expect([...new Set(issues.map((issue) => issue.key))]).toEqual(['a.invalid', 'z.invalid']);
  });
});
