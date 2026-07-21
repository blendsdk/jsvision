# 03-04: `DirList` + `ChDirDialog`

> **Parent**: [Index](00-index.md) · **Covers**: AC-7/AC-10 · **AR**: PA-1/PA-3/PA-9
> **TV-derived** ⇒ GATE-1 BEFORE-decode (here) + GATE-2 AFTER-diff (Phase 7) mandatory.

---

## `DirList` — `src/list/dir-list.ts` (decode of `TDirListBox`, extends `ListBox`)

### TV decode (GATE-1) — `tdirlist.cpp:104-202`, glyphs `tvtext1.cpp:119-124`
- **Class** — `TDirListBox : TListBox` — **1 column**. Rect `(3,6,32,16)` in the ChDirDialog = 29×10.
- **Rows** = the **ancestor path chain** (root → … → current) + the **current directory's subdirs**,
  indented `indentSize=2`, with the CP437 tree connectors (→ unambiguous-narrow Unicode, pinned at
  GATE-1): `pathDir="└─┬"`, `firstDir="└┬─"`, `middleDir=" ├─"`, `lastDir=" └─"`, closing
  `graphics="└├─"`. The pure geometry is `buildDirTree` in [03-01](03-01-fs-seam-and-cores.md).
- **Root** — TV's non-Unix `"Drives"` node → the **platform root list** (`roots()`: drive letters on
  Windows, `/` on POSIX) — AR-237.
- **Select** — `selectItem` (Enter/double-click) emits `cmChangeDir` with the node's path
  (`tdirlist.cpp` `selectItem`).
- **Colours** — reused `list*` roles; connectors sanitized like any glyph.

### jsvision realization
- `extends ListBox` with items = a `computed` of `buildDirTree(fs, directory())` → `DirNode[]`;
  `getText(node) = node.connectorPrefix + node.label`. `onSelect(node)` → emit a change-dir command /
  invoke `onChangeDir(node.path)`. Type-ahead reused. All glyphs `sanitize`-clean (AC-14). Bounds:
  a root with no subdirs, a deep chain wider than the box (clipped) handled.

---

## `ChDirDialog` — `src/dialog/chdir-dialog.ts` (decode of `TChDirDialog`, composes `Dialog`)

### TV decode (GATE-1) — `tchdrdlg.cpp:42-218`
- **Class** — `TChDirDialog : TDialog`; `getRect TRect(16,2,64,20)` = **48×18**, `ofCentered | wfGrow`,
  min **48×18**. Gray dialog palette (no `cpChDirDialog`).
- **Composition (decoded coordinates):**

  | Child | Rect | Notes |
  |-------|------|-------|
  | path `Input` (`dirInput`) | `(3,3,42,4)` | the directory-path edit |
  | `~n~ame` label | `(2,2,…)` | hardcoded |
  | `History` | `(42,3,45,4)` | `new History({ link, historyId })` at this rect via absolute layout (PA-9) |
  | `DirListBox` | `(3,6,33,16)` | the tree; **`extends ListBox` ⇒ owns its vertical bar** (`[rows fr\|bar 1]`), so it spans through col 33 |
  | tree `ScrollBar` | `(32,6,33,16)` | DirList's **owned** vertical bar (ListBox provides it) — not separately composed (orientation already matches TV, unlike FileList) |
  | `~t~ree` label | `(2,5,…)` | hardcoded |
  | **OK** (`bfDefault`) | `(35,6,45,8)` | 10×2 |
  | **Chdir** | `(35,9,45,11)` | +3 rows |
  | **Revert** | `(35,12,45,14)` | +3 rows |
  | **Help** | `(35,15,45,17)` | +3 rows |

- **Behaviour** (`:120-218`): **Chdir** descends the focused tree node (re-roots the tree there);
  **Revert** restores the **starting** directory; **`valid(cmOK)`** validates the typed/selected path
  via `changeDir` and, on failure, raises **`"Invalid directory"`** (`:212-216`) and stays open.
  Resolves to the chosen directory path.

### jsvision realization
- `class ChDirDialog extends Dialog` (48×18 min, centered, growable). Composes the path `Input` +
  `History` + `DirList` (bound to a `directory` signal; `extends ListBox` ⇒ **owns its vertical bar**,
  so no separately-composed `ScrollBar` — orientation already matches TV, unlike FileList) + labels +
  the four buttons at the
  decoded rects. **Chdir** sets `directory` to the focused node's path (re-scans the tree); **Revert**
  restores the captured start dir; typing a path + OK / selecting a node commits.
- **`valid(cmOK)`** — validate via the seam (`stat` is-dir + readable); on failure open the **local
  error dialog** (`"Invalid directory"`, PA-3) and stay open (AC-10). Resolves (via `execView`) to the
  chosen absolute directory, or `null` on Cancel/Esc. Every fs call guarded (AC-12); all glyphs/paths
  sanitized (AC-14).

## Line budget
`dir-list.ts`, `chdir-dialog.ts` each ≤ 500 lines.
