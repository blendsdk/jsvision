import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadI18n } from '../src/index.js';
import { jsonFileSource } from '../src/node/index.js';
import { catalogJson, padJsonToBytes } from './fixtures/node.js';

let fixtureRoot: string;

beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'jsvision-i18n-json-source-'));
});

afterEach(async () => {
  await rm(fixtureRoot, { force: true, recursive: true });
});

describe('JSON file source configuration', () => {
  test('copies options before the caller mutates them', async () => {
    const paths = ['en.json'];
    const options = { root: fixtureRoot, paths };
    await writeFile(
      join(fixtureRoot, 'en.json'),
      JSON.stringify({ schema: 1, locale: 'en', messages: { 'app.title': 'Title' } }),
    );
    const source = jsonFileSource(options);
    paths[0] = 'missing.json';
    options.root = '/outside';

    const catalogs = await source.load({ signal: new AbortController().signal });
    if (!Array.isArray(catalogs) || typeof catalogs[0] !== 'object' || catalogs[0] === null) {
      throw new TypeError('Expected one loaded catalog.');
    }

    expect(Reflect.get(catalogs[0], 'locale')).toBe('en');
  });

  test('rejects accessor-backed options without executing them', () => {
    let reads = 0;
    const options = Object.defineProperty({ root: fixtureRoot }, 'paths', {
      enumerable: true,
      get() {
        reads += 1;
        return [];
      },
    });

    expect(() => Reflect.apply(jsonFileSource, undefined, [options])).toThrowError(
      expect.objectContaining({ code: 'SOURCE_FAILED' }),
    );
    expect(reads).toBe(0);
  });

  test('preserves the configured optional-source classification', () => {
    const source = jsonFileSource({ root: fixtureRoot, paths: [], required: false });

    expect(source.name).toBe('json-file');
    expect(source.required).toBe(false);
  });
});

describe('bounded JSON file reads', () => {
  test('enforces a lowered structured-case message byte limit', async () => {
    await writeFile(
      join(fixtureRoot, 'en.json'),
      JSON.stringify({
        schema: 1,
        locale: 'en',
        messages: {
          'items.count': {
            kind: 'plural',
            parameter: 'count',
            cases: { other: 'too long' },
          },
        },
      }),
    );
    const source = jsonFileSource({
      root: fixtureRoot,
      paths: ['en.json'],
      limits: { maxMessageBytes: 3 },
    });

    await expect(source.load({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'CATALOG_LIMIT_EXCEEDED',
    });
  });

  test('rejects an already-aborted direct source load', async () => {
    const controller = new AbortController();
    controller.abort('private reason');
    const source = jsonFileSource({ root: fixtureRoot, paths: [] });

    let failure: unknown;
    try {
      await source.load({ signal: controller.signal });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({ code: 'ABORTED' });
    expect(String(failure)).not.toContain('private reason');
  });

  test('contains a revoked signal in a direct source load', async () => {
    const source = jsonFileSource({ root: fixtureRoot, paths: [] });
    const revocable = Proxy.revocable(new AbortController().signal, {});
    revocable.revoke();

    await expect(source.load({ signal: revocable.proxy })).rejects.toMatchObject({ code: 'SOURCE_FAILED' });
  });

  test('shares the aggregate byte budget across concurrent built-in sources', async () => {
    const contents = padJsonToBytes(catalogJson('en', {}), 2 * 1024 * 1024);
    const paths = Array.from({ length: 9 }, (_, index) => `catalog-${index}.json`);
    await Promise.all(paths.map((path) => writeFile(join(fixtureRoot, path), contents)));

    await expect(
      loadI18n({
        sources: [
          jsonFileSource({ root: fixtureRoot, paths: paths.slice(0, 4) }),
          jsonFileSource({ root: fixtureRoot, paths: paths.slice(4) }),
        ],
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_FAILED' });
  });
});
