/**
 * Specification test (immutable oracle) — the live-example registry contract.
 *
 * Derives from the live-example requirements: an example module exports
 * `defineExample({ title, blurb, build })`, and the hand-authored `EXAMPLES`
 * registry is the single source of each example's id/category/kind/sourcePath.
 * Two guarantees are asserted here:
 *
 *  - **Parity** — every example module file on disk has exactly one registry
 *    entry, and every entry points at a real file (no orphan files, no orphan
 *    entries). This is what keeps the hand-authored registry honest.
 *  - **Metadata hygiene** — ids are unique (they are the deep-link + menu keys),
 *    and every module carries a non-empty title and blurb.
 *
 * The registry is empty until the seed examples land; the parity/hygiene loops
 * then engage automatically as entries are added.
 */
import { readdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { defineExample } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES_DIR = join(PKG_ROOT, 'examples');

/** The two registry-infrastructure files that are not themselves examples. */
const NON_EXAMPLE_FILES = new Set(['_contract.ts', 'index.ts']);

/**
 * Every example module file under `examples/`, as a package-root-relative POSIX
 * path (e.g. `examples/controls/button.ts`) to match an entry's `sourcePath`.
 */
function exampleFilesOnDisk(dir: string = EXAMPLES_DIR): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...exampleFilesOnDisk(abs));
    } else if (dirent.name.endsWith('.ts') && !NON_EXAMPLE_FILES.has(relative(EXAMPLES_DIR, abs))) {
      out.push(relative(PKG_ROOT, abs).split(sep).join('/'));
    }
  }
  return out;
}

test('the example contract is an identity helper preserving the definition', () => {
  const def = { title: 'T', blurb: 'B', build: () => ({}) as never };
  expect(typeof defineExample).toBe('function');
  expect(defineExample(def)).toBe(def);
});

test('ST-1: every example file has exactly one registry entry, and vice-versa', () => {
  const files = exampleFilesOnDisk().sort();
  const sourcePaths = EXAMPLES.map((e) => e.sourcePath);

  // No duplicate sourcePaths in the registry.
  expect(new Set(sourcePaths).size).toBe(sourcePaths.length);
  // Every registry entry points at a real file (no orphan entry).
  for (const e of EXAMPLES) {
    expect(existsSync(join(PKG_ROOT, e.sourcePath)), `orphan registry entry: ${e.sourcePath}`).toBe(true);
  }
  // Every file on disk is registered exactly once (no orphan file).
  for (const f of files) {
    expect(sourcePaths, `unregistered example file: ${f}`).toContain(f);
  }
  // Bijection: same count on both sides.
  expect(sourcePaths.slice().sort()).toEqual(files);
});

test('ST-B5: every registry entry declares a valid kind (component | app)', () => {
  expect(EXAMPLES.length).toBeGreaterThan(0);
  for (const entry of EXAMPLES) {
    expect(['component', 'app'], `${entry.id} has an invalid kind: ${String(entry.kind)}`).toContain(entry.kind);
  }
});

test('ST-1: entry ids are unique and every module carries a non-empty title + blurb', async () => {
  const ids = EXAMPLES.map((e) => e.id);
  expect(new Set(ids).size, 'duplicate example id').toBe(ids.length);

  for (const entry of EXAMPLES) {
    const mod = await entry.load();
    const def = mod.default;
    expect(def, `${entry.id} has no default export`).toBeTruthy();
    expect(def.title.trim(), `${entry.id} empty title`).not.toBe('');
    expect(def.blurb.trim(), `${entry.id} empty blurb`).not.toBe('');
  }
});
