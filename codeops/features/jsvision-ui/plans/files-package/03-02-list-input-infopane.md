# 03-02: `FileList` + `FileInput` + `FileInfoPane` (the listing trio)

> **Parent**: [Index](00-index.md) · **Covers**: AC-3/AC-4/AC-5/AC-6 · **AR**: PA-9/PA-10/PA-14
> All three are **TV-derived** ⇒ GATE-1 BEFORE-decode (here) + GATE-2 AFTER-diff (Phase 7) mandatory.

---

## `FileList` — `src/list/file-list.ts` (decode of `TFileList`, extends `ListView<DirEntry>`)

### TV decode (GATE-1)
- **Class** — `TFileList : TSortedListBox`; ctor `TSortedListBox(bounds, 2, aScrollBar)` (`tfillist.cpp:64`)
  ⇒ **2 columns** (PA-14). Rect `(3,6,34,14)` in the dialog = 31×8.
- **Row text `getText`** (`tfillist.cpp:113-121`): the entry `name`; a **directory** gets a **trailing
  path separator** appended (`strcat(dest, "\\")`, `:119-120`) — platform-corrected to `fs.sep`
  (`NAME/` POSIX, `NAME\` Windows). **NOT** `[NAME]` brackets (preflight-confirmed; AR-247).
- **Column layout** (`tlstview.cpp`, via PA-14's `numCols`): items flow **column-major** (fill column 0
  top-to-bottom, then column 1); each column width = `floor(size.x / numCols)`; a `│` divider
  (`0xB3` → `│`) at each interior column's right edge (`tlstview.cpp:150`).
- **Sort** (`tfilecol.cpp:40-56`) — files → dirs → `..` last (see [03-01](03-01-fs-seam-and-cores.md)
  `compareEntries`).
- **Colours** — the reused `list*` roles (focus `getColor(3)` etc.) through the gray-dialog chain; no
  new role.
- **Broadcasts** (`tfillist.cpp` `focusItem`/`selectItem`, cmds `cmFileFocused=102`/`cmFileDoubleClicked=103`,
  `stddlg.h:42-43`) — focusing a row broadcasts focus (the input + info-pane track); Enter/double-click
  broadcasts open.
- **Type-ahead** — the `TListViewer::getKey` search-as-you-type.

### jsvision realization
- `extends ListView<DirEntry>` with `getText(e) = e.name + (e.kind === 'dir' ? fs.sep : '')`,
  `numCols: 2` (PA-14), `typeAhead: true`, `sorted: false` (the items signal is a **pre-sorted
  `computed`** using `compareEntries`, since the TV order is not ascending `getText`).
- **Scrollbar (PA-14 bar seam)** — inside `FileDialog`, `FileList` is handed a **horizontal-rendered
  bottom** `ScrollBar` at the decoded `(3,14,34,15)` (via ListView's injectable/orientable-bar seam;
  the default elsewhere stays a vertical right-edge bar). It is `TListViewer`'s **vScrollBar** (drives
  `topItem`/`focused`; step `pgStep = size.y*2` / `arStep = size.y`) — the scroll stays **vertical**;
  only the *draw* is 2-column column-major with the `│` divider (`getColor(5)`).
  **Ownership:** the `FileDialog` **owns + places** this bar as an absolute sibling at `(3,14,34,15)`;
  `FileList` **binds** to it (shares `focused`, drives `setRange`) — ListView's seam here is
  *use-an-external-bar*, not *lay-one-out-internally* (`list-view.ts:76-80` lays out its default bar as
  a `[rows fr\|bar 1]` child, which would land at the list's right edge, not the decoded bottom).
- A **reveal toggle** signal drives `showHidden` in the scan `computed` (AC-4). The caller `filter` hook
  (PA-10) is AND-ed in the same `computed`.
- **Focus broadcast** → an `onFocusEntry(entry)` callback (RD-04 command/broadcast) the `FileInput` +
  `FileInfoPane` subscribe to; **open** (Enter/double-click) → an `onOpenEntry(entry)` callback the
  dialog uses to enter a dir / resolve a file.
- Every drawn name is `sanitize`-clean via the `DrawContext`/`ScreenBuffer.set` boundary (AC-14).
- Bounds: empty listing (no `..` at a root), single entry, a name longer than the column width (clipped,
  never overruns the divider) all handled.

---

## `FileInput` — `src/input/file-input.ts` (decode of `TFileInputLine`, extends `Input`)

### TV decode (GATE-1) — `stddlg.cpp:69-92`
- `TFileInputLine : TInputLine`; on `evBroadcast` with `cmFileFocused` **and while not itself the
  focused view** (`:78`), it mirrors the focused entry's name into its `data`; for a **directory** it
  appends the separator **+ the owner dialog's `wildCard`** (`:83-88`) so the field reads
  `subdir/‹wildcard›`. Otherwise a plain `TInputLine`.

### jsvision realization
- `extends Input`; subscribes to the `FileList` focus broadcast (PA-9 wiring): on focus, if this input
  is **not** the focused view, set its value to `entry.name` for a file, or
  `entry.name + fs.sep + wildcard()` for a directory. A no-op while the user is typing in the field
  (the `not focused` guard). Reuses `Input`'s two-way `Signal<string>` + optional `filter`.

---

## `FileInfoPane` — `src/list/file-info-pane.ts` (decode of `TFileInfoPane`, extends `View`)

### TV decode (GATE-1) — `stddlg.cpp:215-315` (fields `:244-293`)
- `TFileInfoPane : TView`, rect `(1,16,48,18)` in the dialog (47×2). Palette `cpInfoPane = "\x1E"` — a
  **single** entry, `getColor(1)` (PA-6: resolve `0x1E` through the gray-dialog → `cpAppColor` chain at
  GATE-1; add the single additive `fileInfo` role only if it proves distinct).
- **Row 0** — the expanded current directory path.
- **Row 1** — the focused entry's **name**, then **right-aligned** (relative to `size.x`):
  `size` · `month` · `day` · `year` · `hh:mm` · `a`/`p` (12-hour clock, the `months[]` table `:230`).
  **No attributes field** (TV renders none — preflight-confirmed; AR-247).
- **Rows 2..** cleared. Updates on the `cmFileFocused` broadcast.

### jsvision realization
- `extends View`; binds the `FileList` focused-entry signal; `draw()` writes row 0 = `fs.resolve(path)`
  (sanitized), row 1 = name + the right-aligned `size month day year hh:mm a/p` computed from
  `entry.size`/`entry.mtime` (a local `MONTHS` table, 12-hour). Right-alignment math clamped to `size.x`
  (a very long name truncates so the fields still fit — bounds-checked, AC/security). Remaining rows
  blank-filled. Colour = the resolved info role (PA-6). A **broken symlink** (`entry.broken`) shows the
  name with an unresolved marker, no size/date (AC-13). Every field `sanitize`-clean (AC-14).

## Line budget
`file-list.ts`, `file-input.ts`, `file-info-pane.ts` each ≤ 500 lines. The 2-column layout lives in
`@jsvision/ui`'s `ListRows` (PA-14), not duplicated here.
