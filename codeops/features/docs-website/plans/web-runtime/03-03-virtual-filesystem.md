# 03-03 · Browser Virtual FileSystem

> **Document**: 03-03-virtual-filesystem.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-02 Must-Have #5 · ST-4, ST-9 (path half), ST-11 · AR-6

## Goal

`src/virtual-fs.ts` — `createBrowserFileSystem(tree?)`: an in-memory implementation of
`@jsvision/files`' `FileSystem` (all 18 methods, `packages/files/src/fs/types.ts:45-80`) so the whole
file-dialog family + editor run in the browser unchanged, with **no `node:fs` import**.

## Seed format

```ts
/** A seed tree: a file is its UTF-8 string content; a directory is a nested record. */
export type FileTree = { [name: string]: string | FileTree };

export interface BrowserFileSystemOptions {
  /** The initial tree, keyed from the root (or from `home`). */
  readonly tree?: FileTree;
  /** The home directory the dialogs open at. Default '/home/demo'. */
  readonly home?: string;
  /** The deterministic mtime for every seeded entry (AR-6). Default a fixed epoch. */
  readonly mtime?: Date;
}
export function createBrowserFileSystem(options?: BrowserFileSystemOptions): FileSystem;
```

The RD's AC-4 seed shape (`{ '/home/demo': { 'a.txt':'…', 'sub': { 'b.txt':'…' } } }`) is supported —
an absolute-path key seeds at that path; nested records are directories; string leaves are files.

## Internal model

An in-memory node tree: `{ kind:'file', content:string, mtime:Date } | { kind:'dir', children:Map<string,Node> }`.
`seed()` walks the `FileTree` building it. Writes (for tvedit) mutate this tree only — nothing leaves
the browser (AR-6 / security).

## Method map (18 methods)

| Method | Implementation |
|--------|----------------|
| `readDir(path)` | resolve node → `dir` → `DirEntry[]` (name, `kind:'file'\|'dir'`, size = content byte-length, mtime, `hidden` = name starts with `.`). Sorted for determinism. Missing/`file` → throw (AC-4 error box). |
| `stat(path)` / `lstat(path)` | resolve → `{ kind, size, mtime }`. **`lstat === stat`** (no symlinks, AR-6). Missing → throw. |
| `readFile(path)` | resolve → `file` → `content`. Missing/`dir` → throw. |
| `writeFile(path, text)` | resolve parent → set/replace a `file` child (mtime = now or fixed). Missing parent → throw. |
| `rename(from, to)` | move the node; missing `from` → throw. |
| `unlink(path)` | delete the node; missing → throw. |
| `resolve(...seg)` | POSIX `path.resolve` semantics — absolutize against `home`, normalize `.`/`..`, collapse `//`. Pure string op. |
| `join(...seg)` | POSIX join + normalize. |
| `isAbsolute(p)` | `p.startsWith('/')`. |
| `dirname(p)` / `basename(p)` | POSIX split. |
| `sep` | `'/'`. |
| `homedir()` | the configured `home`. |
| `roots()` | `['/']`. |

Path methods are **pure POSIX string operations** — `..` is normalized away lexically, never resolved
against a real filesystem, and can never escape into `node:fs` (there is none). This is the ST-9 path
half + the RD security requirement (`..` normalized, no real path touched).

## Error shapes

Throw errors whose `message`/shape match what `@jsvision/files`' dialogs expect on missing/denied
paths (read `packages/files/src/fs/node-fs.ts` for the exact shapes the widgets catch and render), so
a missing-path error box in the browser reads identically to native. A single bad entry in `readDir`
is skipped (per the interface contract); a failure to open the directory itself throws.

## Specification tests

- **ST-4 / AC-4**: mount a real `FileList` (or `FileDialog`) from `@jsvision/files` against a virtual
  FS seeded `{ '/home/demo': { 'a.txt':'…', 'sub': { 'b.txt':'…' } } }`; assert it lists `a.txt` +
  `sub`, and entering `sub` lists `b.txt`. The import-graph assertion (no `node:fs`) is ST-1's
  companion in packaging.
- **ST-11 / AC-9 (path)**: every method behaves per the table; `resolve('/home/demo', '../x')` →
  `/home/x` (lexical, no fs touch); `readDir` on a file throws; `writeFile` then `readFile`
  round-trips; `rename`/`unlink` mutate; a missing path throws the dialog-compatible error.

## Verify (this component)

`yarn verify` green; ST-4, ST-11 pass; `check:docs` green (`createBrowserFileSystem` + types carry
`@example`).
