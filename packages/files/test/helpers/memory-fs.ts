/**
 * In-memory `FileSystem` (PA-11) — a test/story-only adapter over a plain tree literal, **not shipped**.
 * Drives every fs-touching spec headless (AC-1): no real disk, no `node:fs`, deterministic. Path ops
 * delegate to `node:path` (`posix` or `win32`) so the same tree can be exercised under both platform
 * conventions (the ST-11 cross-platform oracle). `.js` specifiers per NodeNext.
 */
import nodePath from 'node:path';
import type { DirEntry, FileStat, FileSystem } from '../../src/fs/types.js';

/** A node in the in-memory tree. */
export type MemNode =
  | { kind: 'file'; size: number; mtime: Date; hidden: boolean }
  | { kind: 'dir'; children: Record<string, MemNode>; hidden: boolean }
  | { kind: 'symlink'; target: string; hidden: boolean };

const DEFAULT_MTIME = new Date('2026-07-04T09:05:00Z');

/** Build a file node. */
export function file(opts: { size?: number; mtime?: Date; hidden?: boolean } = {}): MemNode {
  return { kind: 'file', size: opts.size ?? 0, mtime: opts.mtime ?? DEFAULT_MTIME, hidden: opts.hidden ?? false };
}

/** Build a directory node from a `{ name: MemNode }` map. */
export function dir(children: Record<string, MemNode> = {}, opts: { hidden?: boolean } = {}): MemNode {
  return { kind: 'dir', children, hidden: opts.hidden ?? false };
}

/** Build a symlink node pointing at an absolute `target` path. */
export function symlink(target: string, opts: { hidden?: boolean } = {}): MemNode {
  return { kind: 'symlink', target, hidden: opts.hidden ?? false };
}

/** Options for {@link createMemoryFs}. */
export interface MemoryFsOptions {
  /** Path separator + semantics: `'posix'` (default) or `'win32'`. */
  flavor?: 'posix' | 'win32';
  /** Root list `roots()` returns (default `['/']` posix, `['C:\\']` win32). */
  roots?: string[];
  /** `homedir()` value (default `/home/user` posix, `C:\\Users\\user` win32). */
  home?: string;
}

/**
 * Create an in-memory `FileSystem` over `root` (the tree at the filesystem root). `root` must be a
 * `dir` node; its children are the top-level entries.
 */
export function createMemoryFs(root: MemNode, opts: MemoryFsOptions = {}): FileSystem {
  const flavor = opts.flavor ?? 'posix';
  const p = flavor === 'win32' ? nodePath.win32 : nodePath.posix;
  const sep = p.sep;
  const rootPath = flavor === 'win32' ? 'C:\\' : '/';
  const roots = opts.roots ?? [rootPath];
  const home = opts.home ?? (flavor === 'win32' ? 'C:\\Users\\user' : '/home/user');

  /** Split an absolute path into its segments (drive-aware for win32). */
  function segments(path: string): string[] {
    const abs = p.resolve(rootPath, path);
    const root = p.parse(abs).root; // '/' or 'C:\\'
    const rest = abs.slice(root.length);
    return rest.length === 0 ? [] : rest.split(p.sep).filter((s) => s.length > 0);
  }

  /** Resolve a path to its node, or `undefined` if any segment is missing / not a directory. */
  function nodeAt(path: string): MemNode | undefined {
    let cur: MemNode = root;
    for (const seg of segments(path)) {
      if (cur.kind !== 'dir') return undefined;
      const next: MemNode | undefined = cur.children[seg];
      if (next === undefined) return undefined;
      cur = next;
    }
    return cur;
  }

  /** Follow a symlink chain to its terminal node (guarded against cycles); `undefined` if broken. */
  function follow(node: MemNode, seen = new Set<string>()): MemNode | undefined {
    let cur: MemNode | undefined = node;
    while (cur !== undefined && cur.kind === 'symlink') {
      if (seen.has(cur.target)) return undefined; // cycle
      seen.add(cur.target);
      cur = nodeAt(cur.target);
    }
    return cur;
  }

  function statOf(node: MemNode | undefined): FileStat {
    if (node === undefined) throw new Error('ENOENT');
    if (node.kind === 'dir') return { kind: 'dir', size: 0, mtime: DEFAULT_MTIME };
    if (node.kind === 'symlink') return { kind: 'symlink', size: 0, mtime: DEFAULT_MTIME };
    return { kind: 'file', size: node.size, mtime: node.mtime };
  }

  return {
    sep,
    readDir(path: string): DirEntry[] {
      const node = nodeAt(path);
      if (node === undefined || node.kind !== 'dir') throw new Error('ENOENT: not a directory');
      const out: DirEntry[] = [];
      for (const [name, child] of Object.entries(node.children)) {
        if (child.kind === 'symlink') {
          const target = follow(child);
          out.push({
            name,
            kind: 'symlink',
            size: target && target.kind === 'file' ? target.size : 0,
            mtime: target && target.kind === 'file' ? target.mtime : DEFAULT_MTIME,
            hidden: child.hidden,
            broken: target === undefined,
          });
        } else if (child.kind === 'dir') {
          out.push({ name, kind: 'dir', size: 0, mtime: DEFAULT_MTIME, hidden: child.hidden });
        } else {
          out.push({ name, kind: 'file', size: child.size, mtime: child.mtime, hidden: child.hidden });
        }
      }
      return out;
    },
    stat(path: string): FileStat {
      return statOf(follow(nodeAt(path) ?? throwEnoent(path)));
    },
    lstat(path: string): FileStat {
      return statOf(nodeAt(path) ?? throwEnoent(path));
    },
    resolve: (...s: string[]) => p.resolve(rootPath, ...s),
    isAbsolute: (path: string) => p.isAbsolute(path),
    join: (...s: string[]) => p.join(...s),
    dirname: (path: string) => p.dirname(path),
    basename: (path: string) => p.basename(path),
    homedir: () => home,
    roots: () => [...roots],
  };
}

function throwEnoent(path: string): never {
  throw new Error(`ENOENT: ${path}`);
}
