/**
 * The default {@link FileSystem}, backed by Node's `fs`/`path`/`os` built-ins with no extra
 * dependencies. This is what the file dialogs use when you do not inject your own filesystem.
 *
 * Every read is synchronous and guarded, so a single unreadable entry never crashes a listing.
 * Symlinks are reported as symlinks, carrying their target's `size`/`mtime` and a `broken` flag when
 * the target cannot be resolved.
 *
 * @example
 * import { FileDialog, nodeFileSystem } from '@jsvision/files';
 *
 * // The default — passing `nodeFileSystem` explicitly is equivalent to omitting `fs`.
 * const dlg = new FileDialog({ fs: nodeFileSystem });
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { DirEntry, FileStat, FileSystem } from './types.js';

/** Reduce a Node `Stats` to the discriminated `FileStat.kind`. */
function kindOf(st: fs.Stats): FileStat['kind'] {
  if (st.isSymbolicLink()) return 'symlink';
  if (st.isDirectory()) return 'dir';
  return 'file';
}

/**
 * Build a {@link DirEntry} for one directory child. `lstat` tags the entry so a symlink stays a
 * symlink; for a symlink the target is followed for `size`/`mtime`, and an unresolvable target is
 * flagged `broken`. A stat failure propagates so the caller can skip just this entry.
 */
function entryFor(dirPath: string, name: string): DirEntry {
  const full = path.join(dirPath, name);
  const ls = fs.lstatSync(full);
  // The Windows hidden attribute is not portably readable without a native dependency, so dotfile
  // detection is used on every platform; inject a custom filesystem if you need the true attribute.
  const hidden = name.startsWith('.');
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

/** The default filesystem — Node's `fs`/`path`/`os` only. */
export const nodeFileSystem: FileSystem = {
  sep: path.sep,
  readDir(dirPath: string): DirEntry[] {
    const names = fs.readdirSync(dirPath); // throws if the directory itself cannot be opened
    const out: DirEntry[] = [];
    for (const name of names) {
      try {
        out.push(entryFor(dirPath, name));
      } catch {
        // A permission/stat error on a single entry skips it, never failing the whole listing.
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
  // File content methods — plain synchronous UTF-8 reads and writes.
  readFile: (p: string) => fs.readFileSync(p, 'utf8'),
  writeFile: (p: string, text: string) => {
    fs.writeFileSync(p, text, 'utf8');
  },
  rename: (from: string, to: string) => {
    fs.renameSync(from, to);
  },
  unlink: (p: string) => {
    fs.unlinkSync(p);
  },
};
