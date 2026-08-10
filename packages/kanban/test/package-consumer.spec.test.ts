import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Absolute path to the package whose real tarball is exercised. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Absolute repository path used only to locate the pinned offline toolchain and dependencies. */
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, '..', '..');
/** Authored fixture copied into the isolated consumer. */
const FIXTURE_ROOT = join(PACKAGE_ROOT, 'test', 'fixtures', 'packed-consumer');
/** Bound for each packaging, extraction, typecheck, or runtime command. */
const COMMAND_TIMEOUT_MS = 60_000;
/** Bound for captured child-process output. */
const MAX_COMMAND_OUTPUT_BYTES = 1_048_576;
/** Runtime workspace packages npm would install for a published Kanban consumer. */
const WORKSPACE_DEPENDENCIES = Object.freeze(['core', 'i18n', 'ui']);
/** Declaration-only dependencies required by Core's host-facing public types. */
const TYPE_DEPENDENCIES = Object.freeze([
  { source: ['@types', 'node'], destination: ['@types', 'node'] },
  { source: ['undici-types'], destination: ['undici-types'] },
]);
/** Exact locale subpaths and the stable foundation plus additive overlay symbols each must expose. */
const LOCALES = Object.freeze([
  ['en', 'kanbanEn', 'kanbanPhaseBEn'],
  ['nl', 'kanbanNl', 'kanbanPhaseBNl'],
  ['de', 'kanbanDe', 'kanbanPhaseBDe'],
  ['fr', 'kanbanFr', 'kanbanPhaseBFr'],
  ['es', 'kanbanEs', 'kanbanPhaseBEs'],
  ['it', 'kanbanIt', 'kanbanPhaseBIt'],
  ['pt-PT', 'kanbanPtPT', 'kanbanPhaseBPtPT'],
  ['pl', 'kanbanPl', 'kanbanPhaseBPl'],
  ['ro', 'kanbanRo', 'kanbanPhaseBRo'],
  ['sv', 'kanbanSv', 'kanbanPhaseBSv'],
] as const);

/** Defensively narrowed subset of one `npm pack --json` result. */
interface PackResult {
  readonly filename: string;
  readonly files: readonly string[];
}

/** Narrows parsed package metadata without bypassing TypeScript's safety checks. */
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Runs a bounded command directly, without a shell or implicit dependency installation. */
function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true,
  });
}

/** Parses bounded npm output and rejects ambiguous or path-shaped tarball names. */
function parsePackResult(output: string): PackResult {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('npm pack did not return a JSON array');
  const parsed: unknown = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isObject(parsed[0])) {
    throw new Error('npm pack must return exactly one package result');
  }
  const filename = parsed[0].filename;
  const fileEntries = parsed[0].files;
  if (
    typeof filename !== 'string' ||
    basename(filename) !== filename ||
    !filename.endsWith('.tgz') ||
    !Array.isArray(fileEntries)
  ) {
    throw new Error('npm pack returned unsafe package metadata');
  }
  const files = fileEntries.map((entry) => {
    if (!isObject(entry) || typeof entry.path !== 'string') {
      throw new Error('npm pack returned an invalid file entry');
    }
    return entry.path;
  });
  return { filename, files };
}

/** Packs a real package without lifecycle scripts and validates the tarball destination. */
function packInto(destination: string, packageRoot = PACKAGE_ROOT): PackResult {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = parsePackResult(
    run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], packageRoot),
  );
  const tarball = join(destination, result.filename);
  if (!existsSync(tarball) || realpathSync(dirname(tarball)) !== realpathSync(destination)) {
    throw new Error('npm pack tarball escaped its bounded destination');
  }
  return result;
}

/** Extracts one real dependency tarball into the isolated consumer's node_modules tree. */
function installPackedPackage(
  work: string,
  consumer: string,
  packageRoot: string,
  destination: readonly string[],
): void {
  const pack = packInto(work, packageRoot);
  const installedPackage = join(consumer, 'node_modules', ...destination);
  mkdirSync(installedPackage, { recursive: true });
  const tar = process.platform === 'win32' ? 'tar.exe' : 'tar';
  run(tar, ['-xzf', join(work, pack.filename), '-C', installedPackage, '--strip-components=1'], work);
}

/** Installs one linked workspace dependency from its own packed artifact. */
function installWorkspaceDependency(work: string, consumer: string, packageName: string): void {
  const source = realpathSync(join(REPOSITORY_ROOT, 'node_modules', '@jsvision', packageName));
  installPackedPackage(work, consumer, source, ['@jsvision', packageName]);
}

/** Creates an offline consumer containing only extracted publish artifacts and pinned type support. */
function prepareConsumer(work: string, pack: PackResult): string {
  const consumer = join(work, 'consumer');
  mkdirSync(consumer, { recursive: true });
  cpSync(join(FIXTURE_ROOT, 'package.json'), join(consumer, 'package.json'));
  cpSync(join(FIXTURE_ROOT, 'tsconfig.json'), join(consumer, 'tsconfig.json'));
  const installedPackage = join(consumer, 'node_modules', '@jsvision', 'kanban');
  mkdirSync(installedPackage, { recursive: true });
  const tar = process.platform === 'win32' ? 'tar.exe' : 'tar';
  run(tar, ['-xzf', join(work, pack.filename), '-C', installedPackage, '--strip-components=1'], work);
  expect(relative(consumer, installedPackage).split(sep)).toEqual(['node_modules', '@jsvision', 'kanban']);
  for (const packageName of WORKSPACE_DEPENDENCIES) installWorkspaceDependency(work, consumer, packageName);
  for (const dependency of TYPE_DEPENDENCIES) {
    const source = realpathSync(join(REPOSITORY_ROOT, 'node_modules', ...dependency.source));
    installPackedPackage(work, consumer, source, dependency.destination);
  }
  return consumer;
}

/** Builds a NodeNext type consumer that imports every declared public entry. */
function typeConsumerSource(): string {
  const localeImports = LOCALES.map(
    ([locale, foundation, overlay]) =>
      `import { ${foundation}, ${overlay} } from '@jsvision/kanban/locales/${locale}';`,
  ).join('\n');
  const localeSymbols = LOCALES.flatMap(([, foundation, overlay]) => [foundation, overlay]).join(', ');
  return `import {
  KanbanBoard,
  createEagerKanbanDataSource,
  createKanbanColumnId,
  createKanbanInteractionController,
  resolveKanbanPresentation,
  type KanbanCardAdapter,
  type KanbanInteractionControllerFactory,
  type KanbanQuery,
} from '@jsvision/kanban';
import {
  KanbanPointerRouter,
  createKanbanDeferred,
  createWindowedKanbanFixture,
  routeKanbanKeyInput,
} from '@jsvision/kanban/testing';
${localeImports}
interface Card { readonly id: number; readonly columnId: string; readonly title: string }
const cards: readonly Card[] = [{ id: 1, columnId: 'ready', title: 'Packed card' }];
const query: KanbanQuery = { filters: [], sort: [] };
const adapter: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const source = createEagerKanbanDataSource(() => cards, {
  columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
  keyOf: adapter.keyOf,
  columnOf: (card) => card.columnId,
});
const board = new KanbanBoard({ source, query: () => query, card: adapter });
const factory: KanbanInteractionControllerFactory = createKanbanInteractionController;
void [
  board,
  factory,
  resolveKanbanPresentation('comfortable'),
  createKanbanColumnId,
  createKanbanDeferred,
  createWindowedKanbanFixture,
  routeKanbanKeyInput,
  KanbanPointerRouter,
  ${localeSymbols},
];
`;
}

/** Builds an ESM consumer that loads and inspects every declared public entry. */
function runtimeConsumerSource(): string {
  const localeChecks = LOCALES.map(
    ([locale, foundation, overlay]) =>
      `const ${foundation}Module = await import('@jsvision/kanban/locales/${locale}');
if (typeof ${foundation}Module.${foundation} !== 'object') throw new Error('${locale} foundation locale missing');
if (typeof ${foundation}Module.${overlay} !== 'object') throw new Error('${locale} Phase B overlay missing');
if (typeof ${foundation}Module.${foundation}.messages['kanban.board.label'] !== 'string') throw new Error('${locale} foundation vocabulary missing');
if (typeof ${foundation}Module.${overlay}.messages['kanban.interaction.unavailable'] !== 'string') throw new Error('${locale} Phase B vocabulary missing');`,
  ).join('\n');
  return `const main = await import('@jsvision/kanban');
const testing = await import('@jsvision/kanban/testing');
if (typeof main.createKanbanColumnId !== 'function') throw new Error('main entry missing');
if (typeof main.KanbanBoard !== 'function') throw new Error('board entry missing');
if (typeof main.createKanbanInteractionController !== 'function') throw new Error('interaction entry missing');
if (typeof main.resolveKanbanPresentation !== 'function') throw new Error('presentation entry missing');
if (typeof testing.createKanbanDeferred !== 'function') throw new Error('testing entry missing');
if (typeof testing.createWindowedKanbanFixture !== 'function') throw new Error('windowed fixture missing');
if (typeof testing.routeKanbanKeyInput !== 'function') throw new Error('key router missing');
if (typeof testing.KanbanPointerRouter !== 'function') throw new Error('pointer router missing');
const source = main.createEagerKanbanDataSource(
  () => [{ id: 1, columnId: 'ready', title: 'Packed card' }],
  {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  },
);
const board = new main.KanbanBoard({
  source,
  query: () => ({ filters: [], sort: [] }),
  card: {
    keyOf: (card) => card.id,
    titleOf: (card) => card.title,
    statusOf: () => 'Ready',
  },
});
const preMount = await board.interaction().transition({ kind: 'escape' });
if (preMount.kind !== 'unavailable') throw new Error('pre-mount interaction must fail closed');
board.dispose();
${localeChecks}
console.log('kanban-complete-exports-ok');
`;
}

describe('complete packed Kanban export-map contract', () => {
  // Every declared public subpath must work from the tarball for both runtime and NodeNext types.
  it(
    'should resolve main, testing, and all ten locale entries for runtime and NodeNext types',
    () => {
      const work = mkdtempSync(join(tmpdir(), 'jsvision-kanban-complete-consumer-'));
      try {
        const pack = packInto(work);
        const requiredFiles = ['dist/index.js', 'dist/index.d.ts', 'dist/testing.js', 'dist/testing.d.ts'];
        for (const [locale] of LOCALES) {
          requiredFiles.push(`dist/locales/${locale}.js`, `dist/locales/${locale}.d.ts`);
        }
        expect(requiredFiles.filter((path) => !pack.files.includes(path))).toEqual([]);

        const consumer = prepareConsumer(work, pack);
        const installedManifest: unknown = JSON.parse(
          readFileSync(join(consumer, 'node_modules', '@jsvision', 'kanban', 'package.json'), 'utf8'),
        );
        expect(isObject(installedManifest) && isObject(installedManifest.exports)).toBe(true);
        const exportKeys =
          isObject(installedManifest) && isObject(installedManifest.exports)
            ? Object.keys(installedManifest.exports)
            : [];
        expect(exportKeys).toEqual(['.', './testing', ...LOCALES.map(([locale]) => `./locales/${locale}`)]);
        writeFileSync(join(consumer, 'index.ts'), typeConsumerSource());
        writeFileSync(join(consumer, 'runtime.mjs'), runtimeConsumerSource());
        const compiler = join(
          REPOSITORY_ROOT,
          'node_modules',
          '.bin',
          process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
        );
        run(compiler, ['-p', 'tsconfig.json'], consumer);
        expect(run(process.execPath, ['runtime.mjs'], consumer).trim()).toBe('kanban-complete-exports-ok');
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
    COMMAND_TIMEOUT_MS * 4,
  );

  // Files inside the tarball are not public unless the manifest deliberately exports their subpath.
  it(
    'should reject private and undeclared subpaths from the real tarball',
    () => {
      const work = mkdtempSync(join(tmpdir(), 'jsvision-kanban-private-consumer-'));
      try {
        const consumer = prepareConsumer(work, packInto(work));
        for (const privatePath of ['contract/identity', 'interaction/controller', 'board/scene-model']) {
          const result = spawnSync(
            process.execPath,
            ['--input-type=module', '--eval', `await import('@jsvision/kanban/${privatePath}')`],
            {
              cwd: consumer,
              encoding: 'utf8',
              maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
              timeout: COMMAND_TIMEOUT_MS,
              windowsHide: true,
            },
          );
          expect(result.status, privatePath).not.toBe(0);
          expect(`${result.stdout}${result.stderr}`, privatePath).toMatch(/ERR_PACKAGE_PATH_NOT_EXPORTED/u);
        }
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
    COMMAND_TIMEOUT_MS * 4,
  );
});
