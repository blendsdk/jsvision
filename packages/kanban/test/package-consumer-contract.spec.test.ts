import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Absolute path to the package under test. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Absolute path to the monorepo that supplies the pinned test toolchain. */
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, '..', '..');
/** Authored fixture copied into a temporary, workspace-independent consumer. */
const FIXTURE_ROOT = join(PACKAGE_ROOT, 'test', 'fixtures', 'packed-consumer');
/** Maximum duration allowed for each external packaging or consumer command. */
const COMMAND_TIMEOUT_MS = 60_000;
/** Maximum output retained from one external command. */
const MAX_COMMAND_OUTPUT_BYTES = 1_048_576;
/** Publishable root documentation and metadata accepted beside compiled output. */
const ALLOWED_ROOT_FILES = new Set(['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE']);
/** Workspace runtime dependencies npm would install beside the packed Kanban package. */
const KANBAN_WORKSPACE_DEPENDENCIES = Object.freeze(['core', 'forms', 'i18n', 'ui']);
/** Node declaration packages required by Core's published host-facing types. */
const CONSUMER_TYPE_DEPENDENCIES = Object.freeze([
  { source: ['@types', 'node'], destination: ['@types', 'node'] },
  { source: ['undici-types'], destination: ['undici-types'] },
]);

/** One defensively narrowed result from `npm pack --json`. */
interface PackResult {
  readonly filename: string;
  readonly files: readonly string[];
}

/** Returns true when a value is a non-null, non-array object. */
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses bounded npm output and rejects ambiguous or unsafe tarball metadata. */
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

  const files: string[] = [];
  for (const entry of fileEntries) {
    if (!isObject(entry) || typeof entry.path !== 'string') {
      throw new Error('npm pack returned an invalid file entry');
    }
    files.push(entry.path);
  }
  return { filename, files };
}

/** Runs a process without a shell and caps both runtime and captured output. */
function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true,
  });
}

/** Packs one real workspace package without lifecycle scripts and returns validated tarball metadata. */
function packInto(destination: string, packageRoot = PACKAGE_ROOT): PackResult {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const output = run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], packageRoot);
  const result = parsePackResult(output);
  const tarball = join(destination, result.filename);
  if (!existsSync(tarball) || realpathSync(dirname(tarball)) !== realpathSync(destination)) {
    throw new Error('npm pack tarball escaped its bounded destination');
  }
  return result;
}

/** Extracts one packed workspace dependency as npm would for an offline isolated consumer. */
function installPackedDependency(work: string, consumer: string, packageName: string): void {
  const packageRoot = realpathSync(join(REPOSITORY_ROOT, 'node_modules', '@jsvision', packageName));
  installPackedPackage(work, consumer, packageRoot, ['@jsvision', packageName]);
}

/** Packs and extracts one already-installed dependency into the isolated consumer tree. */
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

/** Copies the authored consumer fixture without introducing workspace aliases or generated paths. */
function copyConsumerFixture(destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const name of ['package.json', 'tsconfig.json', 'index.ts']) {
    cpSync(join(FIXTURE_ROOT, name), join(destination, name));
  }
}

/** Returns the repository-installed TypeScript compiler without downloading another toolchain. */
function typescriptCompiler(): string {
  const executable = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
  const path = join(REPOSITORY_ROOT, 'node_modules', '.bin', executable);
  if (!existsSync(path)) throw new Error('the repository TypeScript compiler is unavailable');
  return path;
}

/** Installs the repository's real Zod package as the isolated consumer-provided peer. */
function installZodPeer(work: string, consumer: string): void {
  installPackedPackage(work, consumer, realpathSync(join(REPOSITORY_ROOT, 'node_modules', 'zod')), ['zod']);
}

describe('packed Kanban public-entry contract', () => {
  it(
    'should typecheck and execute the complete public contract from the real tarball',
    () => {
      const work = mkdtempSync(join(tmpdir(), 'jsvision-kanban-consumer-'));
      try {
        const pack = packInto(work);
        expect(pack.files).toEqual(expect.arrayContaining(['dist/index.js', 'dist/index.d.ts']));
        for (const path of pack.files) {
          const allowed = path.startsWith('dist/') || ALLOWED_ROOT_FILES.has(path);
          expect(allowed, `unexpected packed path: ${path}`).toBe(true);
          expect(path.startsWith('src/')).toBe(false);
          expect(path.startsWith('test/')).toBe(false);
          expect(path.includes('node_modules')).toBe(false);
          expect(path.includes('tsconfig')).toBe(false);
        }

        const consumer = join(work, 'consumer');
        copyConsumerFixture(consumer);
        const installedPackage = join(consumer, 'node_modules', '@jsvision', 'kanban');
        mkdirSync(installedPackage, { recursive: true });

        const tar = process.platform === 'win32' ? 'tar.exe' : 'tar';
        run(tar, ['-xzf', join(work, pack.filename), '-C', installedPackage, '--strip-components=1'], work);
        expect(relative(consumer, installedPackage).split(sep)).toEqual(['node_modules', '@jsvision', 'kanban']);

        // The packed root keeps old request APIs while exposing Phase C board/facade state without importing test code.
        const packageJson: unknown = JSON.parse(readFileSync(join(installedPackage, 'package.json'), 'utf8'));
        expect(packageJson).toMatchObject({
          exports: {
            '.': { types: './dist/index.d.ts', import: './dist/index.js' },
            './testing': { types: './dist/testing.d.ts', import: './dist/testing.js' },
          },
        });
        const productionEntry = readFileSync(join(installedPackage, 'dist', 'index.js'), 'utf8');
        const boardDeclarations = readFileSync(join(installedPackage, 'dist', 'board', 'kanban-board.d.ts'), 'utf8');
        const facadeDeclarations = readFileSync(join(installedPackage, 'dist', 'interaction', 'facade.d.ts'), 'utf8');
        const operationDeclarations = readFileSync(join(installedPackage, 'dist', 'operation', 'types.d.ts'), 'utf8');
        const testingEntry = readFileSync(join(installedPackage, 'dist', 'testing.js'), 'utf8');

        expect(productionEntry).not.toMatch(/(?:from|export)\s+["'][^"']*testing/u);
        expect(testingEntry).toContain('./testing/');
        expect(boardDeclarations).toMatch(/readonly operationId\?: KanbanOperationIdFactory/u);
        expect(boardDeclarations).toMatch(/readonly confirmOperation\?: KanbanConfirmer/u);
        expect(boardDeclarations).toMatch(/readonly drag\?: KanbanDragConfiguration/u);
        expect(boardDeclarations).not.toMatch(/moveCallback|onMove/u);
        for (const method of [
          'moveCard',
          'moveSelectedBlock',
          'reorderColumn',
          'reorderSwimlane',
          'cancel',
          'undo',
          'redo',
        ]) {
          expect(facadeDeclarations, `missing packed facade method ${method}`).toMatch(
            new RegExp(`\\b${method}\\(`, 'u'),
          );
        }
        expect(facadeDeclarations).toContain('Promise<KanbanRequestResult>');
        for (const state of ['proposed', 'pending', 'accepted', 'committed', 'rejected', 'cancelled', 'superseded']) {
          expect(operationDeclarations, `missing packed operation state ${state}`).toContain(`'${state}'`);
        }

        for (const packageName of KANBAN_WORKSPACE_DEPENDENCIES) {
          installPackedDependency(work, consumer, packageName);
        }
        for (const dependency of CONSUMER_TYPE_DEPENDENCIES) {
          const source = realpathSync(join(REPOSITORY_ROOT, 'node_modules', ...dependency.source));
          installPackedPackage(work, consumer, source, dependency.destination);
        }
        installZodPeer(work, consumer);

        run(typescriptCompiler(), ['-p', 'tsconfig.json'], consumer);
        const output = run(process.execPath, ['index.ts'], consumer);
        expect(output.trim()).toBe('kanban-contract-ok');
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
    COMMAND_TIMEOUT_MS * 3,
  );

  // Generic editor types must compile without Zod, while loading the standard runtime diagnoses the missing peer.
  it(
    'should isolate generic editor types and diagnose a missing standard-editor Zod peer',
    () => {
      const work = mkdtempSync(join(tmpdir(), 'jsvision-kanban-editor-peer-'));
      try {
        const pack = packInto(work);
        const consumer = join(work, 'consumer');
        mkdirSync(join(consumer, 'node_modules', '@jsvision', 'kanban'), { recursive: true });
        const tar = process.platform === 'win32' ? 'tar.exe' : 'tar';
        run(
          tar,
          [
            '-xzf',
            join(work, pack.filename),
            '-C',
            join(consumer, 'node_modules', '@jsvision', 'kanban'),
            '--strip-components=1',
          ],
          work,
        );
        for (const packageName of KANBAN_WORKSPACE_DEPENDENCIES) {
          installPackedDependency(work, consumer, packageName);
        }
        for (const dependency of CONSUMER_TYPE_DEPENDENCIES) {
          installPackedPackage(
            work,
            consumer,
            realpathSync(join(REPOSITORY_ROOT, 'node_modules', ...dependency.source)),
            dependency.destination,
          );
        }
        cpSync(join(FIXTURE_ROOT, 'tsconfig.json'), join(consumer, 'tsconfig.json'));
        writeFileSync(
          join(consumer, 'index.ts'),
          `import type { KanbanCardEditorAdapter, KanbanCardEditorSchema } from '@jsvision/kanban';
interface Card { readonly id: string; readonly title: string }
interface Draft { readonly title: string }
declare const adapter: KanbanCardEditorAdapter<Card, Draft>;
const schema: KanbanCardEditorSchema<Card, Draft> = adapter.schema;
void schema;
`,
        );

        run(typescriptCompiler(), ['-p', 'tsconfig.json'], consumer);
        const missingPeer = spawnSync(
          process.execPath,
          ['--input-type=module', '--eval', `await import('@jsvision/kanban')`],
          {
            cwd: consumer,
            encoding: 'utf8',
            maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
            timeout: COMMAND_TIMEOUT_MS,
            windowsHide: true,
          },
        );
        expect(missingPeer.status).not.toBe(0);
        expect(`${missingPeer.stderr}\n${missingPeer.stdout}`).toMatch(/(?:zod|peer dependency)/iu);
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
    COMMAND_TIMEOUT_MS * 3,
  );
});
