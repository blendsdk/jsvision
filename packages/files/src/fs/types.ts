/**
 * The `FileSystem` seam (AC-1, PA-2) — the injectable interface every disk-touching component goes
 * through, so the whole family runs headless against an in-memory adapter in tests + the kitchen-sink
 * story. The default `nodeFileSystem` ({@link ./node-fs.ts}) implements it over `node:fs`/`node:path`/
 * `node:os` (zero runtime deps). **Full synchronous surface** (PA-2). No TV counterpart — extension.
 *
 * `.js` specifiers per NodeNext.
 */

/** A single directory entry (basename + resolved metadata). Names are sanitized at draw-time (AC-14). */
export interface DirEntry {
  /** The basename (NOT sanitized here — the draw boundary sanitizes, AC-14). */
  name: string;
  /**
   * The entry's own type. A symlink keeps `kind:'symlink'` as its display tag; its `size`/`mtime` come
   * from the resolved target, and `scanDirectory` categorizes it (file- vs dir-like) by following the
   * link (PA-2 runtime).
   */
  kind: 'file' | 'dir' | 'symlink';
  /** `stat().size` — the target size for a resolved symlink; `0` for a directory / broken link. */
  size: number;
  /** `stat().mtime` — the target mtime for a resolved symlink. */
  mtime: Date;
  /** Dotfile (POSIX) or hidden attribute (Windows). */
  hidden: boolean;
  /** A symlink whose target does not resolve (AC-13); `kind` stays `'symlink'`. */
  broken?: boolean;
}

/** A stat result (`stat` follows symlinks; `lstat` does not). */
export interface FileStat {
  kind: 'file' | 'dir' | 'symlink';
  size: number;
  mtime: Date;
}

/**
 * The injectable filesystem seam. All methods are **synchronous** (PA-2; async → DEF-32). Path methods
 * mirror `node:path`; `readDir`/`stat`/`lstat` mirror `node:fs`; `roots`/`homedir` abstract the platform.
 */
export interface FileSystem {
  /**
   * List a directory. Each entry is `lstat`-tagged; a symlink's target is `stat`-ed for `size`/`mtime`
   * and `broken`. A permission error on **one** entry skips it, never throws the whole call (AC-12); a
   * failure to open the directory itself throws (the caller surfaces the error box).
   */
  readDir(path: string): DirEntry[];
  /** Stat following symlinks (throws on a missing / unreadable target). */
  stat(path: string): FileStat;
  /** Stat WITHOUT following symlinks (detects the link itself). */
  lstat(path: string): FileStat;
  /** `node:path.resolve` — absolutize + normalize. */
  resolve(...segments: string[]): string;
  /** `node:path.isAbsolute`. */
  isAbsolute(path: string): boolean;
  /** `node:path.join`. */
  join(...segments: string[]): string;
  /** `node:path.dirname`. */
  dirname(path: string): string;
  /** `node:path.basename`. */
  basename(path: string): string;
  /** The path separator (`'/'` POSIX, `'\\'` Windows). */
  readonly sep: string;
  /** `os.homedir()`. */
  homedir(): string;
  /** Filesystem roots — `['/']` on POSIX; drive letters on Windows (AC-11). */
  roots(): string[];
  // --- RD-08 PA-6 content methods (additive) — the TV save sequence transcribes 1:1 over these
  // (`unlink(bak)` ignore-missing → `rename(file, bak)` → `writeFile(file, text)`,
  // `tfiledtr.cpp:186-193`); no platform-dependent rename-overwrite semantics hide in the seam. --
  /** Read a file as UTF-8 text (throws on missing/unreadable — the caller routes to the seam). */
  readFile(path: string): string;
  /** Write (create or replace) a file with UTF-8 text. */
  writeFile(path: string, text: string): void;
  /** Rename/move a file (throws on a missing source). */
  rename(from: string, to: string): void;
  /** Delete a file (throws on missing — the first-save `.bak` case is swallowed by the caller). */
  unlink(path: string): void;
}
