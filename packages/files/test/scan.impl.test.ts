/**
 * Implementation test (edge/internal + hardening) — `scanDirectory` / `compareEntries`
 * (`src/fs/scan.js`).
 *
 * Covers the sort contract (files A–Z → dirs A–Z → `..` last), the wildcard-on-files-only rule (dirs
 * are never filtered), the AND-ed caller filter (never applied to `..`), hidden default-off vs
 * `showHidden`, `..` synthesis off-root but not at a root, symlink file-like categorization, and the
 * HARDENING contract: an unreadable directory PROPAGATES a defined error (source line 62 — the caller
 * raises the error box, AC-12), while a seam that skips a failing entry inside `readDir` yields a
 * defined, fully-sorted partial list (never garbage). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { scanDirectory, compareEntries } from '../src/fs/scan.js';
import type { DirEntry, FileSystem } from '../src/fs/types.js';
import { createMemoryFs, dir, file, symlink } from './helpers/memory-fs.js';

const names = (entries: DirEntry[]) => entries.map((e) => e.name);

function mixedFs() {
  return createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'readme.txt': file({ size: 12 }),
          'App.ts': file({ size: 30 }),
          Beta: dir(),
          alpha: dir(),
          '.env': file({ hidden: true }),
        }),
      }),
    }),
  );
}

test('impl: full sort order — files (case-sensitive A–Z) → dirs (A–Z) → ".." last', () => {
  const entries = scanDirectory(mixedFs(), '/home/user', {});
  // Files: 'App.ts' (A=65) before 'readme.txt' (r=114). Dirs: 'Beta' (B=66) before 'alpha' (a=97).
  expect(names(entries)).toEqual(['App.ts', 'readme.txt', 'Beta', 'alpha', '..']);
  expect(entries.map((e) => e.kind)).toEqual(['file', 'file', 'dir', 'dir', 'dir']);
});

test('impl: compareEntries is symmetric/antisymmetric across the ordering rules', () => {
  const f = (name: string): DirEntry => ({ name, kind: 'file', size: 0, mtime: new Date(0), hidden: false });
  const d = (name: string): DirEntry => ({ name, kind: 'dir', size: 0, mtime: new Date(0), hidden: false });
  expect(compareEntries(f('x'), f('x'))).toBe(0);
  expect(compareEntries(d('..'), d('..'))).toBe(0); // identical names short-circuit to 0
  // dir-vs-file is antisymmetric.
  expect(compareEntries(d('z'), f('a'))).toBeGreaterThan(0);
  expect(compareEntries(f('a'), d('z'))).toBeLessThan(0);
  // ".." beats everything, even another directory.
  expect(compareEntries(d('..'), d('zzz'))).toBeGreaterThan(0);
  expect(compareEntries(d('zzz'), d('..'))).toBeLessThan(0);
});

test('impl: wildcard filters files only — directories are always shown', () => {
  const entries = scanDirectory(mixedFs(), '/home/user', { wildcard: '*.ts' });
  // '*.ts' keeps App.ts (file), drops readme.txt; both dirs survive; then '..'.
  expect(names(entries)).toEqual(['App.ts', 'Beta', 'alpha', '..']);
});

test('impl: caller filter is AND-ed and never applied to the synthesized ".."', () => {
  // A filter that rejects EVERYTHING still keeps '..' (it is pushed after the loop, source line 73).
  const entries = scanDirectory(mixedFs(), '/home/user', { filter: () => false });
  expect(names(entries)).toEqual(['..']);
});

test('impl: showHidden default-off excludes dotfiles; on includes them', () => {
  expect(names(scanDirectory(mixedFs(), '/home/user', {}))).not.toContain('.env');
  expect(names(scanDirectory(mixedFs(), '/home/user', { showHidden: true }))).toContain('.env');
});

test('impl: ".." synthesized off-root, omitted at a filesystem root; empty dirs handled', () => {
  const nested = createMemoryFs(dir({ home: dir({ user: dir({ empty: dir() }) }) }));
  expect(names(scanDirectory(nested, '/home/user/empty', {}))).toEqual(['..']); // empty non-root → just ".."
  const rootFs = createMemoryFs(dir({ 'a.txt': file(), 'b.txt': file() }));
  expect(names(scanDirectory(rootFs, '/', {}))).toEqual(['a.txt', 'b.txt']); // no ".." at a root
  const emptyRoot = createMemoryFs(dir({}));
  expect(names(scanDirectory(emptyRoot, '/', {}))).toEqual([]); // empty root → nothing
});

test('impl: symlinks are file-like, sorted in the file group, target-stat sized', () => {
  const fs = createMemoryFs(
    dir({
      home: dir({
        user: dir({
          realdir: dir(),
          'z.txt': file({ size: 3 }),
          link: symlink('/home/user/z.txt'),
        }),
      }),
    }),
  );
  const entries = scanDirectory(fs, '/home/user', {});
  // 'link' and 'z.txt' are file-like (sort before the real dir); then '..'.
  expect(names(entries)).toEqual(['link', 'z.txt', 'realdir', '..']);
  const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
  expect(byName['link'].kind).toBe('symlink');
  expect(byName['link'].size).toBe(3); // resolved-target size
});

// —— HARDENING (task 7.3) ——

test('impl: an unreadable directory PROPAGATES a defined error (never a garbage list)', () => {
  const base = createMemoryFs(dir({ home: dir({ user: dir() }) }));
  const throwing: FileSystem = {
    ...base,
    readDir() {
      throw new Error('EACCES: permission denied');
    },
  };
  // scanDirectory does NOT swallow the directory-open failure — it throws a defined error so the
  // caller can raise the error box (source line 62, AC-12). It never returns a partial/garbage list.
  expect(() => scanDirectory(throwing, '/home/user', {})).toThrow(/EACCES/);
});

test('impl: a seam that skips a failing entry yields a defined, fully-sorted partial list', () => {
  const base = createMemoryFs(dir({ home: dir({ user: dir() }) }));
  // Model the AC-12 per-entry skip: readDir already degraded (dropped the unreadable entry), so
  // scanDirectory just receives + sorts whatever survived — a defined result, never a throw.
  const partial: FileSystem = {
    ...base,
    readDir: (): DirEntry[] => [
      { name: 'zeta.txt', kind: 'file', size: 1, mtime: new Date(0), hidden: false },
      { name: 'alpha.txt', kind: 'file', size: 1, mtime: new Date(0), hidden: false },
      { name: 'sub', kind: 'dir', size: 0, mtime: new Date(0), hidden: false },
    ],
  };
  const entries = scanDirectory(partial, '/home/user', {});
  expect(names(entries)).toEqual(['alpha.txt', 'zeta.txt', 'sub', '..']); // sorted + ".." synthesized
});

test('impl: an empty seam listing off-root still yields exactly ".."', () => {
  const base = createMemoryFs(dir({ home: dir({ user: dir() }) }));
  const empty: FileSystem = { ...base, readDir: (): DirEntry[] => [] };
  expect(names(scanDirectory(empty, '/home/user', {}))).toEqual(['..']);
});
