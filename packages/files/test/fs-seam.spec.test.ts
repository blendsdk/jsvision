/**
 * Specification test (immutable oracle) — the `FileSystem` seam + its default `nodeFileSystem` (ST-1,
 * AC-1/PA-2). The seam is proven by injection: the in-memory adapter drives full listing/nav with **no
 * `node:fs` access**, and the shipped default delegates its path ops to `node:path` (zero deps). No TV
 * counterpart — extension oracle, no cell diff. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import nodePath from 'node:path';
import { nodeFileSystem } from '../src/fs/node-fs.js';
import { createMemoryFs, dir, file, symlink } from './helpers/memory-fs.js';

test('ST-1: the injected in-memory seam drives listing + stat/lstat headless (no node:fs)', () => {
  const fs = createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'a.txt': file({ size: 5 }),
          link: symlink('/home/user/a.txt'),
          sub: dir(),
        }),
      }),
    }),
  );
  const entries = fs.readDir('/home/user');
  expect(entries.map((e) => e.name).sort()).toEqual(['a.txt', 'link', 'sub']);

  // stat FOLLOWS the symlink (target is a file); lstat detects the link itself.
  expect(fs.stat('/home/user/link').kind).toBe('file');
  expect(fs.lstat('/home/user/link').kind).toBe('symlink');
  expect(fs.stat('/home/user/a.txt').size).toBe(5);
});

test('ST-1: the default nodeFileSystem implements the full seam over node:path (zero deps)', () => {
  const fs = nodeFileSystem;
  // Path ops delegate to node:path — assert against it directly (no disk touched).
  expect(fs.sep).toBe(nodePath.sep);
  expect(fs.join('a', 'b', 'c')).toBe(nodePath.join('a', 'b', 'c'));
  expect(fs.dirname('/a/b/c')).toBe(nodePath.dirname('/a/b/c'));
  expect(fs.basename('/a/b/c.ts')).toBe(nodePath.basename('/a/b/c.ts'));
  expect(fs.isAbsolute('/a')).toBe(true);
  expect(fs.isAbsolute('a')).toBe(false);
  expect(fs.resolve('/a', 'b')).toBe(nodePath.resolve('/a', 'b'));
  // Platform surface present.
  expect(typeof fs.homedir()).toBe('string');
  expect(fs.roots().length).toBeGreaterThan(0);
});
