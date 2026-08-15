import { execFileSync } from 'node:child_process';
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
/** Canonical source-impact routing manifest used by the generated JSVision skill. */
const PLUGIN_IMPACT_PATH = join(REPOSITORY_ROOT, 'tools', 'jsvision-plugin-impact.json');
/** Public values that represent every Phase D productivity concern in generated API guidance. */
const PHASE_D_API_VALUES = Object.freeze([
  'createKanbanViewController',
  'captureKanbanSavedView',
  'createStandardKanbanEditorAdapter',
  'openKanbanCardCreateDialog',
  'openKanbanColumnConfigurationDialog',
  'createKanbanActionRegistry',
  'createKanbanEventHub',
  'createKanbanHistoryBinding',
]);
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

  // The standard editor owns Forms at runtime while generic contracts keep Zod behind one compatible peer.
  it('should keep the editor dependency surface exact and workspace-aligned', () => {
    const manifest = readJsonObject(join(PACKAGE_ROOT, 'package.json'));
    const workspaceManifest = readJsonObject(join(REPOSITORY_ROOT, 'package.json'));
    const workspaceVersion = workspaceManifest.version;
    const dependencies = requireObject(manifest, 'dependencies');
    const devDependencies = requireObject(manifest, 'devDependencies');
    const peerDependencies = manifest.peerDependencies;

    expect(dependencies).toEqual({
      '@jsvision/core': workspaceVersion,
      '@jsvision/forms': workspaceVersion,
      '@jsvision/i18n': workspaceVersion,
      '@jsvision/ui': workspaceVersion,
    });
    expect(dependencies.zod).toBeUndefined();
    expect(peerDependencies).toEqual({ zod: '^4' });
    expect(isJsonObject(peerDependencies) ? peerDependencies['@jsvision/forms'] : undefined).toBeUndefined();
    expect(devDependencies.vitest).toMatch(/^\^4\./u);
    expect(devDependencies.zod).toMatch(/^\^4\./u);
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

  // Public source documentation must stay usable without access to repository planning artifacts.
  it('should pass the public JSDoc and example contract through the repository documentation guard', () => {
    expect(() =>
      execFileSync(process.execPath, [join(REPOSITORY_ROOT, 'scripts', 'check-jsdoc.mjs'), PACKAGE_ROOT, '--summary'], {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 1_048_576,
        windowsHide: true,
      }),
    ).not.toThrow();
  });

  // Source, package, architecture, examples, and API changes must all report the Kanban guidance they affect.
  it('should route the complete Kanban delivery surface through plugin impact', () => {
    const impact = readJsonObject(PLUGIN_IMPACT_PATH);
    const areas = impact.areas;
    if (!Array.isArray(areas)) throw new Error('plugin impact manifest must define an areas array');
    const kanbanArea = areas.find((area) => isJsonObject(area) && area.name === 'kanban');
    if (!isJsonObject(kanbanArea) || !Array.isArray(kanbanArea.paths) || !Array.isArray(kanbanArea.references)) {
      throw new Error('plugin impact manifest must define one complete Kanban area');
    }

    expect(kanbanArea.paths).toEqual(
      expect.arrayContaining([
        'packages/kanban/src',
        'packages/kanban/package.json',
        'packages/kanban/README.md',
        'packages/examples/kanban-showcase',
        'packages/examples/github-project-kanban',
        'packages/docs-site/api/kanban',
        'docs/architecture/kanban.md',
        'docs/architecture/api-design.md',
        'docs/architecture/data-model.md',
        'docs/architecture/security.md',
      ]),
    );
    expect(kanbanArea.references).toEqual(
      expect.arrayContaining([
        'references/architecture.md',
        'references/component-catalog.md',
        'references/api/kanban.md',
      ]),
    );
  });

  // Generated API lookup must expose each supported productivity layer from the canonical main entry.
  it('should keep Phase D public exports present in canonical and generated plugin API references', () => {
    const canonical = readFileSync(join(REPOSITORY_ROOT, 'tools/jsvision-skill/references/api/kanban.md'), 'utf8');
    const generated = readFileSync(
      join(REPOSITORY_ROOT, 'plugins/jsvision-plugin/skills/jsvision/references/api/kanban.md'),
      'utf8',
    );

    expect(generated).toBe(canonical);
    for (const publicValue of PHASE_D_API_VALUES) {
      expect(canonical, `missing canonical API entry for ${publicValue}`).toContain(`## ${publicValue}`);
    }
  });

  // The package README is the first consumer guide and must teach every supported productivity layer.
  it('should document current view, editing, configuration, action, event, and history usage in the package README', () => {
    const readme = readFileSync(join(PACKAGE_ROOT, 'README.md'), 'utf8');
    for (const publicValue of PHASE_D_API_VALUES) {
      expect(readme, `README must teach ${publicValue}`).toContain(publicValue);
    }
    expect(readme).toMatch(/application-owned[\s\S]*saved view/iu);
    expect(readme).toMatch(/configuration[\s\S]*(?:column|swimlane)[\s\S]*dialog/iu);
  });

  // Architecture overview must describe the shipped composition and dependency topology, not an older phase boundary.
  it('should describe the current Phase D package composition in Kanban architecture', () => {
    const architecture = readFileSync(join(REPOSITORY_ROOT, 'docs/architecture/kanban.md'), 'utf8');

    expect(architecture).toContain('@jsvision/forms');
    expect(architecture).toContain('KanbanViewController');
    expect(architecture).toContain('KanbanEventHub');
    expect(architecture).toContain('KanbanHistoryBinding');
    expect(architecture).toMatch(/editor[\s\S]*configuration[\s\S]*action/iu);
    expect(architecture).not.toMatch(/editors, commands, and product documentation planned/iu);
  });

  // API design must present the exported productivity layers as current authority-safe surfaces.
  it('should describe the current Phase D public topology in API architecture', () => {
    const apiDesign = readFileSync(join(REPOSITORY_ROOT, 'docs/architecture/api-design.md'), 'utf8');

    for (const concept of [
      'KanbanViewController',
      'KanbanCardEditorAdapter',
      'KanbanConfigurationSession',
      'KanbanActionRegistry',
      'KanbanEventHub',
      'KanbanHistoryBinding',
    ]) {
      expect(apiDesign, `API architecture must describe ${concept}`).toContain(concept);
    }
    expect(apiDesign).not.toMatch(/commands, editors, saved-view codecs[^\n]*planned/iu);
    expect(apiDesign).not.toMatch(/commands and package-owned[\s\S]*dialogs remain deferred/iu);
  });

  // Data and security references must teach the ownership and redaction boundaries of current persisted and async state.
  it('should document Phase D data ownership and security boundaries', () => {
    const dataModel = readFileSync(join(REPOSITORY_ROOT, 'docs/architecture/data-model.md'), 'utf8');
    const security = readFileSync(join(REPOSITORY_ROOT, 'docs/architecture/security.md'), 'utf8');

    for (const concept of ['View state', 'Editor session', 'Configuration session', 'Event', 'History']) {
      expect(dataModel, `data model must describe ${concept}`).toContain(concept);
    }
    expect(dataModel).not.toMatch(/saved-view codecs remain a later phase/iu);
    expect(security).toMatch(/saved view[\s\S]*(?:bounded|limit|exact|validate)/iu);
    expect(security).toMatch(/editor[\s\S]*(?:draft|field)[\s\S]*(?:redact|never|without)/iu);
    expect(security).toMatch(/event[\s\S]*(?:record|draft|token)[\s\S]*(?:redact|never|without)/iu);
  });
});
