import { describe, expect, test } from 'vitest';
import { formatCatalogIssue } from '../src/issue-format.js';
import { defineCatalog, validateCatalog } from '../src/validation.js';

describe('catalog structural validation', () => {
  test('should reject accessors without invoking them', () => {
    let reads = 0;
    const input = {
      schema: 1,
      locale: 'en',
      messages: Object.defineProperty({}, 'app.title', {
        enumerable: true,
        get() {
          reads += 1;
          return 'secret';
        },
      }),
    };

    expect(validateCatalog(input)).toEqual([
      expect.objectContaining({
        code: 'INVALID_MESSAGE',
        path: ['messages', 'app.title'],
      }),
    ]);
    expect(reads).toBe(0);
  });

  test('should reject unknown structured-message fields as message errors', () => {
    const issues = validateCatalog({
      schema: 1,
      locale: 'en',
      messages: {
        'app.count': {
          kind: 'plural',
          parameter: 'count',
          cases: { other: 'items' },
          nested: true,
        },
      },
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_MESSAGE',
        path: ['messages', 'app.count', 'nested'],
      }),
    );
  });

  test('should reject unsupported plural categories for the catalog locale', () => {
    const issues = validateCatalog({
      schema: 1,
      locale: 'en',
      messages: {
        'app.count': {
          kind: 'plural',
          parameter: 'count',
          cases: { few: 'few', other: 'other' },
        },
      },
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_MESSAGE',
        path: ['messages', 'app.count', 'cases', 'few'],
      }),
    );
  });

  test('should enforce key, message-count, and UTF-8 message limits', () => {
    const overlongKey = `app.${'a'.repeat(509)}`;
    const tooManyMessages = Object.fromEntries(
      Array.from({ length: 10_001 }, (_, index) => [`app.key-${index}`, 'ok']),
    );

    expect(
      validateCatalog({
        schema: 1,
        locale: 'en',
        messages: { [overlongKey]: 'ok' },
      }).map((issue) => issue.code),
    ).toContain('INVALID_KEY');
    expect(
      validateCatalog({
        schema: 1,
        locale: 'en',
        messages: { 'app.large': 'a'.repeat(65_537) },
      }).map((issue) => issue.code),
    ).toContain('CATALOG_LIMIT_EXCEEDED');
    expect(
      validateCatalog({
        schema: 1,
        locale: 'en',
        messages: tooManyMessages,
      }).map((issue) => issue.code),
    ).toContain('CATALOG_LIMIT_EXCEEDED');
  });
});

describe('strict completeness validation', () => {
  const reference = {
    schema: 1,
    locale: 'en',
    messages: {
      'app.greeting': 'Hello ${name}',
      'app.count': {
        kind: 'plural',
        parameter: 'count',
        cases: { one: 'one', other: '${count} items' },
      },
    },
  };

  test('should report missing, extra, kind, and placeholder mismatches stably', () => {
    const issues = validateCatalog(
      {
        schema: 1,
        locale: 'nl',
        messages: {
          'app.greeting': 'Hallo',
          'app.count': 'items',
          'app.extra': 'extra',
        },
      },
      { mode: 'strict', referenceCatalog: reference },
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_PARAMETER',
          path: ['messages', 'app.greeting', 'placeholders'],
        }),
        expect.objectContaining({
          code: 'INVALID_MESSAGE',
          path: ['messages', 'app.count', 'kind'],
        }),
        expect.objectContaining({
          code: 'INVALID_CATALOG',
          path: ['messages', 'app.extra'],
        }),
      ]),
    );
  });

  test('should report an invalid supplied reference catalog', () => {
    const issues = validateCatalog(
      { schema: 1, locale: 'nl', messages: {} },
      {
        mode: 'strict',
        referenceCatalog: { schema: 2, locale: 'en', messages: {} },
      },
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'UNSUPPORTED_SCHEMA',
        path: ['referenceCatalog', 'schema'],
      }),
    );
  });
});

describe('accelerator validation and issue formatting', () => {
  const manifest = {
    scopes: [{ name: 'dialog', keys: ['app.ok', 'app.open'] }],
  };

  test('should warn for application collisions and error in strict or official mode', () => {
    const catalog = {
      schema: 1,
      locale: 'en',
      messages: {
        'app.ok': '~O~K',
        'app.open': '~O~pen',
      },
    };

    expect(validateCatalog(catalog, { acceleratorManifest: manifest })).toContainEqual(
      expect.objectContaining({ severity: 'warning', key: 'app.open' }),
    );
    expect(
      validateCatalog(catalog, {
        mode: 'strict',
        acceleratorManifest: manifest,
      }),
    ).toContainEqual(expect.objectContaining({ severity: 'error', key: 'app.open' }));
    expect(
      validateCatalog(catalog, {
        official: true,
        acceleratorManifest: manifest,
      }),
    ).toContainEqual(expect.objectContaining({ severity: 'error', key: 'app.open' }));
  });

  test.each(['Open', '~Ö~pen', '~AB~', '~O~p~E~n', '~~Open'])(
    'should reject malformed required accelerator label %s',
    (label) => {
      const issues = validateCatalog(
        {
          schema: 1,
          locale: 'en',
          messages: { 'app.ok': label },
        },
        {
          official: true,
          acceleratorManifest: { scopes: [{ name: 'dialog', keys: ['app.ok'] }] },
        },
      );

      expect(issues).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_MESSAGE',
          path: ['messages', 'app.ok', 'accelerator'],
        }),
      );
    },
  );

  test('should render unsafe issue identifiers without terminal controls or values', () => {
    const line = formatCatalogIssue({
      code: 'INVALID_KEY',
      severity: 'error',
      path: ['messages', 'bad\u001B\u202E'],
      source: 'source',
    });

    expect(line).toContain('INVALID_KEY');
    expect(line).toContain('source=');
    expect(line).not.toMatch(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u);
  });
});

describe('catalog publication ownership', () => {
  test('should canonicalize, deeply copy, and freeze accepted messages', () => {
    const cases = { one: 'one', other: 'other' };
    const input = {
      schema: 1,
      locale: 'nl-nl',
      messages: {
        'app.count': { kind: 'plural', parameter: 'count', cases },
      },
    };
    const catalog = defineCatalog(input);
    cases.one = 'changed';

    expect(catalog.locale).toBe('nl-NL');
    expect(catalog.messages['app.count']).toEqual({
      kind: 'plural',
      parameter: 'count',
      cases: { one: 'one', other: 'other' },
    });
    expect(Object.isFrozen(catalog.messages)).toBe(true);
  });
});
