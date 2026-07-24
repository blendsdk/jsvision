#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const packageRoot = resolve(repositoryRoot, 'packages/code-editor');

/**
 * Fails release preparation when the packed package or built public barrel is incomplete.
 *
 * A real tarball is extracted into a temporary consumer. Its dependencies are linked from this
 * already-installed workspace, so the check never downloads or mutates dependency state.
 */
async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'jsvision-code-editor-release-'));
  try {
    const output = execFileSync('npm', ['pack', '--json', '--pack-destination', scratch], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const report = JSON.parse(output);
    const packed = report[0];
    const files = new Set(packed?.files?.map((entry) => entry.path) ?? []);
    for (const required of ['README.md', 'CHANGELOG.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts']) {
      if (!files.has(required)) throw new Error(`Packed Code Editor is missing ${required}.`);
    }

    const consumer = join(scratch, 'consumer');
    const packageDestination = join(consumer, 'node_modules', '@jsvision', 'code-editor');
    mkdirSync(packageDestination, { recursive: true });
    execFileSync('tar', ['-xzf', join(scratch, packed.filename), '--strip-components=1', '-C', packageDestination]);
    linkInstalledDependency(consumer, '@jsvision/core');
    linkInstalledDependency(consumer, '@jsvision/ui');
    linkInstalledDependency(consumer, '@codemirror/state');
    linkInstalledDependency(consumer, '@lezer/highlight');
    linkInstalledDependency(consumer, '@lezer/javascript');
    linkInstalledDependency(consumer, '@lezer/common');
    linkInstalledDependency(consumer, 'pgsql-ast-parser');
    linkInstalledDependency(consumer, 'vscode-languageserver-protocol');
    linkInstalledDependency(consumer, 'vscode-jsonrpc');

    const probe = [
      "const root = await import('@jsvision/code-editor');",
      "for (const name of ['CodeEditor','CodeEditorWindow','createCodeEditorController','createDocumentModel'])",
      '  if (!(name in root)) throw new Error(`missing ${name}`);',
      "await import('@jsvision/code-editor/languages/javascript');",
      "await import('@jsvision/code-editor/languages/typescript');",
      "await import('@jsvision/code-editor/languages/postgresql');",
      "await import('@jsvision/code-editor/node');",
    ].join('\n');
    execFileSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: consumer,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const docs = readFileSync(resolve(repositoryRoot, 'packages/docs-site/guide/code-editor.md'), 'utf8');
    if (!docs.includes('demo:code-editor')) throw new Error('Code Editor guide does not link the standalone demo.');
    process.stdout.write(`Code Editor release check passed (${files.size} packed files, 5 public entry points).\n`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Links one existing dependency into the temporary consumer without invoking a package manager. */
function linkInstalledDependency(consumer, packageName) {
  const source = resolve(repositoryRoot, 'node_modules', packageName);
  const destination = resolve(consumer, 'node_modules', packageName);
  mkdirSync(dirname(destination), { recursive: true });
  if (readdirSync(dirname(source)).includes(basename(source))) symlinkSync(source, destination, 'dir');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
