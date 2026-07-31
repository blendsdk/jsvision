#!/usr/bin/env node
/**
 * Run the fastest useful checks over files changed in the local working tree.
 *
 * CI owns the complete repository gate. This command intentionally checks only staged,
 * unstaged, and untracked files for whitespace, formatting, and lint errors. Feature-specific
 * tests remain an explicit developer choice because inferring the correct test from a path would
 * either miss behavior or grow into another full verification pipeline.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const eslintCli = resolve(dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');
const prettierCli = resolve(dirname(require.resolve('prettier/package.json')), 'bin', 'prettier.cjs');

/** Run a command without a shell so filenames can never be interpreted as command text. */
function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout ?? '';
}

/** Parse Git's NUL-delimited output so whitespace and newlines in filenames remain safe. */
function gitFiles(args) {
  return run('git', args, { capture: true })
    .split('\0')
    .filter((path) => path.length > 0);
}

const changedFiles = [
  ...gitFiles(['diff', '--name-only', '--diff-filter=ACMR', '-z']),
  ...gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']),
  ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z']),
];
const uniqueFiles = [...new Set(changedFiles)].sort();

if (uniqueFiles.length === 0) {
  process.stdout.write('verify:local: no staged, unstaged, or untracked files to check.\n');
  process.exit(0);
}

run('git', ['diff', '--check']);
run('git', ['diff', '--cached', '--check']);
run(process.execPath, [prettierCli, '--check', '--ignore-unknown', '--', ...uniqueFiles]);

const eslintFiles = uniqueFiles.filter((path) => /\.(?:[cm]?[jt]sx?)$/u.test(path));
if (eslintFiles.length > 0) {
  run(process.execPath, [eslintCli, '--no-error-on-unmatched-pattern', '--', ...eslintFiles]);
}

process.stdout.write(`verify:local: checked ${uniqueFiles.length} changed file(s).\n`);
