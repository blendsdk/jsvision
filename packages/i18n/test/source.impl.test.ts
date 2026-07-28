import { describe, expect, test } from 'vitest';
import { defineCatalog, loadI18n } from '../src/index.js';

const VALID_CATALOG = Object.freeze({
  schema: 1 as const,
  locale: 'en',
  messages: Object.freeze({
    'source.value': 'loaded',
  }),
});

describe('source configuration boundaries', () => {
  test('rejects accessor-backed options without executing the accessor', async () => {
    let reads = 0;
    const options = Object.defineProperty({}, 'sources', {
      enumerable: true,
      get() {
        reads += 1;
        return [];
      },
    });

    await expect(Reflect.apply(loadI18n, undefined, [options])).rejects.toMatchObject({
      code: 'SOURCE_FAILED',
    });
    expect(reads).toBe(0);
  });

  test('contains a revoked source-array proxy behind a typed error', async () => {
    const revocable = Proxy.revocable([], {});
    revocable.revoke();

    await expect(Reflect.apply(loadI18n, undefined, [{ sources: revocable.proxy }])).rejects.toMatchObject({
      code: 'SOURCE_FAILED',
    });
  });

  test('rejects accessor-backed source members without executing them', async () => {
    let reads = 0;
    const source = Object.defineProperty({ name: 'hostile', load: async () => VALID_CATALOG }, 'required', {
      enumerable: true,
      get() {
        reads += 1;
        return false;
      },
    });

    await expect(loadI18n({ sources: [source] })).rejects.toMatchObject({
      code: 'SOURCE_FAILED',
    });
    expect(reads).toBe(0);
  });

  test.each(['line\nbreak', '\u001B[31m', ''])('rejects an unsafe or empty source name', async (name) => {
    await expect(
      loadI18n({
        sources: [
          {
            name,
            async load() {
              return VALID_CATALOG;
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_FAILED' });
  });

  test('rejects revoked signals and ignores instance listener overrides', async () => {
    const signal = new AbortController().signal;
    const revocable = Proxy.revocable(signal, {});
    revocable.revoke();
    await expect(loadI18n({ signal: revocable.proxy, sources: [] })).rejects.toMatchObject({
      code: 'SOURCE_FAILED',
    });

    Object.defineProperty(signal, 'addEventListener', {
      value() {
        throw new Error('private signal failure');
      },
    });
    await expect(loadI18n({ signal, sources: [] })).resolves.toBeDefined();
  });

  test('rejects a live signal proxy before invoking its traps in Node', async () => {
    const signal = new AbortController().signal;
    let traps = 0;
    const proxy = new Proxy(signal, {
      get() {
        traps += 1;
        throw new Error('private proxy getter');
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error('private proxy prototype');
      },
    });

    await expect(loadI18n({ signal: proxy, sources: [] })).rejects.toMatchObject({
      code: 'SOURCE_FAILED',
    });
    expect(traps).toBe(0);
  });

  test('bounds the number of concurrently started sources', async () => {
    const source = {
      name: 'bounded',
      async load() {
        return VALID_CATALOG;
      },
    };

    await expect(loadI18n({ sources: Array(257).fill(source) })).rejects.toMatchObject({
      code: 'SOURCE_FAILED',
    });
  });
});

describe('source settlement and validation', () => {
  test('initiates later sources even when an earlier source throws synchronously', async () => {
    const starts: string[] = [];

    await expect(
      loadI18n({
        sources: [
          {
            name: 'first',
            load() {
              starts.push('first');
              throw new Error('private failure');
            },
          },
          {
            name: 'second',
            async load() {
              starts.push('second');
              return VALID_CATALOG;
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_FAILED' });
    expect(starts).toEqual(['first', 'second']);
  });

  test('treats an invalid optional result as one source diagnostic', async () => {
    const i18n = await loadI18n({
      sources: [
        {
          name: 'optional-invalid',
          required: false,
          async load() {
            return { schema: 1, locale: 'en', messages: { Invalid: 'rejected' } };
          },
        },
        {
          name: 'valid',
          async load() {
            return VALID_CATALOG;
          },
        },
      ],
    });

    expect(i18n.t('source.value')).toBe('loaded');
    expect(i18n.diagnostics).toEqual([
      expect.objectContaining({
        code: 'SOURCE_FAILED',
        source: 'optional-invalid',
      }),
    ]);
  });

  test('translates an invalid required result into a value-free source error', async () => {
    let failure: unknown;
    try {
      await loadI18n({
        sources: [
          {
            name: 'required-invalid',
            async load() {
              return { secret: 'catalog-secret' };
            },
          },
        ],
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({ code: 'SOURCE_FAILED' });
    expect(String(failure)).not.toContain('catalog-secret');
  });

  test('preserves catalog order within one source result', async () => {
    const i18n = await loadI18n({
      sources: [
        {
          name: 'layered',
          async load() {
            return [
              VALID_CATALOG,
              {
                schema: 1,
                locale: 'en',
                messages: { 'source.value': 'override' },
              },
            ];
          },
        },
      ],
    });

    expect(i18n.t('source.value')).toBe('override');
  });

  test('bounds aggregate catalogs across otherwise valid source results', async () => {
    const catalog = defineCatalog(VALID_CATALOG);
    const first = Array(6_000).fill(catalog);
    const second = Array(4_001).fill(catalog);

    await expect(
      loadI18n({
        sources: [
          {
            name: 'first',
            async load() {
              return first;
            },
          },
          {
            name: 'second',
            async load() {
              return second;
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_FAILED' });
  });

  test('bounds aggregate compilation work from repeated validated catalogs', async () => {
    const cases = Object.fromEntries([
      ...Array.from({ length: 255 }, (_, index) => [`case-${index}`, 'value']),
      ['other', 'value'],
    ]);
    const catalog = defineCatalog({
      schema: 1,
      locale: 'en',
      messages: {
        'source.choice': {
          kind: 'select',
          parameter: 'choice',
          cases,
        },
      },
    });

    await expect(
      loadI18n({
        sources: [
          {
            name: 'repeated',
            async load() {
              return Array(391).fill(catalog);
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_FAILED' });
  });
});
