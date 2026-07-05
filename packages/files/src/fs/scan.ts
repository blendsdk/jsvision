/**
 * Directory scan → sorted model (AC-3/AC-4). Runs over the {@link FileSystem} seam (never `node:fs`
 * directly), so the whole pipeline is headless + testable.
 *
 * TV decode (GATE-1) — population `TFileList::readDirectory` (`tfillist.cpp:159-240`): files via
 * `findAttr = FA_RDONLY | FA_ARCH` (hidden + system excluded by default, AC-4), then real
 * subdirectories whose name is not `.`-prefixed (dirs are **never** wildcard-filtered), then a
 * synthesized `..` when not at a root. Sort `TFileCollection::compare` (`tfilecol.cpp:47-56`): equal →
 * 0; `..` sorts **last**; a directory sorts **after** a file; else **case-sensitive** name. Symlinks are
 * file-like (PA-2 runtime): tagged `'symlink'`, wildcard applies, sorted in the file group.
 *
 * `.js` specifiers per NodeNext.
 */
import type { DirEntry, FileSystem } from './types.js';
import { wildcardMatch } from './wildcard.js';

/** The parent-directory entry (`..`), synthesized when the scanned path is not a filesystem root. */
const PARENT: DirEntry = { name: '..', kind: 'dir', size: 0, mtime: new Date(0), hidden: false };

/** Options for {@link scanDirectory}. */
export interface ScanOptions {
  /** The file wildcard (default `'*'`); applied to files only, never to directories (AC-3). */
  wildcard?: string;
  /** Include hidden (dot) entries (default `false` — TV `findAttr` excludes them, AC-4). */
  showHidden?: boolean;
  /** A caller predicate **AND-ed** with the wildcard (PA-10); never applied to `..`. Off by default. */
  filter?: (entry: DirEntry) => boolean;
}

/**
 * The TV sort comparator (`tfilecol.cpp:47-56`) — pure, over two entries. Top-to-bottom order:
 * files A–Z, then directories A–Z, then `..` last. Case-sensitive by name.
 *
 * @param a First entry.
 * @param b Second entry.
 * @returns `< 0`, `0`, or `> 0`.
 */
export function compareEntries(a: DirEntry, b: DirEntry): number {
  if (a.name === b.name) return 0;
  if (a.name === '..') return 1; // ".." sorts last
  if (b.name === '..') return -1;
  const aDir = a.kind === 'dir';
  const bDir = b.kind === 'dir';
  if (aDir && !bDir) return 1; // a directory sorts after a file
  if (bDir && !aDir) return -1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; // case-sensitive name (code-unit order)
}

/**
 * Scan `dirPath` over the seam and return the already-sorted model. Throws if the directory itself
 * cannot be read (the caller raises the error box, AC-12); a per-entry failure is skipped inside the
 * seam's `readDir` (never a partial/garbage list).
 *
 * @param fs      The filesystem seam.
 * @param dirPath The directory to scan.
 * @param opts    Wildcard / hidden / filter options.
 * @returns The sorted `DirEntry[]` (files → dirs → `..`).
 */
export function scanDirectory(fs: FileSystem, dirPath: string, opts: ScanOptions = {}): DirEntry[] {
  const wildcard = opts.wildcard ?? '*';
  const showHidden = opts.showHidden ?? false;
  const raw = fs.readDir(dirPath); // throws on an unreadable directory (defined failure, AC-12)

  const kept: DirEntry[] = [];
  for (const entry of raw) {
    if (entry.hidden && !showHidden) continue; // findAttr excludes hidden by default (AC-4)
    const isDir = entry.kind === 'dir'; // symlinks are file-like (PA-2 runtime)
    if (!isDir && !wildcardMatch(wildcard, entry.name)) continue; // wildcard on files only
    if (opts.filter && !opts.filter(entry)) continue; // AND-ed caller filter (PA-10)
    kept.push(entry);
  }

  if (!isRoot(fs, dirPath)) kept.push({ ...PARENT }); // synthesize ".." when not at a root
  kept.sort(compareEntries);
  return kept;
}

/** Whether `dirPath` is a filesystem root (its own parent) — no `..` is synthesized there. */
function isRoot(fs: FileSystem, dirPath: string): boolean {
  const abs = fs.resolve(dirPath);
  return fs.dirname(abs) === abs;
}
