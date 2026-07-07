/**
 * Specification test (immutable oracle) — `@jsvision/files` packaging (ST-16).
 *
 * The six TV components + the `FileSystem` seam + the pure cores + the openers are re-exported by name
 * from `src/index.ts` (imported here BY NAME from `@jsvision/files`, the package surface); the package
 * declares only the two workspace runtime deps (`@jsvision/core` + `@jsvision/ui`, no native/third-party
 * dep — the `check:deps` gate enforces the ban); every source file is ≤ 500 lines; and the package is
 * `private` (excluded from the public lockstep `sync-versions`). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  // the six TV components
  FileList,
  FileInput,
  FileInfoPane,
  DirList,
  FileDialog,
  ChDirDialog,
  // the FileSystem seam + node default + pure cores
  nodeFileSystem,
  isWild,
  wildcardMatch,
  scanDirectory,
  compareEntries,
  buildDirTree,
  // the local error dialog + convenience openers
  errorBox,
  openFile,
  changeDir,
} from '@jsvision/files';

const here = dirname(fileURLToPath(import.meta.url));

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ST-16 — the six components are exported constructable classes with the documented hierarchy.
test('ST-16: the six TV components are exported classes', () => {
  for (const cls of [FileList, FileInput, FileInfoPane, DirList, FileDialog, ChDirDialog]) {
    expect(typeof cls).toBe('function');
  }
});

// ST-16 — the seam default, pure cores, error dialog, and openers are exported callables.
test('ST-16: the fs cores + errorBox + openers are exported functions/objects', () => {
  for (const fn of [
    isWild,
    wildcardMatch,
    scanDirectory,
    compareEntries,
    buildDirTree,
    errorBox,
    openFile,
    changeDir,
  ]) {
    expect(typeof fn).toBe('function');
  }
  expect(typeof nodeFileSystem).toBe('object'); // the concrete FileSystem instance
  expect(typeof nodeFileSystem.readDir).toBe('function');
});

// ST-16 — every source file is ≤ 500 lines (architecture boundary).
test('ST-16: each source file is ≤ 500 lines', () => {
  for (const file of tsFiles(join(here, '..', 'src'))) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

// ST-16 — only the two workspace runtime deps (no native/third-party); private (out of the public lockstep).
test('ST-16: @jsvision/files declares only the workspace runtime deps and is private', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    private?: boolean;
    dependencies?: Record<string, string>;
  };
  expect(pkg.private).toBe(true);
  expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@jsvision/core', '@jsvision/ui']);
});

// --- RD-08 editor-family additions (ST-33, files side) -------------------------------------------
test('RD-08 ST-33: FileEditor, openFileInEditor, FileCommands re-export by name from @jsvision/files', async () => {
  const files = await import('@jsvision/files');
  expect(typeof files.FileEditor).toBe('function');
  expect(typeof files.openFileInEditor).toBe('function');
  expect(files.FileCommands.save).toBe('save');
  expect(files.FileCommands.saveAs).toBe('saveAs');
});
