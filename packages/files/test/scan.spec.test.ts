/**
 * Specification test (immutable oracle) — `scanDirectory` + `compareEntries` (ST-3/4/12/13).
 *
 * TV decode: population `TFileList::readDirectory` (`tfillist.cpp:159-240`) — files via
 * `findAttr = FA_RDONLY|FA_ARCH` (hidden + system excluded), then subdirectories whose name is not
 * `.`-prefixed (dirs are NOT wildcard-filtered), then a synthesized `..` when not at a root. Sort
 * `TFileCollection::compare` (`tfilecol.cpp:47-56`): equal → 0; `..` sorts **last**; a directory sorts
 * **after** a file; else by **case-sensitive** name. So top-to-bottom = files A–Z, then dirs A–Z, then
 * `..`. Symlinks are file-like tags (PA-2 runtime). Extensions get oracles, no cell diff. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { scanDirectory, compareEntries } from '../src/fs/scan.js';
import type { DirEntry } from '../src/fs/types.js';
import { createMemoryFs, dir, file, symlink } from './helpers/memory-fs.js';

const names = (entries: DirEntry[]) => entries.map((e) => e.name);

/** A mixed directory under a non-root path (so `..` is synthesized). */
function mixedFs() {
  return createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'readme.txt': file({ size: 12 }),
          'App.ts': file({ size: 30 }),
          'data.json': file({ size: 8 }),
          '.hidden': file({ hidden: true }),
          src: dir(),
          '.git': dir({}, { hidden: true }),
          zebra: dir(),
        }),
      }),
    }),
  );
}

// ST-3 — sort: files A–Z (case-sensitive), then dirs A–Z, then `..` LAST.
test('ST-3: scanDirectory sorts files → dirs → ".." last (case-sensitive)', () => {
  const fs = mixedFs();
  const entries = scanDirectory(fs, '/home/user', {});
  // Files (case-sensitive: uppercase < lowercase): App.ts, data.json, readme.txt; dirs: src, zebra; then ..
  expect(names(entries)).toEqual(['App.ts', 'data.json', 'readme.txt', 'src', 'zebra', '..']);
  expect(entries.map((e) => e.kind)).toEqual(['file', 'file', 'file', 'dir', 'dir', 'dir']);
});

// ST-3 — compareEntries is the pure comparator: `..` greatest, dir > file, else case-sensitive name.
test('ST-3: compareEntries — ".." last, dir after file, else case-sensitive strcmp', () => {
  const f = (name: string): DirEntry => ({ name, kind: 'file', size: 0, mtime: new Date(0), hidden: false });
  const d = (name: string): DirEntry => ({ name, kind: 'dir', size: 0, mtime: new Date(0), hidden: false });
  expect(compareEntries(f('a'), f('a'))).toBe(0);
  expect(compareEntries(d('..'), f('a'))).toBeGreaterThan(0); // .. sorts last
  expect(compareEntries(f('a'), d('..'))).toBeLessThan(0);
  expect(compareEntries(d('src'), f('readme'))).toBeGreaterThan(0); // dir after file
  expect(compareEntries(f('App'), f('app'))).toBeLessThan(0); // 'A'(65) < 'a'(97), case-sensitive
});

// ST-4 — hidden default off excludes dotfiles/dot-dirs; on includes them; a caller filter is AND-ed.
test('ST-4: showHidden toggles dotfiles/dot-dirs (findAttr); filter is AND-ed with the wildcard', () => {
  const fs = mixedFs();
  expect(names(scanDirectory(fs, '/home/user', { showHidden: false }))).not.toContain('.hidden');
  expect(names(scanDirectory(fs, '/home/user', { showHidden: false }))).not.toContain('.git');

  const withHidden = names(scanDirectory(fs, '/home/user', { showHidden: true }));
  // Files: .hidden ('.'=46 < 'A') first; dirs: .git first; then ..
  expect(withHidden).toEqual(['.hidden', 'App.ts', 'data.json', 'readme.txt', '.git', 'src', 'zebra', '..']);

  // Wildcard applies to files only (dirs always shown); a caller filter is AND-ed (never replaces it).
  const ts = scanDirectory(fs, '/home/user', { wildcard: '*.ts' });
  expect(names(ts)).toEqual(['App.ts', 'src', 'zebra', '..']);
  const filtered = scanDirectory(fs, '/home/user', { wildcard: '*.ts', filter: (e) => e.name !== 'src' });
  expect(names(filtered)).toEqual(['App.ts', 'zebra', '..']);
});

// ST-12 — errors: an unreadable/absent directory throws a defined error; empties are handled (no garbage).
test('ST-12: scanDirectory throws on an unreadable dir; empty dirs handled ("." only at non-root)', () => {
  const fs = mixedFs();
  expect(() => scanDirectory(fs, '/home/user/readme.txt', {})).toThrow(); // not a directory
  expect(() => scanDirectory(fs, '/nope', {})).toThrow(); // ENOENT

  // An empty non-root directory yields exactly `..`; the filesystem root yields no `..`.
  const emptyFs = createMemoryFs(dir({ home: dir({ user: dir({ empty: dir() }) }) }));
  expect(names(scanDirectory(emptyFs, '/home/user/empty', {}))).toEqual(['..']);
  const rootFs = createMemoryFs(dir({ 'a.txt': file() }));
  expect(names(scanDirectory(rootFs, '/', {}))).toEqual(['a.txt']); // no ".." at a root
});

// ST-13 — symlinks: file-like tag; target size on a resolved link; broken flag, never followed.
test('ST-13: symlinks are file-like, target-stat sized; broken links flagged and not followed', () => {
  const fs = createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'file.txt': file({ size: 10 }),
          linkfile: symlink('/home/user/file.txt'),
          realdir: dir(),
          linkdir: symlink('/home/user/realdir'),
          linkbroken: symlink('/home/user/missing'),
        }),
      }),
    }),
  );
  const entries = scanDirectory(fs, '/home/user', {});
  // All symlinks sort in the file group (before the real dir), then `..`.
  expect(names(entries)).toEqual(['file.txt', 'linkbroken', 'linkdir', 'linkfile', 'realdir', '..']);

  const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
  expect(byName['linkfile'].kind).toBe('symlink');
  expect(byName['linkfile'].size).toBe(10); // target size
  expect(byName['linkfile'].broken).toBeFalsy();
  expect(byName['linkdir'].kind).toBe('symlink');
  expect(byName['linkbroken'].kind).toBe('symlink');
  expect(byName['linkbroken'].broken).toBe(true);
});
