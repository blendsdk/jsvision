/**
 * Implementation tests for the private tvedit clipboard adapter's narrow composition seam.
 *
 * Requirements-derived behavior lives in the immutable specification file. These cases protect
 * wrapper mechanics and dependency isolation without touching an operating-system clipboard.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, vi } from 'vitest';

import { createTveditClipboardAdapter } from '../tvedit-demo/native-clipboard.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const packagesRoot = resolve(repositoryRoot, 'packages');

/** Minimal workspace manifest shape needed for dependency-isolation checks. */
interface WorkspaceManifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}

test('factory creation is lazy and each callback invokes its matching method exactly once', async () => {
  const methods = {
    marker: 'receiver-preserved',
    read: vi.fn(async function (this: { marker: string }) {
      return this.marker;
    }),
    write: vi.fn(async function (this: { marker: string }, text: string) {
      expect(this.marker).toBe('receiver-preserved');
      expect(text).toBe('raw\r\ntext');
    }),
  };

  const adapter = createTveditClipboardAdapter(methods);

  expect(methods.read).not.toHaveBeenCalled();
  expect(methods.write).not.toHaveBeenCalled();
  await expect(adapter.readClipboardText()).resolves.toBe('receiver-preserved');
  await adapter.writeClipboardText('raw\r\ntext');
  expect(methods.read).toHaveBeenCalledOnce();
  expect(methods.write).toHaveBeenCalledOnce();
});

test('adapter exposes only the two host-neutral callback names', () => {
  const adapter = createTveditClipboardAdapter({
    read: async () => '',
    write: async () => undefined,
  });

  expect(Object.keys(adapter).sort()).toEqual(['readClipboardText', 'writeClipboardText']);
});

test('writes and reads execute in request order without a rejection poisoning later work', async () => {
  let settleFirstWrite!: () => void;
  const firstWrite = new Promise<void>((resolvePromise) => {
    settleFirstWrite = resolvePromise;
  });
  const methods = {
    read: vi.fn(async () => 'after writes'),
    write: vi
      .fn<(text: string) => Promise<void>>()
      .mockImplementationOnce(() => firstWrite)
      .mockRejectedValueOnce(new Error('second-write-failure')),
  };
  const adapter = createTveditClipboardAdapter(methods);

  const first = adapter.writeClipboardText('first');
  const second = adapter.writeClipboardText('second');
  const secondRejection = expect(second).rejects.toThrow('second-write-failure');
  const read = adapter.readClipboardText();
  expect(methods.write).not.toHaveBeenCalled();
  expect(methods.read).not.toHaveBeenCalled();

  await Promise.resolve();
  expect(methods.write).toHaveBeenCalledOnce();
  expect(methods.write).toHaveBeenNthCalledWith(1, 'first');
  expect(methods.read).not.toHaveBeenCalled();

  settleFirstWrite();
  await first;
  await secondRejection;
  await expect(read).resolves.toBe('after writes');
  expect(methods.write).toHaveBeenNthCalledWith(2, 'second');
  expect(methods.read).toHaveBeenCalledOnce();
});

test('headless entry returns before loading the native clipboard dependency', async () => {
  const source = await readFile(resolve(packageRoot, 'tvedit-demo/main.ts'), 'utf8');
  const headlessReturn = source.indexOf('return 0;');
  const nativeImport = source.indexOf("await import('clipboardy')");

  expect(headlessReturn).toBeGreaterThan(0);
  expect(nativeImport).toBeGreaterThan(headlessReturn);
  expect(source).not.toContain("import clipboardy from 'clipboardy'");
});

test('no published workspace dependency closure reaches clipboardy', async () => {
  const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const manifests = new Map<string, WorkspaceManifest>();

  for (const directory of packageDirectories) {
    const manifest = JSON.parse(
      await readFile(resolve(packagesRoot, directory, 'package.json'), 'utf8'),
    ) as WorkspaceManifest;
    if (manifest.name !== undefined) manifests.set(manifest.name, manifest);
  }

  const dependencyNames = (manifest: WorkspaceManifest): string[] =>
    [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies, manifest.optionalDependencies].flatMap(
      (section) => (section === undefined ? [] : Object.keys(section)),
    );
  const reachesClipboardy = (name: string, visited = new Set<string>()): boolean => {
    if (name === 'clipboardy') return true;
    if (visited.has(name)) return false;
    visited.add(name);
    const manifest = manifests.get(name);
    if (manifest === undefined) return false;
    return dependencyNames(manifest).some((dependency) => reachesClipboardy(dependency, visited));
  };

  const directOwners: string[] = [];
  const publishedClosures: string[] = [];
  for (const [name, manifest] of manifests) {
    const dependencySections = [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ];
    if (dependencySections.some((section) => section?.clipboardy !== undefined)) {
      directOwners.push(`${name}:${manifest.private === true ? 'private' : 'published'}`);
    }
    if (manifest.private !== true && reachesClipboardy(name)) publishedClosures.push(name);
  }

  expect(directOwners).toEqual(['@jsvision/examples:private']);
  expect(publishedClosures).toEqual([]);
});
