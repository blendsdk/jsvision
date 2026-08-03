import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
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

/** Packs the real package without lifecycle scripts and returns its validated tarball metadata. */
function packInto(destination: string): PackResult {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const output = run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], PACKAGE_ROOT);
  const result = parsePackResult(output);
  const tarball = join(destination, result.filename);
  if (!existsSync(tarball) || realpathSync(dirname(tarball)) !== realpathSync(destination)) {
    throw new Error('npm pack tarball escaped its bounded destination');
  }
  return result;
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

describe('packed Kanban main-entry contract', () => {
  it(
    'should typecheck and execute one pure public contract from the real tarball',
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

        run(typescriptCompiler(), ['-p', 'tsconfig.json'], consumer);
        const output = run(process.execPath, ['index.ts'], consumer);
        expect(output.trim()).toBe('kanban-contract-ok');
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
    COMMAND_TIMEOUT_MS * 3,
  );
});
