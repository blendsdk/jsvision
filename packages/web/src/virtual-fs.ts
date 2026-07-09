/**
 * `createBrowserFileSystem` — an in-memory implementation of `@jsvision/files`' injectable
 * `FileSystem`, so the whole file-dialog family and the editor run in a browser tab against a seeded
 * tree with **no `node:fs`** and no real disk.
 *
 * It implements the full seam — 14 methods + the `sep` property. Files and directories only (no
 * symlinks, so `lstat === stat`); a deterministic, overridable mtime keeps golden output stable; and
 * the path methods are **pure POSIX string operations** (hand-rolled, importing no `node:path`), so
 * `..` is normalized away lexically and can never resolve against a real filesystem or escape below the
 * root. Writes mutate the in-memory tree only — nothing ever leaves the browser.
 */
import type { DirEntry, FileStat, FileSystem } from '@jsvision/files';

/**
 * A seed tree: a string value is a file's UTF-8 content; a nested record is a directory. A top-level
 * key may be an absolute path (e.g. `'/home/demo'`), which seeds at that path; nested keys are names.
 */
export type FileTree = { [name: string]: string | FileTree };

/** Options for {@link createBrowserFileSystem}. */
export interface BrowserFileSystemOptions {
  /** The initial tree. Absolute-path keys seed at that path; nested records are directories. */
  readonly tree?: FileTree;
  /** The home directory the dialogs open at. Default `'/home/demo'`. */
  readonly home?: string;
  /** The deterministic mtime for every seeded and written entry (keeps golden output stable). */
  readonly mtime?: Date;
}

/** A fixed, deterministic default mtime (overridable) so golden screen output stays stable. */
const DEFAULT_MTIME = new Date('2026-01-01T00:00:00.000Z');

/** A node in the in-memory tree — a file (UTF-8 content) or a directory (named children). */
type Node = { kind: 'file'; content: string; mtime: Date } | { kind: 'dir'; children: Map<string, Node>; mtime: Date };

/** The UTF-8 byte length of a string (file `size`), computed once per read. */
const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/** A missing-path error whose shape matches what the dialogs expect (`ENOENT`, path in the message). */
function enoent(op: string, path: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, ${op} '${path}'`), { code: 'ENOENT' });
}

// --- pure POSIX path helpers (no node:path — keeps the browser graph free of node builtins) ---------

/** Whether a POSIX path is absolute. */
const isAbsolutePosix = (path: string): boolean => path.startsWith('/');

/**
 * Lexically normalize a POSIX path: collapse `//`, drop `.`, and resolve `..` against prior segments.
 * On an absolute path a leading `..` clamps at the root (cannot escape below `/`); on a relative path a
 * leading `..` is preserved.
 */
function normalizePosix(path: string, absolute: boolean): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..'); // a relative path may rise above its base; an absolute one clamps
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

/** POSIX `path.resolve`, but a non-absolute result is based on `home` (not a real CWD). */
function resolvePosix(home: string, segments: readonly string[]): string {
  let joined = '';
  let absolute = false;
  // Walk right-to-left, prefixing segments until one is absolute (mirrors path.resolve).
  for (let i = segments.length - 1; i >= 0 && !absolute; i -= 1) {
    const seg = segments[i];
    if (seg === undefined || seg === '') continue;
    joined = joined === '' ? seg : `${seg}/${joined}`;
    absolute = isAbsolutePosix(seg);
  }
  if (!absolute) {
    joined = joined === '' ? home : `${home}/${joined}`;
    absolute = isAbsolutePosix(home);
  }
  const normalized = normalizePosix(joined, absolute);
  if (absolute) return `/${normalized}`;
  return normalized === '' ? '.' : normalized;
}

/** POSIX `path.join` — concatenate then normalize (preserving relative-vs-absolute). */
function joinPosix(segments: readonly string[]): string {
  const joined = segments.filter((s) => s !== '' && s !== undefined).join('/');
  if (joined === '') return '.';
  const absolute = isAbsolutePosix(joined);
  const normalized = normalizePosix(joined, absolute);
  if (absolute) return `/${normalized}`;
  return normalized === '' ? '.' : normalized;
}

/** POSIX `path.dirname`. */
function dirnamePosix(path: string): string {
  if (path === '') return '.';
  const trimmed = path.replace(/\/+$/, ''); // strip trailing slashes
  if (trimmed === '') return '/'; // the path was '/' (or all slashes)
  const idx = trimmed.lastIndexOf('/');
  if (idx === -1) return '.';
  if (idx === 0) return '/';
  return trimmed.slice(0, idx);
}

/** POSIX `path.basename`. */
function basenamePosix(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

/** Split an absolute path into its non-empty segments. */
const segmentsOf = (path: string): string[] => path.split('/').filter((s) => s.length > 0);

/**
 * Create an in-memory {@link FileSystem} seeded from a plain object.
 *
 * @param options - the seed `tree`, the `home` directory (default `'/home/demo'`), and a deterministic
 *   `mtime` for every entry.
 * @returns a `FileSystem` the whole `@jsvision/files` dialog family accepts unchanged.
 *
 * @example
 * import { createBrowserFileSystem } from '@jsvision/web';
 * import { FileDialog } from '@jsvision/files';
 *
 * const fs = createBrowserFileSystem({
 *   tree: { '/home/demo': { 'notes.txt': 'hello', src: { 'main.ts': '…' } } },
 *   home: '/home/demo',
 * });
 * const dialog = new FileDialog({ fs, directory: signal('/home/demo') });
 */
export function createBrowserFileSystem(options: BrowserFileSystemOptions = {}): FileSystem {
  const home = options.home ?? '/home/demo';
  const mtime = options.mtime ?? DEFAULT_MTIME;
  const root: Node = { kind: 'dir', children: new Map(), mtime };

  /** Resolve a path to its node, or `undefined` if any segment is missing or not a directory. */
  function nodeAt(path: string): Node | undefined {
    let cur: Node = root;
    for (const seg of segmentsOf(path)) {
      if (cur.kind !== 'dir') return undefined;
      const next = cur.children.get(seg);
      if (next === undefined) return undefined;
      cur = next;
    }
    return cur;
  }

  /** Ensure a directory exists at `path` (creating intermediate directories), returning its node. */
  function ensureDir(path: string): Extract<Node, { kind: 'dir' }> {
    let cur: Node = root;
    for (const seg of segmentsOf(path)) {
      if (cur.kind !== 'dir') throw enoent('mkdir', path);
      let next = cur.children.get(seg);
      if (next === undefined) {
        next = { kind: 'dir', children: new Map(), mtime };
        cur.children.set(seg, next);
      }
      cur = next;
    }
    if (cur.kind !== 'dir') throw enoent('mkdir', path);
    return cur;
  }

  /** Write a file at `path`, creating its parent directories, and return nothing. */
  function putFile(path: string, content: string): void {
    const parent = ensureDir(dirnamePosix(path));
    parent.children.set(basenamePosix(path), { kind: 'file', content, mtime });
  }

  /** Recursively seed `tree` under `base` (absolute-path keys seed at that path). */
  function seed(tree: FileTree, base: string): void {
    for (const [name, value] of Object.entries(tree)) {
      const path = isAbsolutePosix(name) ? name : joinPosix([base, name]);
      if (typeof value === 'string') putFile(path, value);
      else {
        ensureDir(path);
        seed(value, path);
      }
    }
  }

  if (options.tree) seed(options.tree, '/');

  /** Reduce a node to its {@link FileStat}. */
  function statOf(node: Node): FileStat {
    if (node.kind === 'dir') return { kind: 'dir', size: 0, mtime: node.mtime };
    return { kind: 'file', size: byteLength(node.content), mtime: node.mtime };
  }

  return {
    sep: '/',
    homedir: () => home,
    roots: () => ['/'],
    isAbsolute: isAbsolutePosix,
    resolve: (...segments) => resolvePosix(home, segments),
    join: (...segments) => joinPosix(segments),
    dirname: dirnamePosix,
    basename: basenamePosix,

    readDir(path: string): DirEntry[] {
      const node = nodeAt(path);
      if (node === undefined || node.kind !== 'dir') throw enoent('scandir', path);
      const entries: DirEntry[] = [];
      for (const [name, child] of node.children) {
        entries.push({
          name,
          kind: child.kind,
          size: child.kind === 'file' ? byteLength(child.content) : 0,
          mtime: child.mtime,
          hidden: name.startsWith('.'),
        });
      }
      // Sort by name for deterministic listings (scanDirectory re-sorts by kind, but this keeps the
      // raw seam output stable for golden tests).
      entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return entries;
    },

    stat(path: string): FileStat {
      const node = nodeAt(path);
      if (node === undefined) throw enoent('stat', path);
      return statOf(node);
    },

    // No symlinks in the virtual FS, so lstat and stat are identical.
    lstat(path: string): FileStat {
      const node = nodeAt(path);
      if (node === undefined) throw enoent('lstat', path);
      return statOf(node);
    },

    readFile(path: string): string {
      const node = nodeAt(path);
      if (node === undefined || node.kind !== 'file') throw enoent('open', path);
      return node.content;
    },

    writeFile(path: string, text: string): void {
      const parent = nodeAt(dirnamePosix(path));
      if (parent === undefined || parent.kind !== 'dir') throw enoent('open', path);
      parent.children.set(basenamePosix(path), { kind: 'file', content: text, mtime });
    },

    rename(from: string, to: string): void {
      const fromParent = nodeAt(dirnamePosix(from));
      const toParent = nodeAt(dirnamePosix(to));
      if (fromParent === undefined || fromParent.kind !== 'dir') throw enoent('rename', from);
      if (toParent === undefined || toParent.kind !== 'dir') throw enoent('rename', to);
      const name = basenamePosix(from);
      const node = fromParent.children.get(name);
      if (node === undefined) throw enoent('rename', from);
      fromParent.children.delete(name);
      toParent.children.set(basenamePosix(to), node);
    },

    unlink(path: string): void {
      const parent = nodeAt(dirnamePosix(path));
      const name = basenamePosix(path);
      if (parent === undefined || parent.kind !== 'dir' || !parent.children.has(name)) {
        throw enoent('unlink', path);
      }
      parent.children.delete(name);
    },
  };
}
