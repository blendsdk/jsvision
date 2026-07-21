/**
 * Specification test (immutable oracle) — `createBrowserFileSystem` (ST-4, ST-11, ST-9 path half).
 *
 * ST-4: a real `FileList` from `@jsvision/files` over a virtual FS seeded from a plain object lists the
 * seeded entries and re-scans when the directory changes — the whole dialog family runs unchanged in a
 * browser. Plus the import-graph half: `packages/web/src` imports no `node:fs`/`node:tty` (the
 * satisfiable source check; the stubbed-build half is proven by the `demo:web` dogfood boot).
 *
 * ST-11: the full `FileSystem` interface (14 methods + the `sep` property) behaves per the contract —
 * `readDir` lists + sorts, `stat`/`lstat` agree (no symlinks), `readFile`/`writeFile` round-trip,
 * `rename`/`unlink` mutate, a missing path throws, and the path ops are pure POSIX string math.
 *
 * ST-9 (path): `resolve('/home/demo', '../x')` → `/home/x` lexically — `..` is normalized away as a
 * string, never resolved against a real filesystem (there is none), so it can never escape into
 * `node:fs`. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import { FileList } from '@jsvision/files';
import { createBrowserFileSystem } from '@jsvision/web';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const here = dirname(fileURLToPath(import.meta.url));

/** The AC-4 seed: a home directory with one file and one nested sub-directory. */
function seededFs() {
  return createBrowserFileSystem({
    tree: { '/home/demo': { 'a.txt': 'alpha', sub: { 'b.txt': 'beta' } } },
    home: '/home/demo',
  });
}

/** Mount a real FileList over `fs` at `dir` and return it (its scan runs on mount). */
function mountedList(fs: ReturnType<typeof seededFs>, directory: ReturnType<typeof signal<string>>) {
  const list = new FileList({ fs, directory });
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 10 } });
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);
  return list;
}

// ST-4 — a real FileList lists the seeded entries and re-scans when the directory changes.
test('ST-4: a FileList over the virtual FS lists a.txt + sub, then b.txt inside sub', () => {
  const directory = signal('/home/demo');
  const list = mountedList(seededFs(), directory);

  const top = list.entries().map((e) => e.name);
  expect(top).toContain('a.txt');
  expect(top).toContain('sub');

  directory.set('/home/demo/sub'); // entering the sub-directory re-scans
  expect(list.entries().map((e) => e.name)).toContain('b.txt');
});

// ST-4 (import-graph, satisfiable half) — no @jsvision/web source file imports node:fs or node:tty.
test('ST-4: packages/web/src imports no node:fs / node:tty', () => {
  const srcDir = join(here, '..', 'src');
  const offenders: string[] = [];
  for (const name of readdirSync(srcDir)) {
    if (!name.endsWith('.ts')) continue;
    const text = readFileSync(join(srcDir, name), 'utf8');
    if (/from ['"]node:(fs|tty)['"]/.test(text)) offenders.push(name);
  }
  expect(offenders).toEqual([]);
});

// ST-11 — readDir lists + sorts; missing throws.
test('ST-11: readDir lists sorted entries and throws on a missing path', () => {
  const fs = seededFs();
  const names = fs.readDir('/home/demo').map((e) => e.name);
  expect(names).toEqual(['a.txt', 'sub']); // sorted for determinism
  expect(() => fs.readDir('/home/demo/missing')).toThrow();
  expect(() => fs.readDir('/home/demo/a.txt')).toThrow(); // a file is not a directory
});

// ST-11 — stat and lstat agree (no symlinks), reporting kind/size/mtime.
test('ST-11: stat and lstat agree and report kind', () => {
  const fs = seededFs();
  const fileStat = fs.stat('/home/demo/a.txt');
  expect(fileStat.kind).toBe('file');
  expect(fs.lstat('/home/demo/a.txt')).toEqual(fileStat); // lstat === stat
  expect(fs.stat('/home/demo').kind).toBe('dir');
  expect(() => fs.stat('/home/demo/missing')).toThrow();
});

// ST-11 — writeFile/readFile round-trip; rename/unlink mutate the tree.
test('ST-11: writeFile/readFile round-trip and rename/unlink mutate', () => {
  const fs = seededFs();
  expect(fs.readFile('/home/demo/a.txt')).toBe('alpha');

  fs.writeFile('/home/demo/new.txt', 'gamma');
  expect(fs.readFile('/home/demo/new.txt')).toBe('gamma');

  fs.rename('/home/demo/new.txt', '/home/demo/renamed.txt');
  expect(fs.readDir('/home/demo').map((e) => e.name)).toContain('renamed.txt');
  expect(fs.readDir('/home/demo').map((e) => e.name)).not.toContain('new.txt');

  fs.unlink('/home/demo/renamed.txt');
  expect(fs.readDir('/home/demo').map((e) => e.name)).not.toContain('renamed.txt');
  expect(() => fs.readFile('/home/demo/missing')).toThrow();
});

// ST-11 / ST-9 — path ops are pure POSIX string math; `..` normalizes lexically and clamps at root.
test('ST-11/ST-9: path ops are pure POSIX and never escape to a real fs', () => {
  const fs = seededFs();
  expect(fs.resolve('/home/demo', '../x')).toBe('/home/x'); // ST-9: lexical, no fs touch
  expect(fs.resolve('/home/demo', '../../../../etc/passwd')).toBe('/etc/passwd'); // clamps at root, still lexical
  expect(fs.join('/a', 'b')).toBe('/a/b');
  expect(fs.join('/a', '..')).toBe('/');
  expect(fs.dirname('/home/demo/a.txt')).toBe('/home/demo');
  expect(fs.basename('/home/demo/a.txt')).toBe('a.txt');
  expect(fs.isAbsolute('/x')).toBe(true);
  expect(fs.isAbsolute('x')).toBe(false);
  expect(fs.sep).toBe('/');
  expect(fs.homedir()).toBe('/home/demo');
  expect(fs.roots()).toEqual(['/']);

  // Proof it never touches disk: a file that provably exists on this host — this very test's source —
  // is invisible through the virtual FS, so a `..` walk can never exfiltrate a real file. (This probes
  // the test source rather than '/etc/passwd' because that path is absent on Windows CI, where it would
  // resolve to a non-existent 'D:\etc\passwd'; the invariant under test is "a real on-disk file is
  // unreachable", not the specific path.)
  const realHostFile = fileURLToPath(import.meta.url);
  expect(statSync(realHostFile).isFile()).toBe(true); // really exists on disk
  expect(() => fs.readFile(realHostFile)).toThrow(); // yet the virtual FS has no such node
  expect(() => fs.readFile('/etc/passwd')).toThrow(); // and a classic sensitive path is equally absent
});
