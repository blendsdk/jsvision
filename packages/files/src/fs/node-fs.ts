/**
 * `nodeFileSystem` — the default {@link FileSystem} over Node built-ins (`node:fs`/`node:path`/
 * `node:os`), zero runtime deps (AC-1). Every disk read is synchronous (PA-2) and guarded so a bad
 * entry never crashes a listing (AC-12); symlinks are `lstat`-tagged with target `size`/`mtime` and a
 * `broken` flag (AC-13). `.js` specifiers per NodeNext.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { DirEntry, FileStat, FileSystem } from './types.js';

/** Map a Node `Stats`-like kind to our discriminated `FileStat.kind`. */
function kindOf(st: fs.Stats): FileStat['kind'] {
  if (st.isSymbolicLink()) return 'symlink';
  if (st.isDirectory()) return 'dir';
  return 'file';
}

/**
 * Build a {@link DirEntry} for one directory child. `lstat` tags the entry (so a symlink stays a
 * symlink); for a symlink the target is `stat`-ed for `size`/`mtime`, and an unresolvable target sets
 * `broken`. Any stat failure is caught by the caller (the entry is skipped).
 */
function entryFor(dirPath: string, name: string): DirEntry {
  const full = path.join(dirPath, name);
  const ls = fs.lstatSync(full);
  const hidden = name.startsWith('.'); // dotfile (POSIX); the Windows hidden attribute isn't portably
  // readable without a native dep, so dotfile detection is used on all platforms (seam-abstracted).
  if (ls.isSymbolicLink()) {
    try {
      const target = fs.statSync(full); // follows the link
      return {
        name,
        kind: 'symlink',
        size: target.isDirectory() ? 0 : target.size,
        mtime: target.mtime,
        hidden,
      };
    } catch {
      return { name, kind: 'symlink', size: 0, mtime: ls.mtime, hidden, broken: true };
    }
  }
  return {
    name,
    kind: ls.isDirectory() ? 'dir' : 'file',
    size: ls.isDirectory() ? 0 : ls.size,
    mtime: ls.mtime,
    hidden,
  };
}

/** The default filesystem — `node:fs`/`node:path`/`node:os` only. */
export const nodeFileSystem: FileSystem = {
  sep: path.sep,
  readDir(dirPath: string): DirEntry[] {
    const names = fs.readdirSync(dirPath); // throws if the directory itself can't be opened (AC-12)
    const out: DirEntry[] = [];
    for (const name of names) {
      try {
        out.push(entryFor(dirPath, name));
      } catch {
        // A permission/stat error on ONE entry skips it, never fails the whole listing (AC-12).
      }
    }
    return out;
  },
  stat(p: string): FileStat {
    const st = fs.statSync(p);
    return { kind: kindOf(st), size: st.size, mtime: st.mtime };
  },
  lstat(p: string): FileStat {
    const st = fs.lstatSync(p);
    return { kind: kindOf(st), size: st.size, mtime: st.mtime };
  },
  resolve: (...segments: string[]) => path.resolve(...segments),
  isAbsolute: (p: string) => path.isAbsolute(p),
  join: (...segments: string[]) => path.join(...segments),
  dirname: (p: string) => path.dirname(p),
  basename: (p: string) => path.basename(p),
  homedir: () => os.homedir(),
  roots(): string[] {
    if (process.platform === 'win32') {
      const drives: string[] = [];
      for (let c = 'A'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c += 1) {
        const root = `${String.fromCharCode(c)}:\\`;
        try {
          if (fs.existsSync(root)) drives.push(root);
        } catch {
          // ignore an inaccessible drive letter
        }
      }
      return drives.length > 0 ? drives : ['C:\\'];
    }
    return ['/'];
  },
};
