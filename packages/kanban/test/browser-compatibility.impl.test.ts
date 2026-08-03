import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Absolute production source root inspected by this browser-portability regression test. */
const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
/** Fixed traversal ceiling that prevents a malformed tree from causing runaway test work. */
const MAX_SOURCE_FILES = 512;

/** Lists production TypeScript modules with a fixed cardinality ceiling. */
function listSourceFiles(): readonly string[] {
  const pending = [SOURCE_ROOT];
  const files: string[] = [];
  while (pending.length > 0) {
    const directory = pending.shift();
    if (directory === undefined) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && path.endsWith('.ts')) files.push(path);
      if (files.length + pending.length > MAX_SOURCE_FILES) {
        throw new Error(`Kanban source traversal exceeds ${MAX_SOURCE_FILES} entries.`);
      }
    }
  }
  return files.sort();
}

describe('browser compatibility implementation', () => {
  it('keeps Node built-ins out of every production source module', () => {
    const nodeImports = listSourceFiles().flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](node:[^"']+)["']/gu)].map(
        (match) => `${path}: ${match[1]}`,
      );
    });

    expect(nodeImports).toEqual([]);
  });
});
