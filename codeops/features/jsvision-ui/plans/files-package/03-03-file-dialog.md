# 03-03: `FileDialog` + the local error dialog

> **Parent**: [Index](00-index.md) · **Covers**: AC-8/AC-9 + save-mode Should-Have · **AR**: PA-1/PA-3
> **TV-derived** ⇒ GATE-1 BEFORE-decode (here) + GATE-2 AFTER-diff (Phase 7) mandatory.

---

## `FileDialog` — `src/dialog/file-dialog.ts` (decode of `TFileDialog`, composes `Dialog`)

### TV decode (GATE-1) — `tfildlg.cpp:58-190` (geometry), `:209-351` (wildcard/valid)
- **Class** — `TFileDialog : TDialog`; `getRect TRect(15,1,64,20)` = **49×19**, `ofCentered | wfGrow`,
  `sizeLimits` min **49×19** (`:135`). Inherits the **gray dialog** palette (no `cpFileDialog`;
  `dialogs.h:80-92`).
- **Composition (decoded coordinates, dialog-local):**

  | Child | Rect | Notes |
  |-------|------|-------|
  | `FileInputLine` | `(3,3,31,4)` | the filename edit (`FileInput`) |
  | input label | `(2,2,…)` | **caller-supplied `inputName`** (default per opener), **not** hardcoded `~F~ile` (preflight PF-004) |
  | `History` | `(31,3,34,4)` | `new History({ link, historyId })` at this rect via absolute layout (PA-9) |
  | `FileList` | `(3,6,34,14)` | 2-column list (PA-14 `numCols:2`); **takes the bar below as its injected vScrollBar** |
  | list `ScrollBar` | `(3,14,34,15)` | the list's bar — **horizontal-rendered, bottom** (TV hands `sb` to `TFileList`); wired to `FileList` via the PA-14 bar seam, **not** a second standalone bar |
  | `~F~iles` label | `(2,5,…)` | hardcoded `filesText` (`:81`) |
  | **button strip** | first at `r=TRect(35,3,46,5)`, each **+3 rows** | Open(`bfDefault`)/OK/Replace/Clear/Cancel/Help per `aOptions` |
  | `FileInfoPane` | `(1,16,48,18)` | the read-out pane |

- **Button set gating** (`aOptions`, PF-002 correction): the **open-mode default** = **Open(`bfDefault`)
  · Cancel · Help** (Must-Have). **Save mode** (Should-Have, PA-1 IN) adds **OK · Replace · Clear**
  via the `aOptions` flags. Each button is 11×2 (`35..46`), stacked every 3 rows in strip order.
- **Wildcard + name resolution** (`:209-351`): `getFileName` = `fexpand` + `fnsplit` → our seam's
  `resolve`/`dirname`/`basename`. An **empty name+ext** re-merges the `wildCard`. `valid()`:
  - `isWild(name)` ⇒ re-read the listing filtered by that wildcard (no close);
  - `isDir(name)` ⇒ enter it (re-scan; no close);
  - `validFileName` ⇒ resolve + close to the absolute path;
  - else ⇒ **error box** `"Invalid file name: '%s'"` (`:341`), stay open;
  - `checkDirectory` fail ⇒ **error box** `"Invalid drive or directory"` (`:345`), stay open.
  - **Cancel** bypasses the gate (`Dialog.valid(cmCancel)===true`).

### jsvision realization
- `class FileDialog extends Dialog` (49×19 min, centered, growable). Children added at the decoded
  rects (absolute placement within the dialog). Composes `FileInput` + `History` + `FileList` (handed
  its **injected horizontal-bottom `ScrollBar`** at `(3,14,34,15)` via the PA-14 bar seam) + labels +
  the button strip + `FileInfoPane`, wired by shared signals:
  `directory` (current path), `wildcard`, `items` (scan `computed`), `focusedEntry`, and the resolved
  `result`.
- **Modes** — an `options` flag chooses the open-mode (`[Open, Cancel, Help]`) or save-mode
  (`[OK, Replace, Clear, Cancel, Help]`) button set (PA-1). Replace/Clear act on the filename field
  (Clear empties it; Replace loads the focused entry) — the faithful save affordances.
- **`valid()` override** — implements the `TFileDialog::valid` state machine above using the seam +
  `isWild`/`wildcardMatch`. Wildcard/dir stay open (re-scan); a valid file resolves via the RD-11
  `Dialog` close-gate (`endModal` → the resolved absolute path); an invalid name/dir opens the **local
  error dialog** (below) and keeps the dialog open (AC-9). Every fs call guarded (AC-12).
- **Result** — resolves (via `execView`/`endModal`) to the **absolute, normalized** chosen path, or a
  **cancel sentinel** (`null`) on Cancel/Esc/`[×]`. Reactive `onResolve` for binding.

---

## Local error dialog — `src/dialog/error-dialog.ts` (PA-3)

**Not** a `TMsgBox` decode (a faithful shared `messageBox` is a separate future RD). A minimal,
contained error box used by `FileDialog`/`ChDirDialog` on a failed `valid()`.

- `errorBox(host, message) → Promise<void>` — builds a small modal gray `Dialog` (`Dialog` reused) with
  a centered `Label` (the sanitized message, e.g. `Invalid file name: 'x'`) + a single default
  `okButton()`; shown via `execView`; resolves when OK/Esc closes it. The parent dialog stays open
  underneath (nested LIFO modality, already supported by RD-04 `execView`).
- Messages are the faithful TV strings (`"Invalid file name: '%s'"`, `"Invalid drive or directory"`,
  `"Invalid directory"`), sanitized before display (the offending path shown, no stack detail — AC-9/
  security).
- Geometry is a plain small gray `Dialog` (centered, sized to the message + button) — **not** claimed as
  a `TMsgBox` cell-by-cell decode (PA-3); no GATE diff (it is an extension, not a TV component reproduction).

## Line budget
`file-dialog.ts` ≤ 500 lines; if the geometry + valid state machine + save affordances exceed it, split a
`file-dialog-geometry.ts` (pure child-rect table) out. `error-dialog.ts` is small.
