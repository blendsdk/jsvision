import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import * as browserEntry from '../src/index.js';
import * as nodeEntry from '../src/node/index.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELATIVE_IMPORT = /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/gu;
const PACK_TIMEOUT_MS = 60_000;

/** Read the package manifest as an unknown JSON object. */
async function packageManifest(): Promise<object> {
  const parsed: unknown = JSON.parse(await readFile(resolve(PACKAGE_ROOT, 'package.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError('Package manifest must be a JSON object.');
  }
  return parsed;
}

/** Return the package-root-relative paths that npm would include in a tarball. */
function packedFilePaths(): readonly string[] {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const output = execFileSync(npm, ['pack', '--dry-run', '--json'], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: PACK_TIMEOUT_MS,
  });
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end < start) throw new TypeError('npm pack did not return a JSON array.');
  const parsed: unknown = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new TypeError('npm pack output must be an array.');

  const paths: string[] = [];
  for (const result of parsed) {
    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
      throw new TypeError('npm pack results must be objects.');
    }
    const files = Reflect.get(result, 'files');
    if (!Array.isArray(files)) throw new TypeError('npm pack result files must be an array.');
    for (const file of files) {
      if (typeof file !== 'object' || file === null || Array.isArray(file)) {
        throw new TypeError('npm pack file entries must be objects.');
      }
      const path = Reflect.get(file, 'path');
      if (typeof path !== 'string') throw new TypeError('npm pack file paths must be strings.');
      paths.push(path);
    }
  }
  return paths;
}

/** Resolve one emitted-style relative specifier back to its TypeScript source file. */
function sourcePath(importer: string, specifier: string): string {
  const emittedPath = resolve(dirname(importer), specifier);
  return emittedPath.endsWith('.js') ? `${emittedPath.slice(0, -3)}.ts` : emittedPath;
}

/** Collect the complete relative source dependency closure and reject Node built-ins. */
async function browserDependencyClosure(entry: string): Promise<ReadonlySet<string>> {
  const visited = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    const source = await readFile(current, 'utf8');
    if (/(?:from\s+|import\s*)['"]node:/u.test(source)) {
      throw new TypeError('The browser entry dependency closure imports a Node built-in.');
    }
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const specifier = match[1];
      if (specifier !== undefined) pending.push(sourcePath(current, specifier));
    }
  }
  return visited;
}

describe('package entry isolation', () => {
  test('keeps Node loading absent from the browser-safe public entry', async () => {
    expect(Reflect.get(browserEntry, 'jsonFileSource')).toBeUndefined();
    const closure = await browserDependencyClosure(resolve(PACKAGE_ROOT, 'src', 'index.ts'));
    expect([...closure].some((path) => path.includes('/src/node/'))).toBe(false);
  });

  test('publishes the rooted loader only from the Node entry', () => {
    expect(nodeEntry.jsonFileSource).toBeTypeOf('function');
  });

  test('maps the explicit Node export to emitted type and runtime files', async () => {
    const manifest = await packageManifest();
    const exportsField = Reflect.get(manifest, 'exports');
    if (typeof exportsField !== 'object' || exportsField === null || Array.isArray(exportsField)) {
      throw new TypeError('Package exports must be an object.');
    }
    const nodeExport = Reflect.get(exportsField, './node');

    expect(nodeExport).toEqual({
      types: './dist/node/index.d.ts',
      import: './dist/node/index.js',
    });
  });

  test(
    'includes the complete upstream attribution in the packed package',
    async () => {
      expect(packedFilePaths()).toContain('THIRD_PARTY_NOTICES.md');
      const notice = await readFile(resolve(PACKAGE_ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
      expect(notice).toContain('Copyright (c) 2019 TrueSoftware B.V.');
      expect(notice).toContain('Permission is hereby granted, free of charge');
    },
    PACK_TIMEOUT_MS,
  );
});
