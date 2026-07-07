/**
 * The `FileSystem` seam — the injectable interface that every disk-touching component in this package
 * goes through. Pass your own implementation to run the whole file-dialog family headless (in tests, a
 * demo, or against a virtual tree); pass nothing and the dialogs default to {@link nodeFileSystem},
 * which is backed by Node's `fs`/`path`/`os` built-ins.
 *
 * All methods are **synchronous** by design, so a directory listing or stat never yields mid-render.
 */

/**
 * A single directory entry: its basename plus the metadata the listing and info pane display. Names
 * are stored raw and only sanitized when drawn, so it is safe to hand entries straight to the widgets.
 */
export interface DirEntry {
  /** The basename (e.g. `'readme.txt'` or `'src'`), stored raw; the draw boundary sanitizes it. */
  name: string;
  /**
   * The entry's own type. A symlink keeps `kind:'symlink'` as its display tag, but its `size`/`mtime`
   * reflect the resolved target, and the directory scan treats it as file- or directory-like by
   * following the link.
   */
  kind: 'file' | 'dir' | 'symlink';
  /** File size in bytes (the target's size for a resolved symlink; `0` for a directory or broken link). */
  size: number;
  /** Last-modified time (the target's time for a resolved symlink). */
  mtime: Date;
  /** Whether the entry is hidden — a dotfile on POSIX, the hidden attribute on Windows. */
  hidden: boolean;
  /** Set when a symlink's target cannot be resolved; `kind` still reads `'symlink'`. */
  broken?: boolean;
}

/** A single stat result. `stat` follows symlinks to their target; `lstat` describes the link itself. */
export interface FileStat {
  kind: 'file' | 'dir' | 'symlink';
  size: number;
  mtime: Date;
}

/**
 * The injectable filesystem the dialogs read and write through. Implement it to point the family at a
 * virtual or remote tree; the path methods mirror `node:path`, the read methods mirror `node:fs`, and
 * `roots`/`homedir` abstract over the platform. Every method is synchronous.
 */
export interface FileSystem {
  /**
   * List one directory. Each entry is tagged by its own type (a symlink stays a symlink, with its
   * target's `size`/`mtime` and a `broken` flag). A permission error on a *single* entry skips just
   * that entry; a failure to open the directory itself throws (the dialog turns that into an error box).
   */
  readDir(path: string): DirEntry[];
  /** Describe a path, following symlinks to their target. Throws if the target is missing or unreadable. */
  stat(path: string): FileStat;
  /** Describe a path *without* following symlinks, so a link is reported as a link. */
  lstat(path: string): FileStat;
  /** Absolutize and normalize the joined segments (like `node:path.resolve`). */
  resolve(...segments: string[]): string;
  /** Whether the path is absolute (like `node:path.isAbsolute`). */
  isAbsolute(path: string): boolean;
  /** Join path segments (like `node:path.join`). */
  join(...segments: string[]): string;
  /** The parent directory of a path (like `node:path.dirname`). */
  dirname(path: string): string;
  /** The final segment of a path (like `node:path.basename`). */
  basename(path: string): string;
  /** The platform path separator (`'/'` on POSIX, `'\\'` on Windows). */
  readonly sep: string;
  /** The user's home directory (like `os.homedir()`). */
  homedir(): string;
  /** The filesystem roots — `['/']` on POSIX; the available drive letters on Windows. */
  roots(): string[];
  /** Read a file as UTF-8 text. Throws if the file is missing or unreadable. */
  readFile(path: string): string;
  /** Write UTF-8 text to a file, creating or replacing it. */
  writeFile(path: string, text: string): void;
  /** Rename or move a file. Throws if the source is missing. */
  rename(from: string, to: string): void;
  /** Delete a file. Throws if it is missing (the editor swallows this on a first-time `.bak`). */
  unlink(path: string): void;
}
