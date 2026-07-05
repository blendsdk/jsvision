# RD-09: Files package `@jsvision/files` — FileDialog/FileList/FileInput/FileInfoPane/DirList/ChDirDialog (decode-first from `tfildlg.cpp`/`tdirlist.cpp`/`tchdrdlg.cpp`)

> **Document**: RD-09-files-package.md
> **Status**: Draft
> **Created**: 2026-07-05 (`make_requirements` — the **Phase R** files relocation)
> **Project**: jsvision UI (`@jsvision/ui` → new sibling package `@jsvision/files`)
> **Depends On**: RD-05 (App shell — done; `Dialog`/`Window`/`Desktop` + modal `execView`/`endModal` the file dialogs run inside), RD-06 (Essential controls — done; `Input`/`Label`/`Button` + the `filter` validator + `cpGrayDialog` theme roles), RD-11 (Containers/scrolling/lists — done; `ListView`/`ListBox`/`ScrollBar` the `FileList`/`DirList` extend, and the `Dialog` `valid()` close-gate), RD-14 (Input dropdowns — done; the `History` dropdown the file/dir input composes, Should-Have), RD-04 (Event loop — done; command/broadcast dispatch, focus), RD-01/RD-02/RD-03 (reactive core, layout, view spine — done), `@jsvision/core` (done; `sanitize`, `Theme`/`defaultTheme`, the DOS-16 palette). **New runtime dependency boundary:** `@jsvision/files` depends on `@jsvision/ui` (which is `private` until its first release), so `@jsvision/files` is likewise `private` until then (AR-242).
> **Set**: **Phase R — Files** (the component map's §9 "Relocate to `@jsvision/files` 🟣"): the fs-bound dialogs the core UI package deliberately excludes. The **second published-shape package** in the portfolio (after `@jsvision/ui`), and the first to layer on top of `ui`.
> **CodeOps Skills Version**: 3.3.0

---

## Feature Overview

A new **`@jsvision/files`** package: the Turbo Vision **file-system dialog family**, relocated out of the
core UI package because it drags in `fs`/path concerns `@jsvision/ui` deliberately avoids (component map
§9). It provides the idiomatic way for a TUI app to **open/save a file** and **change the working
directory** — a faithful re-creation of Borland Turbo Vision's standard file dialogs, built by composing
the already-shipped `@jsvision/ui` widgets (`Dialog`, `ListView`, `Input`, `Label`, `Button`, `ScrollBar`,
`History`).

**GATE-1 fidelity finding (`magiblot/tvision`).** Turbo Vision has **every** class in this family to
decode — so per the **NON-NEGOTIABLE TV-fidelity directive** the drawing/geometry/glyphs/colour of each is
a **decode**, not a design (re-verified cell-by-cell at plan GATE-1/GATE-2):

| Reimagined | TV class | Declared | Implemented |
|-----------|----------|----------|-------------|
| `FileDialog` | `TFileDialog : TDialog` | `stddlg.h:404-457` | `tfildlg.cpp:58-190` |
| `FileList` | `TFileList : TSortedListBox` | `stddlg.h:258-299` | `tfillist.cpp:62-240`, sort `tfilecol.cpp:40-56` |
| `FileInput` | `TFileInputLine : TInputLine` | `stddlg.h:71-94` | `stddlg.cpp:69-92` |
| `FileInfoPane` | `TFileInfoPane : TView` | `stddlg.h:336-367` | `stddlg.cpp:215-315` |
| `DirList` | `TDirListBox : TListBox` | `stddlg.h:593-636` | `tdirlist.cpp:34-209` |
| `ChDirDialog` | `TChDirDialog : TDialog` | `stddlg.h:668-718` | `tchdrdlg.cpp:42-218` |

**Decoded facts (to be re-verified at plan GATE-1/GATE-2):**

| Piece | TV decode | `file:line` |
|-------|-----------|-------------|
| `FileDialog` geometry | `TDialog`, `getRect TRect(15,1,64,20)` = **49×19**, `ofCentered`+`wfGrow`, `min 49×19`; composes `FileInputLine(3,3,31,4)` + its caller-supplied `inputName` label (not a hardcoded `~F~ile`) + `History(31,3,34,4)` + list `ScrollBar(3,14,34,15)` + `FileList(3,6,34,14)` + `~F~iles` label + a stacked **button strip** (`r=TRect(35,3,46,5)`, `+3 rows` each: Open`bfDefault`/OK/Replace/Clear/Cancel/Help) + `FileInfoPane(1,16,48,18)` | `tfildlg.cpp:58-190` |
| `FileDialog` wildcard + valid | `getFileName` → `fexpand`+`fnsplit`; empty name+ext re-merges the wildCard; `valid()`: `isWild`→reread, `isDir`→enter, `validFileName`→OK, else **`messageBox(mfError, "Invalid file name: '%s'")`**; `checkDirectory` fail → **`messageBox(mfError, "Invalid drive or directory")`** | `tfildlg.cpp:209-351` |
| `FileList` rows | `TSortedListBox` **2-column**; `getText` = `name`, **directory ⇒ trailing `\`** (`strcat(dest,"\\")`, **not** `[NAME]` brackets); sort: directories **after** files, `..` **last** (`compare` returns `+1` for `..`, so it sorts greatest), else `strcmp`; column divider `│` (`0xB3`) | `tfillist.cpp:113-121`, `tfilecol.cpp:40-56`, `tlstview.cpp:150` |
| `FileList` population | scan `findAttr = FA_RDONLY\|FA_ARCH` (normal files) → real subdirs (name not `.`-prefixed) → synth `..`; **hidden + system entries EXCLUDED** (findAttr requests neither) | `tfillist.cpp:159-240` (findAttr `:167`) |
| `FileInput` behaviour | `TInputLine` + `evBroadcast`; on `cmFileFocused` (not selected) mirror focused name into `data`, and for a directory append `\` + the owner's `wildCard` | `stddlg.cpp:69-92` |
| `FileInfoPane` draw | `TView`, palette `cpInfoPane="\x1E"` (1 entry, `getColor(1)=0x1E`); **row 0** = expanded path, **row 1** = name + right-aligned **size · month · day · year · hh:mm · a/p** (`months[]` table); **no attributes field**; rows 2.. cleared | `stddlg.cpp:215-315` (fields `:244-293`) |
| `DirList` tree | `TListBox` **1-column**; CP437 connectors `pathDir="└─┬"` `firstDir="└┬─"` `middleDir=" ├─"` `lastDir=" └─"` `graphics="└├─"`, `indentSize=2`; builds the ancestor path chain + current-dir subdirs; a `"Drives"` root on non-Unix; `selectItem`→`cmChangeDir` | `tdirlist.cpp:104-202`, glyphs `tvtext1.cpp:119-124` |
| `ChDirDialog` geometry | `TDialog`, `getRect TRect(16,2,64,20)` = **48×18**, `ofCentered`+`wfGrow`, `min 48×18`; composes `dirInput(3,3,42,4)` + `~n~ame` label + `History(42,3,45,4)` + tree `ScrollBar(32,6,33,16)` + `DirListBox(3,6,32,16)` + `~t~ree` label + buttons **OK`(35,6,45,8)bfDefault` · Chdir`(35,9)` · Revert`(35,12)` · Help`(35,15)`** (10×2, every 3 rows); `valid(cmOK)`→`changeDir`, fail → **`messageBox(mfError, "Invalid directory")`** | `tchdrdlg.cpp:42-218` |
| Palette (both dialogs) | **No `cpFileDialog`/`cpChDirDialog` exists** — both are plain `TDialog`s inheriting the gray dialog palette (`cpGrayDialog` default); every child colour resolves `getColor(N)` → `cpListViewer`/`cpInputLine`/`cpButton`/`cpInfoPane` → **gray-dialog** → `cpAppColor` | `dialogs.h:80-92`, `tlstview.cpp:30`, `stddlg.cpp:67`, `tbutton.cpp:41` |
| Wildcard matcher | `isWild = strpbrk(f,"?*")`; `wildcardMatch`: `?`=one char, `*`=greedy, else **exact byte compare (case-sensitive)**; `"*.*"`→`"*"` | `tdircoll.cpp:144-147`, `source/platform/findfrst.cpp:121-186` |

**Behavior may extend TV** (an injectable `FileSystem` seam, cross-platform paths, reactive binding,
async modality via `execView`) but the **drawing — dialog geometry, list rows, the info-pane field
layout, the directory-tree connectors, and every resolved colour — must match the decode**, pinned at
plan GATE-1/GATE-2.

The components in scope (all six — AR-238):

| Component | Basis | Role |
|-----------|-------|------|
| `FileDialog` | **decode** — `TFileDialog` (`tfildlg.cpp`), composing `Dialog` | A modal open/save dialog: a filename `FileInput` (+ `History`), a `FileList`, a `FileInfoPane`, and an Open/OK/Replace/Clear/Cancel/Help button strip; resolves to the chosen file path via the RD-11 `Dialog` `valid()` close-gate. |
| `FileList` | **decode** — `TFileList` (`tfillist.cpp`), extending `ListView` | The 2-column virtual-scroll file listing: files + directories (trailing separator) + `..`, TV sort order (dirs after files, `..` last), type-ahead, broadcasts a focus/double-click so the input + info pane track. |
| `FileInput` | **decode** — `TFileInputLine` (`stddlg.cpp`), extending `Input` | The filename edit field that mirrors the focused list entry (appending the wildcard for a directory). |
| `FileInfoPane` | **decode** — `TFileInfoPane` (`stddlg.cpp`), a `View` | The passive read-out pane: expanded path (row 0) + focused entry's name/size/date/time (row 1). |
| `DirList` | **decode** — `TDirListBox` (`tdirlist.cpp`), extending `ListBox` | The directory-tree list with faithful `└─┬`/`├─`/`└─` connectors; navigates the ancestor chain + subdirs (+ a platform root list). |
| `ChDirDialog` | **decode** — `TChDirDialog` (`tchdrdlg.cpp`), composing `Dialog` | A modal change-working-directory dialog: a path `Input` (+ `History`), a `DirList` tree, and OK/Chdir/Revert/Help buttons; commits via `valid(cmOK)`. |

---

## Functional Requirements

### Must Have

#### The `FileSystem` seam — injectable, default `node:fs` (AR-235)
- All disk access goes through an injectable **`FileSystem`** adapter interface (core's `RuntimeAdapter`
  host seam for tty, applied to fs): a small **synchronous** surface — e.g. `readDir(path) → DirEntry[]`
  (name + kind file/dir/symlink + size + mtime, from `readdirSync`+`lstatSync`), `stat(path)`/
  `lstat(path)`, `resolve(path)`/`isAbsolute`/`join`/`dirname`/`basename`/`sep` (delegating to
  `node:path`), `homedir()`, and `roots()` (the platform drive/root list). A **default `node:fs`
  implementation** is exported; every component takes the adapter (defaulting to it) so tests and the
  kitchen-sink story run **headless against an in-memory `FileSystem`** — no real disk. *(AR-235; the
  exact interface shape pinned at plan time.)*
- **Zero runtime dependencies** — the default impl uses only Node built-ins (`node:fs`, `node:path`,
  `node:os`); `check:deps` holds for the new package.

#### `FileDialog` — the open/save dialog (AR-238, decode of `TFileDialog`)
- A **modal `Dialog`** (RD-11) composing, at the **decoded geometry** (`tfildlg.cpp:58-137`, pinned at
  GATE-1): a `FileInput` filename field + a `~F~ile` `Label`, an optional `History` dropdown (Should-Have),
  a `FileList` + its `ScrollBar` + a `~F~iles` `Label`, a stacked **button strip** (Open =`bfDefault`,
  then OK/Replace/Clear/Cancel/Help per the `aOptions` flags), and a `FileInfoPane`. Faithful **49×19**
  minimum size, centered, growable.
- **Wildcard + name resolution (faithful, `tfildlg.cpp:209-351`):** a typed `*`/`?` pattern re-reads the
  listing filtered by that wildcard; a typed directory enters it; a typed filename resolves + closes. Path
  expansion uses the `FileSystem` seam (`resolve`/`dirname`/`basename`) in place of TV's `fexpand`/
  `fnsplit`.
- **`valid()` close-gate (faithful):** on OK/Open, an **invalid file name** or **unreadable/nonexistent
  directory** raises a **TV-style message box** ("Invalid file name" / "Invalid drive or directory") and
  keeps the dialog open (AR-241); a valid file resolves the dialog to that path (the RD-11 `Dialog`
  `valid()` mechanism). Cancel bypasses the gate.
- **Result:** the dialog resolves (via `execView`/`endModal`) to the **chosen absolute path** (or a
  cancel sentinel), reactive so app code can bind the outcome.

#### `FileList` — the file listing (AR-238, decode of `TFileList`)
- Extends the RD-11 **`ListView`** as a **2-column** virtual-scroll list of the current directory. Each
  row is a `DirEntry`; a **directory renders with a trailing path separator** (`NAME/` on POSIX, `NAME\`
  on Windows — the faithful `strcat(dest,"\\")` decode, platform-corrected), **not** `[NAME]` brackets.
- **Sort order (faithful, `tfilecol.cpp:40-56`):** directories sort **after** files and `..` sorts
  **last** (`compare` returns `+1` for `..`), otherwise by name — i.e. files, then directories, then
  `..`. A `..` parent entry is synthesized when not at a root.
- **Directory scan (faithful + our decisions, `tfillist.cpp:159-240`):** lists **normal files + real
  subdirectories + `..`**; **hidden entries are excluded by default** — TV-faithful (`findAttr` requests
  neither hidden nor system, `:167`) **and** our AR-239 decision — with a **reveal toggle** to include
  them (dotfiles on POSIX, the hidden attribute on Windows). Names whose scan errors (permission on a
  sub-entry) are skipped, never crash.
- **Broadcasts (faithful):** focusing a row emits a focus signal and double-click/Enter emits an open
  signal, so the `FileInput` mirrors the name and the `FileInfoPane` updates (the `cmFileFocused`/
  `cmFileDoubleClicked` decode, mapped to the RD-04 command/broadcast mechanism).
- **Type-ahead** search-as-you-type (the `getKey` decode), colours via the reused list roles.

#### `FileInput` — the filename field (AR-238, decode of `TFileInputLine`)
- Extends the RD-06 **`Input`**; on a list **focus broadcast** (and while not itself selected) it mirrors
  the focused entry's name into its value, appending the platform separator + the active wildcard when the
  entry is a **directory** (the `stddlg.cpp:78-91` decode). Otherwise a plain `Input`.

#### `FileInfoPane` — the info read-out (AR-238, decode of `TFileInfoPane`)
- A passive **`View`** drawing, at the decoded layout (`stddlg.cpp:221-299`): **row 0** = the expanded
  current path; **row 1** = the focused entry's **name** + right-aligned **size · month · day · year ·
  hh:mm · a/p** (the `months[]` table, 12-hour clock). **No attributes field** (TV renders none). Remaining
  rows blank. Updates reactively on the list focus broadcast. Colour = the reused info role (see Theme
  roles).

#### `DirList` — the directory tree (AR-238, decode of `TDirListBox`)
- Extends the RD-11 **`ListBox`** (1-column) rendering the directory **path chain + current-dir subdirs**
  with the **faithful CP437 tree connectors** — `pathDir="└─┬"`, `firstDir="└┬─"`, `middleDir=" ├─"`,
  `lastDir=" └─"`, closing via `graphics="└├─"`, `indentSize=2` (`tdirlist.cpp:104-186`,
  `tvtext1.cpp:119-124`; Unicode code points pinned at GATE-1, unambiguous-narrow). Selecting a node emits
  a **change-directory** command. A **platform root list** replaces TV's non-Unix `"Drives"` root: on
  Windows the available drive letters (`roots()` via the seam), on POSIX the single `/` root (AR-237).

#### `ChDirDialog` — change working directory (AR-238, decode of `TChDirDialog`)
- A **modal `Dialog`** composing, at the decoded geometry (`tchdrdlg.cpp:42-79`): a path `Input` + a
  `~n~ame` `Label` + optional `History`, a `DirList` tree + its `ScrollBar` + a `~t~ree` `Label`, and the
  **OK / Chdir / Revert / Help** buttons (OK =`bfDefault`, 10×2, stacked every 3 rows). Faithful **48×18**
  minimum, centered, growable. **Chdir** descends the focused tree node; **Revert** restores the starting
  directory; **`valid(cmOK)`** validates the path via the seam and, on failure, raises **"Invalid
  directory"** and stays open (AR-241). Resolves to the chosen directory path.

#### Cross-platform paths (AR-237)
- All path handling is **cross-platform via `node:path`** (the seam's `join`/`dirname`/`sep`/`isAbsolute`/
  `resolve`): POSIX (`/`, single root) **and** Windows (drive letters `C:\`, UNC, `\` separator). The
  directory marker, the `DirList` root list, and the `FileInfoPane` path render use the platform's
  separator/roots. The existing **CI matrix already runs `windows-latest`**, so the Windows path is
  tested on every run.

#### Sanitize every name (AR-245)
- Every filename, directory name, and path segment drawn to the screen is written through
  `@jsvision/core`'s **`sanitize`** boundary (a filename on disk can contain C0/DEL control bytes) — a
  name with an embedded escape sequence renders as sanitize-clean cells and **cannot** reach the terminal
  as a control sequence. This is the same write-time boundary every `View.draw()` uses.

#### Kitchen-sink story + headless demo (AR-244)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`FileDialog` story** (category
  `Files`) driven against an **in-memory `FileSystem`** (a fixed fake tree, so the smoke test is headless
  and deterministic — no real disk): render the dialog, navigate the list, focus an entry (info pane
  updates), enter a subdirectory, and echo the resolved path. A `ChDirDialog` story (or a second scene)
  shows the tree. Passes the headless smoke test, plus a headless **`demo:files`** walkthrough (an ASCII
  frame per step: render → list-nav → enter a dir → type a wildcard → select a file → resolve), matching
  `demo:color`/`demo:date`.

### Should Have
- **`History` dropdown** on the `FileInput` and the `ChDirDialog` path input (compose the RD-14
  `History`, faithful to TV's `THistory` at the decoded coordinates) — a per-dialog recent-paths list.
- **`FileDialog` save-mode affordances** — the Replace/Clear buttons (present in the decode) wired for a
  save workflow (Open vs Save button-set via the `aOptions` flags).
- **Convenience openers** — `openFile({ wildcard, directory, fs })` / `changeDir({ directory, fs })`
  async helpers returning the resolved path (Promise over `execView`), so app code needn't wire the modal
  by hand.
- **A glob/filter predicate hook** — an optional caller `filter(entry) => boolean` on the list, on top of
  the faithful wildcard, for apps that want richer filtering (never replaces the TV wildcard).

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- **File *content* editing / binding** (`TFileEditor` disk I/O) — that belongs with the editor tier
  (RD-08); this package is dialogs + listing, not an editor.
- **Remote / virtual / archived filesystems** (FTP, zip-as-folder, VFS) — the seam makes them *possible*
  later, but only the local `node:fs` default ships.
- **File operations** (copy/move/delete/rename/mkdir from the dialog) — TV's dialogs don't perform them;
  out of scope.
- **Watching / live refresh** (re-reading on external directory change) — a single synchronous read per
  navigation; no `fs.watch`.
- **Advanced glob** (`**`, brace/`[a-z]` classes, extended globbing) — only the faithful `*`/`?` wildcard
  (AR-243); richer matching via the Should-Have `filter` hook, not the wildcard.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| **Async directory reads + loading state** (Promise-based `readDir`, a loading indicator while a slow/network dir resolves, race handling) | AR-236 (DEF-32) | later | v1 is synchronous + TV-faithful; async is a clean additive follow-up once a slow-fs need appears (the seam already isolates the read). |
| **Extended glob matching** (`**`/brace/char-class) as a first-class wildcard mode | AR-243 (DEF-33) | later | The faithful `*`/`?` covers TV parity; a richer glob mode (or a bundled matcher) is a separable enhancement, and the Should-Have `filter` hook covers the interim need. |

---

## Technical Requirements

### New package (AR-246)
- A **new workspace package `packages/files/`** = **`@jsvision/files`** (`private: true`, AR-242), added
  to the yarn workspaces + Turborepo pipeline (`build`/`typecheck`/`test`/`test:e2e`/`check:deps`),
  depending on `@jsvision/ui` (and transitively `@jsvision/core`). ESM-only, NodeNext (`.js` specifiers),
  `strict`. Single public entry `src/index.ts` with **explicit named re-exports**.
- **Excluded from the public lockstep-version set** until `@jsvision/ui` (its dependency) is public — the
  `sync-versions` guard treats it like `ui` (AR-242). *(Exact `sync-versions.mjs` handling — skip-list vs
  private-flag detection — pinned at plan time.)*
- **Dir-per-concern layout** (the house pattern, AR-133/…/233), per-file ≤ 500 lines: `src/fs/` (the
  `FileSystem` seam interface + the default `node:fs` impl + the pure wildcard matcher + the pure
  directory-tree/path-chain builders), `src/dialog/` (`FileDialog` + `ChDirDialog`), `src/list/`
  (`FileList` + `DirList` + `FileInfoPane`), `src/input/` (`FileInput`), one barrel `index.ts`. *(Exact
  file split confirmed at plan time.)*

### Pure, view-free cores (testable without a TTY)
- **Wildcard matcher** — a pure `wildcardMatch(pattern, name)` (faithful `?`/`*`, **case-sensitive**,
  `*.*`→`*`, `source/platform/findfrst.cpp:162-186`) + `isWild` (`strpbrk "?*"`). No fs, no view — unit-testable directly.
- **Directory-tree geometry** — pure builders for the `DirList` path-chain + connector assignment (the
  `└─┬`/`├─`/`└─` decode) and the `FileList` sort comparator (dirs after files, `..` last) — view-free,
  golden-testable against the decode.
- **Scan → model** — a pure `scanDirectory(fs, path, { wildcard, showHidden }) → DirEntry[]` over the
  **seam** (not `node:fs` directly), so the whole listing pipeline is exercised headless against an
  in-memory fs.

### Reuse (no new engine primitives; compose `@jsvision/ui`)
- **Dialogs** reuse RD-11 `Dialog` (gray frame, `valid()` close-gate, `execView` modality); **lists**
  reuse RD-11 `ListView`/`ListBox`/`ScrollBar`; **fields** reuse RD-06 `Input`/`Label`/`Button` + the
  `filter` validator; **history** reuses RD-14 `History`. **No new `@jsvision/ui` primitives** are
  required (composition only); if plan GATE-1 finds a genuinely-needed additive `ui` seam it is added
  additively to `ui` and pinned then.
- **Draw + sanitize** via the RD-03 `DrawContext` → core `ScreenBuffer` + `sanitize` boundary.
- **Reactivity** — RD-01 `Signal`/`computed` drive the current directory, the listing, the focused entry,
  and the resolved result; RD-03 `bind`/`invalidate` coalesce repaints.

### Theme roles — 0-or-1 new (AR-247)
- Neither TV dialog has its own palette — both inherit the **gray dialog** palette, and every child colour
  resolves through roles jsvision **already** ships (`cpGrayDialog` → RD-06 `dialog`/`input`/`button`/
  `staticText`/`label`; `cpListViewer` → RD-11 `list*`/`listDivider`). So RD-09 adds **0 new core theme
  roles** — **unless** the plan GATE-1 decode of the `FileInfoPane` `cpInfoPane` `0x1E` colour proves it
  is a distinct attribute not already covered, in which case **exactly one** additive `fileInfo` role is
  added (byte-pinned at GATE-1), the same "0-or-1 additive role" pattern as RD-21's `colorMarker`.
  Additive, non-breaking either way.

### Cross-package edits (additive only)
- **`@jsvision/core`:** **0-or-1** additive theme role (the `FileInfoPane` colour, only if GATE-1 needs
  it); no existing export changes.
- **`@jsvision/ui`:** no changes expected (pure composition); any needed seam is additive, pinned at
  GATE-1.
- **Monorepo:** new `packages/files/` workspace member (root `package.json` workspaces already globs
  `packages/*`); `turbo.json` inherits the pipeline; CI matrix already fans out per package;
  `sync-versions` excludes it while private.

---

## Integration Points

- **App shell (RD-05):** a `FileDialog`/`ChDirDialog` runs as a modal on the `Desktop` via `execView`/
  `endModal`, resolving to a path.
- **Containers (RD-11):** `FileList` extends `ListView`; `DirList` extends `ListBox`; both use `ScrollBar`;
  the dialogs use the `Dialog` `valid()` close-gate.
- **Controls (RD-06):** `FileInput` extends `Input`; labels/buttons reuse the controls tier; the filename
  field can carry a `filter` validator.
- **Input dropdowns (RD-14):** the `History` dropdown on the file/dir inputs (Should-Have).
- **Core (`@jsvision/core`):** all names sanitized; theme roles reuse the gray-dialog/list chain (0-or-1
  additive); layout/reflow via the standard box model.
- **Kitchen-sink (examples):** a `FileDialog` story over an **in-memory `FileSystem`** + `demo:files`;
  `@jsvision/examples` gains a `@jsvision/files` dependency.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-235** — filesystem access goes through an **injectable `FileSystem` seam** (the RD-07
  `RuntimeAdapter` pattern) with a **default `node:fs`** implementation; components default to it. Enables
  **headless** tests + the kitchen-sink smoke test against an in-memory fs; preserves zero-runtime-deps.
- **AR-236** — directory reads are **synchronous** for v1 (`readdirSync`/`lstatSync` at navigation) —
  TV-faithful, fits the tick loop, no loading state. **Async reads + loading state DEFERRED → DEF-32.**
- **AR-237** — **cross-platform paths** (POSIX + Windows via `node:path`): platform separator on the
  directory marker + info-pane path, a **platform-appropriate root list** in `DirList` (drive letters on
  Windows, `/` on POSIX), tested on the existing `windows-latest` CI leg.
- **AR-238** — **all six** components ship in v1 (`FileDialog`, `FileList`, `FileInput`, `FileInfoPane`,
  `DirList`, `ChDirDialog`) — they interlock into the complete faithful dialog family.
- **AR-239** — **hidden entries are hidden by default** with a **reveal toggle** (dotfiles on POSIX, the
  hidden attribute on Windows). **Source-faithful** — TV's scan `findAttr = FA_RDONLY|FA_ARCH` already
  excludes hidden + system (`tfillist.cpp:167`) — *and* the modern picker convention.
- **AR-240** — **symlinks are followed and lstat-tagged**: a link to a directory is enterable; the info
  pane `stat()`s the target for size/date but `lstat` detects + tags the link; a **broken link** shows
  unresolved and never crashes.
- **AR-241** — filesystem errors (EACCES/ENOENT on a directory, an invalid name/path) surface as a
  **faithful TV message box** ("Invalid file name" / "Invalid drive or directory" / "Invalid directory")
  and keep the current listing — mirrors `TFileDialog::valid`/`TChDirDialog::valid`
  (`tfildlg.cpp:341-345`, `tchdrdlg.cpp:212-216`). **Never crashes.**
- **AR-242** — `@jsvision/files` is **`private` until its first release** and **excluded from the public
  lockstep-version sync**, mirroring `@jsvision/ui` (its still-private dependency).
- **AR-243** — **TV-faithful simple wildcard** (`*`/`?` only, **case-sensitive**, `*.*`→`*`; `isWild` =
  `strpbrk "?*"`, `wildcardMatch` `source/platform/findfrst.cpp:162-186`) — **no glob runtime dependency**.
  **Case-sensitivity is retained cross-platform** as a deliberate fidelity choice — on Windows's
  case-insensitive FS `*.TXT` will not match `readme.txt`; documented so it reads as intended, not a bug.
  **Extended glob DEFERRED → DEF-33**; richer filtering via the Should-Have `filter` hook.
- **AR-244** — the demo/story is a **`FileDialog` over an in-memory `FileSystem`** (a fixed fake tree):
  kitchen-sink `Files` story + headless `demo:files`, deterministic + disk-free.
- **AR-245** — **every filename/path drawn is `sanitize`-clean** (core's write-time boundary); a name
  carrying control bytes cannot reach the terminal as an escape sequence.
- **AR-246** — a **new `packages/files/` workspace package** (`@jsvision/files`) on `@jsvision/ui`,
  dir-per-concern, explicit named re-exports; added to yarn/Turbo/CI; **no new engine primitives**
  (composition of shipped `ui` widgets).
- **AR-247** — RD-09 is **decode-first**: **every** component has a TV counterpart (`tfildlg.cpp`/
  `tfillist.cpp`/`stddlg.cpp`/`tdirlist.cpp`/`tchdrdlg.cpp`), so drawing is a **decode** (GATE-1/GATE-2
  mandatory). Two decode facts corrected against first assumptions: the directory marker is a **trailing
  separator** (not `[NAME]`), and the `FileInfoPane` renders **no attributes field**. **Theme roles reuse
  the existing gray-dialog/list chain — 0-or-1 additive `fileInfo` role**, pinned at GATE-1 (the RD-21
  pattern).

> **Traceability:** AR-235…AR-242 are **explicit user choices** (the RD-09 `make_requirements` interview,
> 2026-07-05 — two viable options each, user selected the recommended one). AR-243…AR-247 are
> **single-dominant / source-determined** decisions (the faithful wildcard, the disk-free demo, the
> mandatory sanitize boundary, the house package pattern, and the decode-first geometry) recorded for
> traceability.

---

## Security Considerations

> RD-09 introduces the **first `fs`-touching package** in the portfolio — a **local, in-process** file
> browser over the user's own filesystem (no network, no server, no remote request). The input boundaries
> are: **directory contents → screen**, **typed path/wildcard → fs read**, and **the resolved path → the
> caller**.
- **Injection / display safety** — every filename, directory name, and path segment is written through
  core's **`sanitize`** boundary before it hits a cell (a file *on disk* can be named with embedded C0/DEL
  or escape bytes). A malicious filename therefore renders as inert sanitize-clean text and **cannot**
  drive the terminal. All list/tree/info-pane/input draws use this path.
- **Path handling** — paths are resolved/normalized via the seam's `node:path` delegates (`resolve`/
  `normalize`), never by string concatenation or a shell; **no `eval`, no shell invocation** for any path
  operation. `..` navigation is a *legitimate* file-browser affordance (bounded only by the fs itself —
  this is a local tool, not a sandboxed server upload), and the resolved path handed back to the caller is
  always **absolute + normalized** so the caller can apply its own policy.
- **Graceful failure (no crash / no leak)** — every `readdirSync`/`statSync`/`lstatSync` is guarded:
  EACCES/ENOENT/ENOTDIR and per-entry stat failures are caught and surfaced as the **faithful message box**
  (AR-241) or a skipped entry — never an unhandled throw, never a partial/garbage listing. Error messages
  show the offending path, not internal stack detail.
- **Symlinks** — resolved with `lstat` first (loop/broken-link safe): a broken or cyclic link is tagged
  and shown, never followed into an infinite descent; the info pane stats the target only when it
  resolves.
- **Bounds** — all list/tree indexing, the info-pane column math (right-aligned fields relative to
  `size.x`), and the wildcard matcher are bounds-checked/clamped for any entry count (including an empty
  or unreadable directory) and any name length.
- **The `FileSystem` seam is the whole trust boundary** — because every disk touch goes through it, a
  test/embedding can inject a **read-only or in-memory** fs to fully contain what the components can reach.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode. The fidelity ACs diff against the decode
(`tfildlg.cpp`/`tfillist.cpp`/`stddlg.cpp`/`tdirlist.cpp`/`tchdrdlg.cpp`), pinned at plan GATE-1/GATE-2;
the extension ACs encode the seam / cross-platform / sanitize / reactive behaviour. All fs-touching ACs
run against an **in-memory `FileSystem`** (headless, deterministic).

- **AC-1** (FileSystem seam) — every component reads the disk **only** through the injected `FileSystem`;
  supplying an in-memory adapter drives the full listing/navigation with **no `node:fs` access**, and the
  default adapter uses only Node built-ins (`check:deps` passes). *(AR-235)*
- **AC-2** (wildcard matcher, faithful) — `wildcardMatch` matches `?`=one char, `*`=greedy zero-or-more,
  else exact **case-sensitive** byte compare; `"*.*"` matches extensionless names; `isWild` is true iff
  the pattern contains `*` or `?` — diffed against `source/platform/findfrst.cpp:162-186`. *(AR-243)*
- **AC-3** (FileList rows + sort, faithful) — the list shows files + directories (**directory ⇒ trailing
  platform separator**, not `[NAME]`) + a synthesized `..`; sort order is files, then directories, then
  `..` **last**, else by name; matched to `tfillist.cpp:113-121` + `tfilecol.cpp:40-56`. *(AR-238; AR-247)*
- **AC-4** (hidden default + toggle) — by default the scan **excludes** hidden entries (dotfiles/hidden
  attribute) — faithful to `findAttr` (`tfillist.cpp:167`); the reveal toggle includes them. *(AR-239)*
- **AC-5** (FileInput mirroring, faithful) — focusing a list entry mirrors its name into the `FileInput`;
  for a **directory** the value becomes `name` + separator + the active wildcard (the `stddlg.cpp:78-91`
  decode); a plain file mirrors the bare name. *(AR-238)*
- **AC-6** (FileInfoPane layout, faithful) — the pane draws the expanded path (row 0) and the focused
  entry's **name + size + month + day + year + hh:mm + a/p** (row 1, `months[]`, 12-hour), **no attributes
  field**, remaining rows blank; updates on the focus broadcast — matched to `stddlg.cpp:221-299`.
  *(AR-238; AR-247)*
- **AC-7** (DirList tree, faithful) — the directory tree renders the ancestor path-chain + current-dir
  subdirs with the connectors `└─┬`/`└┬─`/` ├─`/` └─` and `indentSize=2`, closing the last branch via the
  `graphics` patch; selecting a node emits a change-directory command — matched to
  `tdirlist.cpp:104-186` + `tvtext1.cpp:119-124`. *(AR-238; AR-247)*
- **AC-8** (FileDialog geometry + composition, faithful) — a `FileDialog` is a **49×19**-minimum centered
  growable gray `Dialog` composing the `FileInput`+label, `FileList`+scrollbar+label, the **open-mode**
  button strip (Open =`bfDefault`, Cancel, Help — the `aOptions` default; save-mode adds OK/Replace/Clear
  per the Should-Have), and the `FileInfoPane`, at the decoded coordinates — matched to
  `tfildlg.cpp:58-137`. *(AR-238; AR-247)*
- **AC-9** (FileDialog valid + resolve, faithful) — OK/Open on a **valid file** resolves the dialog to its
  **absolute normalized path**; a **wildcard** re-reads the listing; a **directory** enters it; an
  **invalid name / unreadable directory** raises the faithful message box and keeps the dialog open;
  Cancel resolves to a cancel sentinel — matched to `tfildlg.cpp:293-351`. *(AR-241; AR-238)*
- **AC-10** (ChDirDialog geometry + commit, faithful) — a `ChDirDialog` is a **48×18**-minimum centered
  growable gray `Dialog` composing the path `Input`+label, the `DirList` tree+scrollbar+label, and OK/
  Chdir/Revert/Help (OK =`bfDefault`, 10×2, every 3 rows); **Chdir** descends the focused node, **Revert**
  restores the start dir, **`valid(cmOK)`** resolves the chosen directory or raises "Invalid directory"
  and stays open — matched to `tchdrdlg.cpp:42-218`. *(AR-238; AR-241)*
- **AC-11** (cross-platform) — path handling, the directory marker, the info-pane path, and the `DirList`
  root list are correct on both POSIX (`/`, single root) and Windows (drive letters, `\`) via the seam's
  `node:path` delegates; the suite passes on the `windows-latest` CI leg. *(AR-237)*
- **AC-12** (graceful errors, no crash) — an EACCES/ENOENT/ENOTDIR directory, a per-entry stat failure, an
  empty directory, and a broken symlink each produce a defined result (message box / skipped entry / empty
  listing / tagged link) with **no unhandled throw** and no garbage listing. *(AR-241; AR-240; security)*
- **AC-13** (symlinks) — a symlink to a directory is enterable and tagged; the info pane stats the target
  when it resolves; a broken/cyclic link is shown unresolved and is never followed into an infinite
  descent. *(AR-240)*
- **AC-14** (sanitize) — a filename/directory containing control bytes (e.g. `"\x1b[2Jevil"`) renders as
  **sanitize-clean** cells in the list/tree/info-pane/input and **no** raw escape sequence reaches the
  terminal. *(AR-245; security)*
- **AC-15** (theme roles) — the dialogs/lists/inputs render in the reused gray-dialog/list/input/button/
  staticText roles; **0 new core roles** exist unless GATE-1 pins the single additive `fileInfo` role
  (byte-frozen); no existing role changes; `encode()` of every used role does not throw. *(AR-247)*
- **AC-16** (packaging) — `@jsvision/files` lives in `packages/files/` (`private: true`), builds/typechecks
  via Turbo, depends on `@jsvision/ui`, re-exports the six components + the `FileSystem` seam explicitly
  from `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines; `sync-versions`
  excludes it while private. *(AR-246; AR-242)*
- **AC-17** (story + demo) — a `FileDialog` kitchen-sink story (category **`Files`**) over an in-memory
  `FileSystem` passes the headless smoke test; **`demo:files`** runs headless with an ASCII frame per step
  (render → list-nav → focus (info pane updates) → enter a dir → type a wildcard → select a file →
  resolve). *(AR-244)*

---

> **Next step:** run the make_plan skill on RD-09 (spec-first: spec oracles RED → implement → GREEN → impl
> tests). Because **all six** components have a TV counterpart (GATE-1), the plan's GATE-1/GATE-2 work is
> mandatory: **decode each class cell-by-cell** (the dialog geometry in `tfildlg.cpp`/`tchdrdlg.cpp`, the
> list rows + sort in `tfillist.cpp`/`tfilecol.cpp`, the info-pane fields in `stddlg.cpp:221-299`, the tree
> connectors in `tdirlist.cpp` + `tvtext1.cpp:119-124`, and every `getColor(N)` through the gray-dialog →
> `cpAppColor` chain), **pin the reused theme roles (0-or-1 additive `fileInfo`)**, and record the decode +
> the two BEFORE/AFTER gate tasks in `99-execution-plan.md`. The `FileSystem` seam / cross-platform /
> sanitize / async-deferred / reactive extensions get spec oracles but no diff. RD-09 stands up the
> **second published-shape package** (`@jsvision/files` on `@jsvision/ui`) and is the **Phase R** closer.
