/**
 * Scans a directory into the sorted, filtered model the file listing displays. It reads through the
 * injectable {@link FileSystem} (never `node:fs` directly), so the same pipeline works against a
 * virtual tree in tests or a demo.
 *
 * Ordering and filtering rules the result obeys:
 *   - files come first (A–Z), then directories (A–Z), then a synthesized `..` entry last.
 *   - the wildcard applies to files only — directories are always shown.
 *   - hidden (dot) entries are excluded unless `showHidden` is set.
 *   - a `..` entry is added whenever the scanned path is not a filesystem root.
 *   - symlinks are treated as files: the wildcard applies and they sort in the file group.
 */
import type { DirEntry, FileSystem } from './types.js';
import { wildcardMatch } from './wildcard.js';

/** The parent-directory entry (`..`), synthesized when the scanned path is not a filesystem root. */
const PARENT: DirEntry = { name: '..', kind: 'dir', size: 0, mtime: new Date(0), hidden: false };

/** Options for {@link scanDirectory}. */
export interface ScanOptions {
  /** The file wildcard (default `'*'`). Applied to files only; directories are always listed. */
  wildcard?: string;
  /** Include hidden (dot) entries (default `false`). */
  showHidden?: boolean;
  /** An extra predicate AND-ed with the wildcard; never applied to `..`. Off by default. */
  filter?: (entry: DirEntry) => boolean;
}

/**
 * The listing sort order, as a comparator over two entries: files A–Z, then directories A–Z, then
 * `..` last, comparing names case-sensitively. Pass it to `Array.prototype.sort`.
 *
 * @param a First entry.
 * @param b Second entry.
 * @returns A negative, zero, or positive number, as `sort` expects.
 * @example
 * import { compareEntries } from '@jsvision/files';
 * import type { DirEntry } from '@jsvision/files';
 *
 * const entries: DirEntry[] = readSomeEntries();
 * entries.sort(compareEntries); // files first, then dirs, then '..'
 */
export function compareEntries(a: DirEntry, b: DirEntry): number {
  if (a.name === b.name) return 0;
  if (a.name === '..') return 1; // ".." always sorts last
  if (b.name === '..') return -1;
  const aDir = a.kind === 'dir';
  const bDir = b.kind === 'dir';
  if (aDir && !bDir) return 1; // a directory sorts after a file
  if (bDir && !aDir) return -1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; // case-sensitive name order
}

/**
 * Scan one directory through a filesystem and return the sorted, filtered listing model.
 *
 * Throws if the directory itself cannot be read — callers turn that into an error box. A failure on a
 * single entry is skipped by the filesystem's `readDir`, so the result is never partial or garbage.
 *
 * @param fs      The filesystem to read through.
 * @param dirPath The directory to scan.
 * @param opts    Wildcard, hidden-file, and extra-filter options.
 * @returns The sorted entries (files, then directories, then `..`).
 * @example
 * import { scanDirectory, nodeFileSystem } from '@jsvision/files';
 *
 * const entries = scanDirectory(nodeFileSystem, '/home/user', { wildcard: '*.ts' });
 * for (const e of entries) console.log(e.kind, e.name);
 */
export function scanDirectory(fs: FileSystem, dirPath: string, opts: ScanOptions = {}): DirEntry[] {
  const wildcard = opts.wildcard ?? '*';
  const showHidden = opts.showHidden ?? false;
  const raw = fs.readDir(dirPath); // throws if the directory itself is unreadable

  const kept: DirEntry[] = [];
  for (const entry of raw) {
    if (entry.hidden && !showHidden) continue; // hidden entries excluded unless requested
    const isDir = entry.kind === 'dir'; // symlinks count as files here
    if (!isDir && !wildcardMatch(wildcard, entry.name)) continue; // wildcard filters files only
    if (opts.filter && !opts.filter(entry)) continue; // extra caller filter
    kept.push(entry);
  }

  if (!isRoot(fs, dirPath)) kept.push({ ...PARENT }); // add ".." unless we are at a root
  kept.sort(compareEntries);
  return kept;
}

/** Whether `dirPath` is a filesystem root (its own parent) — no `..` is synthesized there. */
function isRoot(fs: FileSystem, dirPath: string): boolean {
  const abs = fs.resolve(dirPath);
  return fs.dirname(abs) === abs;
}
