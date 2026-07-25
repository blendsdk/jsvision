import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { openCheckedCatalogFile, resolveCatalogPaths, validateCatalogPath } from '../src/node/paths.js';

let fixtureRoot: string;

beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'jsvision-i18n-paths-'));
});

afterEach(async () => {
  await rm(fixtureRoot, { force: true, recursive: true });
});

describe('portable catalog path grammar', () => {
  test('classifies literals and immediate globs without platform coercion', () => {
    expect(validateCatalogPath('catalogs/en.json')).toEqual({
      kind: 'literal',
      relativePath: 'catalogs/en.json',
    });
    expect(validateCatalogPath('catalogs/*.json')).toEqual({
      directory: 'catalogs',
      kind: 'glob',
      relativePath: 'catalogs/*.json',
    });
  });

  test.each([
    '',
    '/absolute.json',
    '../outside.json',
    './inside.json',
    'catalogs//en.json',
    'catalogs\\en.json',
    'catalogs/**/en.json',
    'catalogs/en?.json',
    'catalogs/[en].json',
    'catalogs/en.JSON',
    'C:/catalogs/en.json',
    'catalogs/\u001Ben.json',
  ])('rejects unsupported path %j', (path) => {
    expect(() => validateCatalogPath(path)).toThrowError(expect.objectContaining({ code: 'INVALID_PATH' }));
  });
});

describe('canonical catalog path resolution', () => {
  test('preserves literal declarations and sorts each immediate glob', async () => {
    await mkdir(join(fixtureRoot, 'catalogs'));
    await writeFile(join(fixtureRoot, 'first.json'), '{}');
    await writeFile(join(fixtureRoot, 'last.json'), '{}');
    await writeFile(join(fixtureRoot, 'catalogs', 'z.json'), '{}');
    await writeFile(join(fixtureRoot, 'catalogs', 'a.json'), '{}');
    await writeFile(join(fixtureRoot, 'catalogs', 'ignored.txt'), '{}');

    const paths = await resolveCatalogPaths(fixtureRoot, ['first.json', 'catalogs/*.json', 'last.json']);

    expect(paths.map((path) => path.relativePath)).toEqual([
      'first.json',
      'catalogs/a.json',
      'catalogs/z.json',
      'last.json',
    ]);
  });

  test('accepts an empty immediate glob', async () => {
    await mkdir(join(fixtureRoot, 'empty'));

    await expect(resolveCatalogPaths(fixtureRoot, ['empty/*.json'])).resolves.toEqual([]);
  });

  test.runIf(process.platform !== 'win32')('rejects canonical file and directory escapes', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'jsvision-i18n-paths-outside-'));
    await writeFile(join(outside, 'outside.json'), '{}');
    await symlink(join(outside, 'outside.json'), join(fixtureRoot, 'file.json'), 'file');
    await symlink(outside, join(fixtureRoot, 'directory'), 'dir');

    try {
      await expect(resolveCatalogPaths(fixtureRoot, ['file.json'])).rejects.toMatchObject({
        code: 'INVALID_PATH',
      });
      await expect(resolveCatalogPaths(fixtureRoot, ['directory/outside.json'])).rejects.toMatchObject({
        code: 'INVALID_PATH',
      });
    } finally {
      await rm(outside, { force: true, recursive: true });
    }
  });
});

describe('checked catalog handles', () => {
  test('opens and reports one canonical regular file', async () => {
    await writeFile(join(fixtureRoot, 'catalog.json'), '{"schema":1}');
    const [candidate] = await resolveCatalogPaths(fixtureRoot, ['catalog.json']);
    if (candidate === undefined) throw new TypeError('Expected one resolved fixture.');

    const checked = await openCheckedCatalogFile(candidate);
    try {
      expect(checked.size).toBe(Buffer.byteLength('{"schema":1}'));
      expect(await checked.handle.readFile({ encoding: 'utf8' })).toBe('{"schema":1}');
    } finally {
      await checked.handle.close();
    }
  });

  test('rejects a directory before attempting an open', async () => {
    await mkdir(join(fixtureRoot, 'directory.json'));
    const [candidate] = await resolveCatalogPaths(fixtureRoot, ['directory.json']);
    if (candidate === undefined) throw new TypeError('Expected one resolved fixture.');

    await expect(openCheckedCatalogFile(candidate)).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });
});
