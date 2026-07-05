# 03-01: `FileSystem` seam + pure cores

> **Parent**: [Index](00-index.md) · **Covers**: AC-1/AC-2/AC-3/AC-4/AC-7 (pure layers) · **AR**: PA-2/PA-4/PA-11
> These are the **view-free, TTY-free** foundations — unit-testable directly against an in-memory fs.

## `FileSystem` seam (`src/fs/types.ts` + `src/fs/node-fs.ts`) — AC-1, PA-2

An injectable interface (core's `RuntimeAdapter` host-seam pattern applied to fs). **Full synchronous
surface** (PA-2). No TV counterpart — extension; spec oracle, no diff.

```ts
export interface DirEntry {
  name: string;                    // basename, NOT sanitized here (draw-time sanitize, AC-14)
  kind: 'file' | 'dir' | 'symlink';
  size: number;                    // stat().size (target size for a resolved symlink)
  mtime: Date;                     // stat().mtime
  hidden: boolean;                 // dotfile (POSIX) | hidden attribute (Windows)
  broken?: boolean;                // symlink whose target does not resolve (AC-13)
}
export interface FileStat { kind: 'file' | 'dir' | 'symlink'; size: number; mtime: Date; }
export interface FileSystem {
  readDir(path: string): DirEntry[];      // readdirSync + per-entry lstatSync (+ stat for symlink target)
  stat(path: string): FileStat;           // follows symlinks
  lstat(path: string): FileStat;          // does not follow (detects the link)
  resolve(...segments: string[]): string; // node:path.resolve
  isAbsolute(path: string): boolean;
  join(...segments: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  readonly sep: string;                   // '/' | '\\'
  homedir(): string;                      // os.homedir()
  roots(): string[];                      // ['/'] on POSIX; drive letters on Windows
}
export const nodeFileSystem: FileSystem;  // the default, node:fs/node:path/node:os only (zero deps)
```

- **`readDir`** guards every per-entry `lstatSync` in a try/catch — a permission error on one entry
  **skips** it, never throws (AC-12). A symlink is `lstat`-tagged `'symlink'`; the target is `stat`-ed
  for `kind`/`size`/`mtime`; a broken link sets `broken:true` and leaves `kind:'symlink'` (AC-13).
- **`roots()`** — POSIX returns `['/']`; Windows enumerates drive letters (the seam abstracts the
  platform, AC-11). In-memory adapters return their own root set.
- **In-memory adapter (PA-11)** — a `test/helpers/memory-fs.ts` implementing `FileSystem` over a plain
  tree literal; **not shipped**. Drives every fs-touching spec headless (AC-1).

## Wildcard matcher (`src/fs/wildcard.ts`) — AC-2

### TV decode (GATE-1) — `source/platform/findfrst.cpp:162-186`, `tdircoll.cpp:144-147`
- `isWild(f)` = `strpbrk(f, "?*") != NULL` — true iff the string contains `*` or `?`.
- `wildcardMatch(pattern, name)`: `?` = exactly one char; `*` = greedy zero-or-more; any other char =
  **exact case-sensitive byte compare**. The `"*.*"` special case collapses to `"*"` (matches
  extensionless names too).
- **Case-sensitivity retained cross-platform** (PA/AR-243, PF-005): on Windows `*.TXT` will **not**
  match `readme.txt` — a deliberate documented fidelity choice.

```ts
export function isWild(pattern: string): boolean;          // strpbrk "?*"
export function wildcardMatch(pattern: string, name: string): boolean;  // ?/*, case-sensitive; "*.*"→"*"
```
Pure, bounds-checked for any pattern/name length (empty pattern, all-`*`, trailing `*`). No fs, no view.

## Directory scan → model (`src/fs/scan.ts`) — AC-3/AC-4

`scanDirectory(fs, path, { wildcard, showHidden, filter? }) → DirEntry[]` over the **seam** (never
`node:fs` directly), so the whole pipeline runs headless.

### TV decode (GATE-1) — `tfillist.cpp:159-240` (findAttr `:167`), `tfilecol.cpp:40-56`
- **Population** (`:159-240`): normal files (`findAttr = FA_RDONLY | FA_ARCH`) → real subdirectories
  (name not `.`-prefixed) → a synthesized `..` when not at a root. `findAttr` requests **neither hidden
  nor system** ⇒ hidden + system entries excluded by default (AC-4, also AR-239). `showHidden:true`
  includes dotfiles/hidden-attribute entries.
- **Wildcard filter** — applied to files (a typed `*`/`?` re-reads filtered by it); directories + `..`
  always shown.
- **Caller `filter` hook (PA-10)** — an optional `(entry) => boolean`, **AND-ed** with the wildcard
  (never replaces it); off by default.
- **Sort comparator** (`tfilecol.cpp:40-56`, corrected per preflight PF-001):
  ```c
  if strcmp(a,b)==0            return 0
  if a=="..":                  return +1   // ".." sorts LAST
  if b=="..":                  return -1
  if a.dir && !b.dir:          return +1   // directory AFTER file
  if b.dir && !a.dir:          return -1
  return strcmp(a,b)                       // else by name
  ```
  Top-to-bottom = **files A–Z, then directories A–Z, then `..` last**. Exposed as a pure
  `compareEntries(a, b)`; `scanDirectory` returns already-sorted. (Because the sort is NOT ascending
  `getText`, `FileList` passes `sorted:false` to `ListView` and feeds a pre-sorted `computed` — see
  [03-02](03-02-list-input-infopane.md).)
- Errors: a `readDir` throw (EACCES/ENOENT/ENOTDIR) is surfaced to the caller as a defined failure (the
  dialog raises the error box, AC-12); `scanDirectory` itself never emits a partial/garbage list.

## Directory-tree geometry (`src/fs/tree.ts`) — AC-7 (pure layer)

Pure builders for the `DirList` tree, view-free + golden-testable against the decode.

### TV decode (GATE-1) — `tdirlist.cpp:104-202`, glyphs `tvtext1.cpp:119-124`
- The tree = the **ancestor path chain** (root → … → current) + the **current directory's subdirs**,
  each indented `indentSize=2`.
- **Connectors** (`tvtext1.cpp:119-124`, CP437 → unambiguous-narrow Unicode, pinned at GATE-1):
  `pathDir="└─┬"`, `firstDir="└┬─"`, `middleDir=" ├─"`, `lastDir=" └─"`, closing `graphics="└├─"`.
- A **platform root** replaces TV's non-Unix `"Drives"` node: `roots()` (drive letters on Windows, `/`
  on POSIX) — AR-237.
- Output: a pure `buildDirTree(fs, currentPath) → DirNode[]` (`{ label, path, depth, connector, isCurrent }`)
  — the view maps each node to a drawn row; selecting a node → `cmChangeDir` with its `path`.

## Files & line budget

`src/fs/`: `types.ts`, `node-fs.ts`, `wildcard.ts`, `scan.ts`, `tree.ts`, `index.ts` — each ≤ 500 lines,
zero runtime deps, all indexing bounds-checked.
