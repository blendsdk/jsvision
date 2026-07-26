/**
 * Public specification tests for the rooted Node-only JSON catalog source.
 *
 * The tests use real filesystem objects and import only the planned Node public entry module.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { validateCatalog } from '../src/index.js';
import { jsonFileSource } from '../src/node/index.js';
import { installNodeLoaderTestHooks } from '../src/node/test-seam.js';
import {
  catalogJson,
  countedCatalogJson,
  incompleteDutchCatalog,
  keyWithScalars,
  nodeLoaderLimits,
  padJsonToBytes,
  strictJsonFailures,
  strictReferenceCatalog,
  unsafeCatalogText,
} from './fixtures/node.js';
import { deferred } from './fixtures/sources.js';

const execFileAsync = promisify(execFile);

/** Minimal validated catalog view used by filesystem-order assertions. */
interface LoadedCatalog {
  readonly schema: 1;
  readonly locale: string;
  readonly messages: Readonly<Record<string, unknown>>;
}

let fixtureRoot: string;

beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'jsvision-i18n-node-'));
});

afterEach(async () => {
  await rm(fixtureRoot, { force: true, recursive: true });
});

async function writeFixture(relativePath: string, contents: string | Uint8Array): Promise<string> {
  const absolute = join(fixtureRoot, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, contents);
  return absolute;
}

/** Check the public catalog shape without coercing an unknown loader result. */
function isLoadedCatalog(value: unknown): value is LoadedCatalog {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    Reflect.get(value, 'schema') === 1 &&
    typeof Reflect.get(value, 'locale') === 'string' &&
    typeof Reflect.get(value, 'messages') === 'object'
  );
}

/** Normalize the source's single-or-list contract after validating the observed test value. */
function asCatalogs(value: unknown): readonly LoadedCatalog[] {
  const values: readonly unknown[] = Array.isArray(value) ? value : [value];
  if (!values.every(isLoadedCatalog)) {
    throw new TypeError('The Node source returned a value outside the public catalog contract.');
  }
  return values;
}

async function loadPaths(
  paths: readonly string[],
  signal = new AbortController().signal,
): Promise<readonly LoadedCatalog[]> {
  const source = jsonFileSource({ root: fixtureRoot, paths });
  return asCatalogs(await source.load({ signal }));
}

describe('rooted deterministic paths', () => {
  test('keeps literal order and sorts each immediate glob lexically', async () => {
    await writeFixture('literal-b.json', catalogJson('en', { 'order.value': 'literal-b' }));
    await writeFixture('literal-a.json', catalogJson('en', { 'order.value': 'literal-a' }));
    await writeFixture('locales/z.json', catalogJson('en', { 'order.value': 'glob-z' }));
    await writeFixture('locales/a.json', catalogJson('en', { 'order.value': 'glob-a' }));

    const catalogs = await loadPaths(['literal-b.json', 'locales/*.json', 'literal-a.json']);

    expect(catalogs.map((catalog) => catalog.messages['order.value'])).toEqual([
      'literal-b',
      'glob-a',
      'glob-z',
      'literal-a',
    ]);
  });

  test('fails a missing literal but accepts an empty immediate glob', async () => {
    await mkdir(join(fixtureRoot, 'empty'));

    await expect(loadPaths(['missing.json'])).rejects.toBeDefined();
    await expect(loadPaths(['empty/*.json'])).resolves.toEqual([]);
  });

  test.each([
    ['absolute path', resolve('outside.json')],
    ['parent traversal', '../outside.json'],
    ['current-directory segment', './inside.json'],
    ['empty segment', 'locales//inside.json'],
    ['backslash', 'locales\\inside.json'],
    ['recursive glob', 'locales/**/*.json'],
    ['question wildcard', 'locales/file?.json'],
    ['character-class wildcard', 'locales/[ab].json'],
    ['wrong suffix', 'locales/catalog.txt'],
  ])('rejects an invalid %s before attempting catalog parsing', async (_label, path) => {
    await expect(loadPaths([path])).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });

  test.runIf(process.platform !== 'win32')(
    'rejects a canonical sibling-prefix escape rather than trusting a string prefix',
    async () => {
      const sibling = `${fixtureRoot}-sibling`;
      await mkdir(sibling);
      await writeFile(join(sibling, 'secret.json'), 'not valid JSON');
      await symlink(sibling, join(fixtureRoot, 'linked-sibling'), 'dir');

      try {
        await expect(loadPaths(['linked-sibling/secret.json'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
      } finally {
        await rm(sibling, { force: true, recursive: true });
      }
    },
  );
});

describe('canonical containment and regular files', () => {
  test.runIf(process.platform !== 'win32')('rejects file and nested-directory symlink escapes', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'jsvision-i18n-outside-'));
    await writeFile(join(outside, 'catalog.json'), catalogJson('en', { 'outside.value': 'outside' }));
    await symlink(join(outside, 'catalog.json'), join(fixtureRoot, 'file-link.json'), 'file');
    await symlink(outside, join(fixtureRoot, 'directory-link'), 'dir');

    try {
      await expect(loadPaths(['file-link.json'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
      await expect(loadPaths(['directory-link/catalog.json'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    } finally {
      await rm(outside, { force: true, recursive: true });
    }
  });

  test('rejects a directory even when its name ends in json', async () => {
    await mkdir(join(fixtureRoot, 'directory.json'));

    await expect(loadPaths(['directory.json'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });

  test.runIf(process.platform !== 'win32')('rejects a FIFO as a non-regular input where supported', async () => {
    const fifo = join(fixtureRoot, 'catalog.json');
    await execFileAsync('mkfifo', [fifo]);

    await expect(loadPaths(['catalog.json'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });

  test('honors an already-aborted load without publishing a catalog', async () => {
    await writeFixture('catalog.json', catalogJson('en', { 'app.title': 'Title' }));
    const controller = new AbortController();
    controller.abort();

    await expect(loadPaths(['catalog.json'], controller.signal)).rejects.toMatchObject({ code: 'ABORTED' });
  });

  test.runIf(process.platform !== 'win32')(
    'rejects a replacement after opening or safely reads the already-checked handle',
    async () => {
      const candidate = await writeFixture('candidate.json', catalogJson('en', { 'race.value': 'checked' }));
      const replacement = await writeFixture('replacement.json', catalogJson('en', { 'race.value': 'replacement' }));
      const opened = deferred<void>();
      const resume = deferred<void>();
      const restore = installNodeLoaderTestHooks({
        async afterOpen() {
          opened.resolve();
          await resume.promise;
        },
      });

      try {
        const loading = loadPaths(['candidate.json']);
        await opened.promise;
        await rename(replacement, candidate);
        resume.resolve();

        try {
          const [catalog] = await loading;
          expect(catalog?.messages['race.value']).toBe('checked');
        } catch (error) {
          expect(error).toMatchObject({ code: 'INVALID_PATH' });
        }
      } finally {
        resume.resolve();
        restore();
      }
    },
  );
});

describe('strict JSON and fatal UTF-8', () => {
  test.each(strictJsonFailures)('rejects $label', async ({ expectedCode, json }) => {
    await writeFixture('invalid.json', json);

    await expect(loadPaths(['invalid.json'])).rejects.toMatchObject({ code: expectedCode });
  });

  test.each([
    ['UTF-8 BOM', Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from(catalogJson('en', {}))])],
    ['ill-formed UTF-8', Uint8Array.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x7d])],
  ])('rejects %s before catalog publication', async (_label, bytes) => {
    await writeFixture('invalid.json', bytes);

    await expect(loadPaths(['invalid.json'])).rejects.toMatchObject({ code: 'INVALID_UTF8' });
  });

  test.each(unsafeCatalogText)('rejects unsafe catalog text $label atomically', async ({ expectedCode, value }) => {
    await writeFixture('unsafe.json', catalogJson('en', { 'app.safe': 'safe', 'app.unsafe': value }));

    await expect(loadPaths(['unsafe.json'])).rejects.toMatchObject({ code: expectedCode });
  });

  test('accepts ordinary Unicode and LF line breaks', async () => {
    await writeFixture('safe.json', catalogJson('en', { 'app.text': 'Zażółć 😀\nsecond line' }));

    const [catalog] = await loadPaths(['safe.json']);

    expect(catalog?.messages['app.text']).toBe('Zażółć 😀\nsecond line');
  });
});

describe('hard resource boundaries', () => {
  test('accepts a file at two MiB and rejects one byte over before parsing', async () => {
    const minimal = catalogJson('en', {});
    await writeFixture('at-limit.json', padJsonToBytes(minimal, nodeLoaderLimits.fileBytes));
    await writeFixture('over-limit.json', padJsonToBytes(minimal, nodeLoaderLimits.fileBytes + 1));

    await expect(loadPaths(['at-limit.json'])).resolves.toHaveLength(1);
    await expect(loadPaths(['over-limit.json'])).rejects.toMatchObject({ code: 'CATALOG_LIMIT_EXCEEDED' });
  });

  test('accepts exactly ten thousand messages and rejects one more', async () => {
    await writeFixture('at-limit.json', countedCatalogJson(nodeLoaderLimits.messages));
    await writeFixture('over-limit.json', countedCatalogJson(nodeLoaderLimits.messages + 1));

    await expect(loadPaths(['at-limit.json'])).resolves.toHaveLength(1);
    await expect(loadPaths(['over-limit.json'])).rejects.toMatchObject({ code: 'CATALOG_LIMIT_EXCEEDED' });
  });

  test('accepts a 512-scalar key and rejects one scalar more', async () => {
    const acceptedKey = keyWithScalars(nodeLoaderLimits.keyScalars);
    const rejectedKey = keyWithScalars(nodeLoaderLimits.keyScalars + 1);
    await writeFixture('at-limit.json', catalogJson('en', { [acceptedKey]: 'value' }));
    await writeFixture('over-limit.json', catalogJson('en', { [rejectedKey]: 'value' }));

    await expect(loadPaths(['at-limit.json'])).resolves.toHaveLength(1);
    await expect(loadPaths(['over-limit.json'])).rejects.toMatchObject({ code: 'CATALOG_LIMIT_EXCEEDED' });
  });

  test('accepts a 65,536-byte message and rejects one byte more', async () => {
    await writeFixture(
      'at-limit.json',
      catalogJson('en', { 'app.message': 'x'.repeat(nodeLoaderLimits.messageBytes) }),
    );
    await writeFixture(
      'over-limit.json',
      catalogJson('en', { 'app.message': 'x'.repeat(nodeLoaderLimits.messageBytes + 1) }),
    );

    await expect(loadPaths(['at-limit.json'])).resolves.toHaveLength(1);
    await expect(loadPaths(['over-limit.json'])).rejects.toMatchObject({ code: 'CATALOG_LIMIT_EXCEEDED' });
  });

  test('allows every caller limit to be lowered but never raised above its hard maximum', async () => {
    const smallCatalog = catalogJson('en', { 'app.title': 'Title' });
    await writeFixture('small.json', `${smallCatalog} `);

    const lowered = jsonFileSource({
      root: fixtureRoot,
      paths: ['small.json'],
      limits: {
        maxFileBytes: Buffer.byteLength(smallCatalog),
        maxKeyScalars: nodeLoaderLimits.keyScalars - 1,
        maxMessageBytes: nodeLoaderLimits.messageBytes - 1,
        maxMessages: nodeLoaderLimits.messages - 1,
      },
    });
    await expect(lowered.load({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'CATALOG_LIMIT_EXCEEDED',
    });

    for (const limits of [
      { maxFileBytes: nodeLoaderLimits.fileBytes + 1 },
      { maxKeyScalars: nodeLoaderLimits.keyScalars + 1 },
      { maxMessageBytes: nodeLoaderLimits.messageBytes + 1 },
      { maxMessages: nodeLoaderLimits.messages + 1 },
    ]) {
      await expect(async () => {
        const source = jsonFileSource({ root: fixtureRoot, paths: ['small.json'], limits });
        await source.load({ signal: new AbortController().signal });
      }).rejects.toMatchObject({ code: 'CATALOG_LIMIT_EXCEEDED' });
    }
  });
});

describe('strict completeness and accelerators', () => {
  test('reports stable missing, extra, kind, placeholder, and accelerator issues', () => {
    const issues = validateCatalog(incompleteDutchCatalog, {
      mode: 'strict',
      referenceCatalog: strictReferenceCatalog,
      placeholderManifest: {
        'dialog.open': ['name'],
        'dialog.save': [],
        'items.count': ['count'],
        'status.label': [],
      },
      acceleratorManifest: {
        scopes: [
          {
            name: 'dialog',
            keys: ['dialog.open', 'dialog.save'],
          },
        ],
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_PARAMETER',
          path: ['messages', 'dialog.open', 'placeholders'],
        }),
        expect.objectContaining({
          code: 'INVALID_MESSAGE',
          path: ['messages', 'dialog.save', 'accelerator'],
          severity: 'error',
        }),
        expect.objectContaining({
          code: 'INVALID_MESSAGE',
          path: ['messages', 'items.count', 'kind'],
        }),
        expect.objectContaining({
          code: 'INVALID_PARAMETER',
          path: ['messages', 'items.count', 'placeholders'],
        }),
        expect.objectContaining({
          code: 'INVALID_CATALOG',
          path: ['messages', 'status.label'],
        }),
        expect.objectContaining({
          code: 'INVALID_CATALOG',
          path: ['messages', 'extra.label'],
        }),
      ]),
    );
  });

  test('reports locale-invalid plural categories and missing other at stable paths', () => {
    const issues = validateCatalog(
      {
        schema: 1,
        locale: 'en',
        messages: {
          'items.count': {
            kind: 'plural',
            parameter: 'count',
            cases: { few: 'Few' },
          },
        },
      },
      { mode: 'strict' },
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_MESSAGE',
          path: ['messages', 'items.count', 'cases', 'few'],
        }),
        expect.objectContaining({
          code: 'INVALID_MESSAGE',
          path: ['messages', 'items.count', 'cases', 'other'],
        }),
      ]),
    );
  });
});
