import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Absolute package root used by static boundary checks. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Absolute monorepo root that owns the lockstep workspace version. */
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, '../..');
/** Absolute production source root used by bounded import traversal. */
const SOURCE_ROOT = join(PACKAGE_ROOT, 'src');
/** Safety ceiling that turns accidental graph cycles or expansion into a clear failure. */
const MAX_GRAPH_FILES = 512;
/** Exact locale entry points promised by the first public package boundary. */
const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'] as const;

/** A JSON object whose values remain untrusted until each assertion narrows them. */
interface JsonObject {
  readonly [key: string]: unknown;
}

/** Describes one public conditional export with declaration and ESM runtime targets. */
interface PublicExport {
  readonly types: string;
  readonly import: string;
}

/** Returns true when a value is a non-null, non-array object. */
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a JSON object and fails with the artifact path when its root has the wrong shape. */
function readJsonObject(path: string): JsonObject {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isJsonObject(parsed)) throw new Error(`${path} must contain a JSON object`);
  return parsed;
}

/** Narrows a required object member while preserving a useful failure message. */
function requireObject(parent: JsonObject, key: string): JsonObject {
  const value = parent[key];
  if (!isJsonObject(value)) throw new Error(`package.json field ${key} must be an object`);
  return value;
}

/** Narrows a public export target to its exact declaration and runtime pair. */
function requirePublicExport(exports: JsonObject, key: string): PublicExport {
  const target = requireObject(exports, key);
  if (typeof target.types !== 'string' || typeof target.import !== 'string') {
    throw new Error(`package export ${key} must define string types and import targets`);
  }
  return { types: target.types, import: target.import };
}

/** Extracts static relative and package imports from an ESM TypeScript module. */
function readImportSpecifiers(path: string): readonly string[] {
  const source = readFileSync(path, 'utf8');
  const specifiers = new Set<string>();
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/gu;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1];
    if (specifier !== undefined) specifiers.add(specifier);
  }
  return [...specifiers].sort();
}

/** Resolves a relative ESM source import without allowing it to escape the package source tree. */
function resolveSourceImport(importer: string, specifier: string): string {
  const unresolved = resolve(dirname(importer), specifier);
  const candidates = extname(unresolved)
    ? [unresolved.replace(/\.js$/u, '.ts')]
    : [`${unresolved}.ts`, join(unresolved, 'index.ts')];
  const target = candidates.find((candidate) => existsSync(candidate));
  if (target === undefined) throw new Error(`unresolved source import ${specifier} from ${importer}`);

  const canonicalRoot = realpathSync(SOURCE_ROOT);
  const canonicalTarget = realpathSync(target);
  const fromRoot = relative(canonicalRoot, canonicalTarget);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`source import ${specifier} escapes the package source tree`);
  }
  return canonicalTarget;
}

/** Traverses the public production graph with a fixed file ceiling to prevent accidental runaway work. */
function collectProductionGraph(entry: string): readonly string[] {
  const pending = [realpathSync(entry)];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.shift();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    if (visited.size > MAX_GRAPH_FILES) {
      throw new Error(`production import graph exceeds ${MAX_GRAPH_FILES} files`);
    }

    for (const specifier of readImportSpecifiers(current)) {
      if (specifier.startsWith('.')) pending.push(resolveSourceImport(current, specifier));
    }
  }

  return [...visited].sort();
}

/** Lists TypeScript files below a directory in deterministic order. */
function listTypeScriptFiles(directory: string): readonly string[] {
  const files: string[] = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.shift();
    if (current === undefined) continue;
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && path.endsWith('.ts')) {
        files.push(path);
        if (files.length > MAX_GRAPH_FILES) {
          throw new Error(`package source tree exceeds ${MAX_GRAPH_FILES} TypeScript files`);
        }
      }
    }
  }
  return files;
}

describe('Kanban package boundary', () => {
  it('should publish as an aligned public ESM package for Node 22 and later', () => {
    const manifest = readJsonObject(join(PACKAGE_ROOT, 'package.json'));
    const workspaceManifest = readJsonObject(join(REPOSITORY_ROOT, 'package.json'));
    const workspaceVersion = workspaceManifest.version;

    expect(typeof workspaceVersion).toBe('string');

    expect(manifest).toMatchObject({
      name: '@jsvision/kanban',
      version: workspaceVersion,
      type: 'module',
      sideEffects: false,
      types: './dist/index.d.ts',
      license: 'MIT',
      homepage: 'https://github.com/blendsdk/jsvision#readme',
      bugs: 'https://github.com/blendsdk/jsvision/issues',
      author: 'TrueSoftware B.V. <gevik@truesoftware.nl>',
      publishConfig: { access: 'public' },
      engines: { node: '>=22' },
      repository: {
        type: 'git',
        url: 'git+https://github.com/blendsdk/jsvision.git',
        directory: 'packages/kanban',
      },
    });
    expect(manifest.files).toEqual(['dist', 'README.md', 'CHANGELOG.md', 'LICENSE']);
  });

  it('should expose only the main, testing, and ten locale entry points', () => {
    const manifest = readJsonObject(join(PACKAGE_ROOT, 'package.json'));
    const exports = requireObject(manifest, 'exports');
    const expectedKeys = ['.', './testing', ...LOCALES.map((locale) => `./locales/${locale}`)];

    expect(Object.keys(exports).sort()).toEqual([...expectedKeys].sort());
    expect(requirePublicExport(exports, '.')).toEqual({
      types: './dist/index.d.ts',
      import: './dist/index.js',
    });
    expect(requirePublicExport(exports, './testing')).toEqual({
      types: './dist/testing.d.ts',
      import: './dist/testing.js',
    });
    for (const locale of LOCALES) {
      expect(requirePublicExport(exports, `./locales/${locale}`)).toEqual({
        types: `./dist/locales/${locale}.d.ts`,
        import: `./dist/locales/${locale}.js`,
      });
    }

    expect(exports['./model']).toBeUndefined();
    expect(exports['./dialogs']).toBeUndefined();
    expect(exports['./src/*']).toBeUndefined();
    expect(exports['./*']).toBeUndefined();
  });

  it('should provide the exact specialist-package verification scripts', () => {
    const manifest = readJsonObject(join(PACKAGE_ROOT, 'package.json'));
    const scripts = requireObject(manifest, 'scripts');

    expect(scripts).toEqual({
      build: 'tsc',
      typecheck: 'tsc --noEmit -p tsconfig.typecheck.json',
      test: 'vitest run --project unit',
      'test:e2e': 'vitest run --project e2e',
      'check:deps': 'node ../../scripts/check-no-native-deps.mjs .',
      'check:docs': 'node ../../scripts/check-jsdoc.mjs .',
    });
    expect(String(scripts['test:e2e'])).not.toContain('--passWithNoTests');
  });

  it('should keep the Phase A runtime dependency surface exact and workspace-aligned', () => {
    const manifest = readJsonObject(join(PACKAGE_ROOT, 'package.json'));
    const workspaceManifest = readJsonObject(join(REPOSITORY_ROOT, 'package.json'));
    const workspaceVersion = workspaceManifest.version;
    const dependencies = requireObject(manifest, 'dependencies');
    const devDependencies = requireObject(manifest, 'devDependencies');
    const peerDependencies = manifest.peerDependencies;

    expect(dependencies).toEqual({
      '@jsvision/core': workspaceVersion,
      '@jsvision/i18n': workspaceVersion,
      '@jsvision/ui': workspaceVersion,
    });
    expect(dependencies.zod).toBeUndefined();
    expect(dependencies['@jsvision/forms']).toBeUndefined();
    expect(isJsonObject(peerDependencies) ? peerDependencies.zod : undefined).toBeUndefined();
    expect(isJsonObject(peerDependencies) ? peerDependencies['@jsvision/forms'] : undefined).toBeUndefined();
    expect(devDependencies.vitest).toMatch(/^\^4\./u);
    expect(devDependencies['@types/node']).toBeDefined();

    for (const dependency of Object.keys(dependencies)) {
      expect(dependency.startsWith('node:')).toBe(false);
    }
  });

  it('should keep testing modules outside the production entry import graph', () => {
    const graph = collectProductionGraph(join(SOURCE_ROOT, 'index.ts'));
    const relativeGraph = graph.map((path) => normalize(relative(SOURCE_ROOT, path)).replaceAll(sep, '/'));

    expect(relativeGraph).not.toContain('testing.ts');
    expect(relativeGraph.some((path) => path.startsWith('testing/'))).toBe(false);
    expect(relativeGraph.some((path) => path.includes('/test/fixtures/'))).toBe(false);
  });

  it('should keep production leaf modules independent from the public package barrel', () => {
    const productionFiles = listTypeScriptFiles(SOURCE_ROOT).filter((path) => {
      const fromSource = normalize(relative(SOURCE_ROOT, path)).replaceAll(sep, '/');
      return fromSource !== 'testing.ts' && !fromSource.startsWith('testing/');
    });

    for (const path of productionFiles) {
      const selfImports = readImportSpecifiers(path).filter(
        (specifier) => specifier === '@jsvision/kanban' || specifier.startsWith('@jsvision/kanban/'),
      );
      expect(selfImports, `${relative(PACKAGE_ROOT, path)} must import production leaf modules directly`).toEqual([]);
    }
  });
});
