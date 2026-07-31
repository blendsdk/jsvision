/**
 * Specification tests for the live-example registry architecture.
 *
 * The registry must remain lazy and family-sharded as the documentation grows.
 * Runnable files stay under `examples/`; shared fixtures and builders do not,
 * which keeps source parity exact and prevents helpers from becoming examples.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES_ROOT = join(PACKAGE_ROOT, 'examples');
const REGISTRY_ROOT = join(PACKAGE_ROOT, 'src', 'example-registry');
const REGISTRY_INDEX = join(REGISTRY_ROOT, 'index.ts');
const PUBLIC_INDEX = join(EXAMPLES_ROOT, 'index.ts');
const PAINT_SPEC = join(PACKAGE_ROOT, 'test', 'paint-smoke.spec.test.ts');
const NON_RUNNABLE_FILES = new Set(['_contract.ts', 'index.ts']);

interface RegistryEntry {
  readonly id: string;
  readonly sourcePath: string;
  readonly load: () => Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRegistryEntry(value: unknown): value is RegistryEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sourcePath === 'string' &&
    typeof value.load === 'function'
  );
}

/** Return recursively discovered TypeScript files as package-relative POSIX paths. */
async function typescriptFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await typescriptFiles(absolute)));
    } else if (entry.name.endsWith('.ts')) {
      files.push(relative(PACKAGE_ROOT, absolute).split(sep).join('/'));
    }
  }
  return files.sort();
}

async function runnableExampleFiles(): Promise<readonly string[]> {
  return (await typescriptFiles(EXAMPLES_ROOT)).filter(
    (path) => !NON_RUNNABLE_FILES.has(path.slice(path.lastIndexOf('/') + 1)),
  );
}

async function loadPublicRegistry(): Promise<readonly RegistryEntry[]> {
  const modulePath = '../examples/index.js';
  const candidate: unknown = await import(modulePath);
  if (!isRecord(candidate) || !Array.isArray(candidate.EXAMPLES) || !candidate.EXAMPLES.every(isRegistryEntry)) {
    throw new TypeError('examples/index.ts must export a typed EXAMPLES array');
  }
  return candidate.EXAMPLES;
}

describe('family-sharded example registry', () => {
  test('the public index is aggregation wiring rather than a descriptor monolith', async () => {
    const [publicIndex, familyIndex, registryFiles] = await Promise.all([
      readFile(PUBLIC_INDEX, 'utf8'),
      readFile(REGISTRY_INDEX, 'utf8'),
      typescriptFiles(REGISTRY_ROOT),
    ]);
    const familyModules = registryFiles.filter((path) => !path.endsWith('/index.ts'));

    expect(familyModules.length).toBeGreaterThanOrEqual(3);
    expect(publicIndex).toMatch(/src\/example-registry/);
    expect(publicIndex).not.toMatch(/\bload:\s*\(\)\s*=>\s*import\(/);
    for (const modulePath of familyModules) {
      const basename = modulePath.slice(modulePath.lastIndexOf('/') + 1).replace(/\.ts$/, '');
      expect(familyIndex, `aggregate omits ${basename}`).toContain(`./${basename}.js`);
    }
  });

  test('every runnable source maps to exactly one lazy registry entry', async () => {
    const [files, entries] = await Promise.all([runnableExampleFiles(), loadPublicRegistry()]);
    const sourcePaths = entries.map((entry) => entry.sourcePath).sort();

    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(new Set(sourcePaths).size).toBe(sourcePaths.length);
    expect(sourcePaths).toEqual(files);
  });

  test('shared helpers and fixtures stay outside the recursively scanned examples tree', async () => {
    const files = await typescriptFiles(EXAMPLES_ROOT);
    expect(files.filter((path) => /\/(?:fixtures?|helpers?)\//.test(path))).toEqual([]);
  });

  test('paint smoke defines one independently named case per registry entry', async () => {
    const source = await readFile(PAINT_SPEC, 'utf8');

    expect(source).toMatch(/(?:test|it)\.each\s*\(\s*EXAMPLES\s*\)/);
    expect(source).toMatch(/\$(?:id|sourcePath)|%s/);
    expect(source).not.toMatch(/for\s*\(\s*const\s+\w+\s+of\s+EXAMPLES\s*\)/);
  });
});
