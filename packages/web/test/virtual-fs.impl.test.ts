/**
 * Implementation tests — `createBrowserFileSystem` internals/edges (beyond the ST-4/ST-11 oracle):
 * dotfile hidden flags, the ENOENT error shape, deep nested seeding, byte-length sizing for multibyte
 * content, a deterministic overridable mtime, writeFile-to-missing-parent, and POSIX path edge cases.
 * `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { createBrowserFileSystem } from '@jsvision/web';

// A dotfile is flagged hidden; a regular file is not.
test('readDir flags dotfiles as hidden', () => {
  const fs = createBrowserFileSystem({ tree: { '/d': { '.rc': 'x', 'a.txt': 'y' } }, home: '/d' });
  const byName = new Map(fs.readDir('/d').map((e) => [e.name, e]));
  expect(byName.get('.rc')?.hidden).toBe(true);
  expect(byName.get('a.txt')?.hidden).toBe(false);
});

// The missing-path error carries the ENOENT code + message shape the dialogs render.
test('a missing path throws an ENOENT-shaped error', () => {
  const fs = createBrowserFileSystem({ tree: { '/d': {} }, home: '/d' });
  try {
    fs.readFile('/d/nope.txt');
    throw new Error('expected a throw');
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('ENOENT');
    expect((err as { code?: string }).code).toBe('ENOENT');
  }
});

// Deep nesting seeds every level; the leaf is readable.
test('deeply nested seeding resolves the leaf', () => {
  const fs = createBrowserFileSystem({ tree: { '/a': { b: { c: { d: { 'leaf.txt': 'deep' } } } } } });
  expect(fs.readFile('/a/b/c/d/leaf.txt')).toBe('deep');
  expect(fs.stat('/a/b/c/d').kind).toBe('dir');
});

// size is the UTF-8 byte length, not the JS string length.
test('file size is the UTF-8 byte length', () => {
  const fs = createBrowserFileSystem({ tree: { '/d': { 'e.txt': '€' } }, home: '/d' }); // '€' = 3 bytes, 1 char
  expect(fs.stat('/d/e.txt').size).toBe(3);
  expect(fs.readDir('/d')[0]?.size).toBe(3);
});

// The mtime is deterministic and overridable.
test('mtime is deterministic and overridable', () => {
  const when = new Date('2030-05-05T05:05:05.000Z');
  const fs = createBrowserFileSystem({ tree: { '/d': { 'a.txt': 'x' } }, home: '/d', mtime: when });
  expect(fs.stat('/d/a.txt').mtime.getTime()).toBe(when.getTime());
  fs.writeFile('/d/b.txt', 'y'); // a runtime write also gets the deterministic mtime
  expect(fs.stat('/d/b.txt').mtime.getTime()).toBe(when.getTime());
});

// writeFile to a missing parent directory throws (it does not create intermediate dirs).
test('writeFile to a missing parent throws', () => {
  const fs = createBrowserFileSystem({ tree: { '/d': {} }, home: '/d' });
  expect(() => fs.writeFile('/d/missing/a.txt', 'x')).toThrow();
});

// POSIX path edge cases: root, trailing slashes, and dot segments.
test('POSIX path ops handle root and trailing slashes', () => {
  const fs = createBrowserFileSystem();
  expect(fs.dirname('/')).toBe('/');
  expect(fs.dirname('/home')).toBe('/');
  expect(fs.basename('/home/demo/')).toBe('demo'); // trailing slash ignored
  expect(fs.resolve('/a/b', './c', '../d')).toBe('/a/b/d');
  expect(fs.join('/a/', '/b/', 'c')).toBe('/a/b/c');
  expect(fs.resolve('relative', 'path')).toBe('/home/demo/relative/path'); // based on the default home
});
