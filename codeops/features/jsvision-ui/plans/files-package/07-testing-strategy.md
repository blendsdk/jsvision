# Testing Strategy: Files package

> **Document**: 07-testing-strategy.md · **Parent**: [Index](00-index.md)

## Overview

- **Spec-first (NON-NEGOTIABLE):** `*.spec.test.ts` oracles derive from `01-requirements.md`, the
  `03-*` decodes, the RD ACs, and the `.cpp` — written + RED before implementation, GREEN after. For a
  **TV-derived** draw, a spec oracle disagreeing with a faithful decode is the defect → fix the code
  (or the mis-decoded oracle, citing the `.cpp`, per the CLAUDE.md fidelity exception).
- **All fs-touching tests run headless against an in-memory `FileSystem`** (PA-11) — deterministic, no
  real disk, no `node:fs`. AC-1 is proven by the injection itself.
- **Render-through-loop idiom** (the `calendar.spec`/`color-swatch.spec` pattern): mount via
  `createEventLoop` + `mount`, dispatch synthetic key/mouse events, assert the **pre-`serialize`
  buffer cell-by-cell** for the fidelity oracles.
- **Fidelity oracles** (ST-3/6/7/8/10 + FileList rows) diff against the decode pinned in the `03-*` docs;
  the seam/wildcard/cross-platform/sanitize/error/symlink/opener oracles encode extension behaviour.

## 🚨 Specification Test Cases (ST-n ↔ AC-n)

| # | Input / Scenario | Expected (oracle) | Source |
|---|------------------|-------------------|--------|
| ST-1 | Every component driven by an injected in-memory `FileSystem`; the default `nodeFileSystem` | No `node:fs` access when injected; full listing/nav works; default uses only Node built-ins (`check:deps` passes) | AC-1 / PA-2 |
| ST-2 | `isWild` / `wildcardMatch` over `?`/`*`/exact/`*.*`/case | `?`=one char, `*`=greedy, else exact **case-sensitive** byte compare; `"*.*"` matches extensionless; `isWild` true iff `*`/`?` present — vs `findfrst.cpp:162-186` | AC-2 |
| ST-3 | `FileList` over a fake dir (files + subdirs + `..`), `numCols:2` | Rows: files, then dirs (**trailing `fs.sep`**, not `[NAME]`), then `..` **last**; 2 columns with a `│` divider — cell-by-cell vs `tfillist.cpp:113-121`+`tfilecol.cpp:40-56` | AC-3 / PA-14 |
| ST-4 | Scan with hidden entries, `showHidden` off then on; a caller `filter` | Off ⇒ dotfiles/hidden excluded (`findAttr`, `tfillist.cpp:167`); on ⇒ included; `filter` AND-ed with the wildcard | AC-4 / PA-10 |
| ST-5 | Focus a file row; focus a directory row | `FileInput` mirrors the file's bare name; for a dir → `name + fs.sep + wildcard`; no mirror while the input is itself focused — vs `stddlg.cpp:78-91` | AC-5 |
| ST-6 | `FileInfoPane` on a focused entry | Row 0 = expanded path; row 1 = name + right-aligned `size month day year hh:mm a/p` (12-hour, `months[]`); **no attributes field**; rows 2.. blank — vs `stddlg.cpp:221-299` | AC-6 |
| ST-7 | `DirList` over a nested path | Ancestor chain + current subdirs with `└─┬`/`└┬─`/` ├─`/` └─`, `indentSize=2`, platform root; select → `cmChangeDir(path)` — vs `tdirlist.cpp:104-186`+`tvtext1.cpp:119-124` | AC-7 |
| ST-8 | Build a `FileDialog`; measure geometry + child rects + button strip | 49×19-min centered growable gray `Dialog`; `FileInput`+label, `FileList`+scrollbar+`~F~iles`, the **open-mode** strip (Open`bfDefault`/Cancel/Help), `FileInfoPane` at the decoded rects — vs `tfildlg.cpp:58-137` | AC-8 |
| ST-9 | OK/Open on: a valid file; a `*` wildcard; a directory name; an invalid name; an unreadable dir; Cancel | Valid file ⇒ resolve to abs normalized path; wildcard ⇒ re-scan; dir ⇒ enter; invalid/unreadable ⇒ **local error box**, stays open; Cancel ⇒ `null` — vs `tfildlg.cpp:293-351` | AC-9 |
| ST-10 | Build a `ChDirDialog`; Chdir; Revert; OK on valid/invalid | 48×18-min centered growable; path input+label, `DirList`+scrollbar+`~t~ree`, OK`bfDefault`/Chdir/Revert/Help (10×2, every 3 rows); Chdir descends, Revert restores start, `valid(cmOK)` resolves or errors — vs `tchdrdlg.cpp:42-218` | AC-10 |
| ST-11 | Same components under a Windows-style seam (`\`, drive roots) vs POSIX | Directory marker, info-pane path, and `DirList` roots correct on both; via the seam's `node:path` delegates (runs on the `windows-latest` CI leg) | AC-11 |
| ST-12 | An EACCES/ENOENT/ENOTDIR dir; a per-entry stat failure; an empty dir; a broken symlink | Each ⇒ a defined result (error box / skipped entry / empty listing / tagged link); **no unhandled throw**, no garbage listing | AC-12 |
| ST-13 | A symlink→dir; a symlink→file; a broken/cyclic symlink | Link→dir enterable + tagged; info pane stats the resolved target; broken/cyclic shown unresolved, never followed into infinite descent | AC-13 |
| ST-14 | A filename/dir named `"\x1b[2Jevil"` in the list/tree/info-pane/input | Renders sanitize-clean cells; **no** raw escape reaches the terminal | AC-14 / security |
| ST-15 | `defaultTheme` + `encode()` after the GATE-1 role branch | Dialogs/lists render in the reused gray-dialog/list/input/button/staticText roles; **0 new roles** unless GATE-1 pins the single `fileInfo` (byte-frozen); no existing role changed; `encode()` non-throw | AC-15 / PA-6 |
| ST-16 | Package layout | `packages/files/` (`private:true`) builds/typechecks via Turbo, depends on `@jsvision/ui`, re-exports the six components + seam + openers explicitly from `src/index.ts`; `check:deps` passes; files ≤ 500; `sync-versions` excludes it | AC-16 / PA-5 |
| ST-17 | Kitchen-sink `files/file-dialog` + `files/chdir-dialog` stories over in-memory fs; `demo:files` | Both stories pass smoke (mount + paint + unique id + metadata); `demo:files` runs headless, ASCII frame per step | AC-17 / PA-12 |

### Should-Have oracles

| # | Input / Scenario | Expected (oracle) | Source |
|---|------------------|-------------------|--------|
| ST-18 | A `History` on the `FileInput` + ChDir path input; the RD-14 `history.*`/`combo-box.*` suites | The dropdown opens recent paths at the decoded coords; **existing RD-14 suites stay green**; no `dropdown/` export change | PA-9 |
| ST-19 | A save-mode `FileDialog` (`save:true`) | Button set = OK/Replace/Clear/Cancel/Help; Clear empties the field, Replace loads the focused entry; Open-mode set = Open/Cancel/Help | PA-1 (save-mode) |
| ST-20 | `await openFile({host, wildcard})` resolve + cancel; `await changeDir({host})` | Resolves to the chosen abs path / dir; `null` on cancel; `fs` defaults to `nodeFileSystem`; `save` picks the button set; **`host` is `execView`-capable (not `ModalHost`)** and the opener **adds the dialog to the desktop → `execView` → removes it in `finally`** (PF-002) | PA-8 |
| ST-21 | `numCols:1` (existing) vs `numCols:2` on `ListRows`; an **injected/oriented bar** vs the default owned bar; the RD-11 list suites | 1-col + default-bar unchanged (RD-11 `listview`/`listbox`/`scroller`/`fidelity` green); 2-col flows column-major with a `│` divider (`getColor(5)`); an injected **horizontal-bottom** bar is accepted + acts as the vScrollBar (step `size.y*numCols`/`size.y`), scroll stays vertical — vs `tlstview.cpp`/`tlistbox.cpp` | PA-14 |

> **Authoring rule:** expectations come from the specs + the `.cpp` decode — never from imagined output.
> If an expectation can't be determined from the spec, it's an ambiguity → register + resolve first.

## Test file map

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `fs-seam.spec.test.ts` | ST-1 | `FileSystem` seam + in-memory adapter |
| `wildcard.spec.test.ts` | ST-2 | pure matcher |
| `scan.spec.test.ts` | ST-3(sort)/ST-4/ST-12(scan errors)/ST-13 | `scanDirectory` + `compareEntries` |
| `tree.spec.test.ts` | ST-7(geometry) | `buildDirTree` connectors |
| `file-list.spec.test.ts` | ST-3/ST-4/ST-14/ST-21(2-col via FileList) | `FileList` |
| `file-input.spec.test.ts` | ST-5/ST-14 | `FileInput` |
| `file-info-pane.spec.test.ts` | ST-6/ST-13/ST-14 | `FileInfoPane` |
| `dir-list.spec.test.ts` | ST-7/ST-14 | `DirList` |
| `file-dialog.spec.test.ts` | ST-8/ST-9/ST-11/ST-12/ST-19 | `FileDialog` + error dialog |
| `chdir-dialog.spec.test.ts` | ST-10/ST-11/ST-12 | `ChDirDialog` |
| `openers.spec.test.ts` | ST-20 | `openFile`/`changeDir` |
| `files-theme.spec.test.ts` | ST-15 | `fileInfo` role branch (or no-op) |
| `files.packaging.spec.test.ts` | ST-16 | re-exports / deps / line budget |
| `list-numcols.spec.test.ts` (in `packages/ui/test/`) | ST-21 | ui `numCols` additive + RD-11 green |
| `history-files.spec.test.ts` | ST-18 | History wiring + RD-14 green |
| `kitchen-sink.smoke.spec.test.ts` (extend) | ST-17 | stories |

## Implementation tests (AFTER, edges/internals)

`wildcard.impl` (empty/all-`*`/trailing), `scan.impl` (mixed hidden/symlink/error entries, sort ties),
`tree.impl` (root with no subdirs, deep chain), `file-list.impl` (long-name clip, empty listing, column
wrap edges), `file-dialog.impl` (each `valid()` branch, save-mode Replace/Clear), `chdir-dialog.impl`
(Chdir/Revert), `file-info-pane.impl` (right-align clamp, broken link), `openers.impl` (default fs).

## E2E

| Scenario | Steps | Expected |
|----------|-------|----------|
| `demo:files` | render → list-nav → focus → enter a dir → type a wildcard → select a file → resolve | ASCII frame per step; `files-demo.e2e.test.ts` green |
| RD-11 regression | run `listview`/`listbox`/`scroller`/`fidelity`/`containers.packaging` after `numCols` | all green, unchanged (PA-14) |
| RD-14 regression | run `history.*`/`combo-box.*` after History wiring | all green, unchanged (PA-9) |

## Verification checklist
- [ ] ST-1…ST-21 defined with concrete input/output; each traces to an AC / `.cpp` / PA
- [ ] Spec tests RED before impl, GREEN after (code fixed on failure, never the oracle)
- [ ] GATE-2 AFTER-diff of all six TV-derived draws vs the `.cpp` recorded (PA-13)
- [ ] RD-11 + RD-14 suites still green; `yarn verify` + `yarn check:deps` + `yarn test:e2e` clean
- [ ] Every file ≤ 500 lines; 0-or-1 additive `fileInfo` role; no existing role/export change
