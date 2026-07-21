# Execution Plan: Files package (`@jsvision/files`)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-06
> **Progress**: 43/43 tasks (100%) — ✅ COMPLETE
> **CodeOps Skills Version**: 3.3.0

## Overview

Stand up **`@jsvision/files`** — the six TV file-system components + the `FileSystem` seam + all four
Should-Haves — on shipped `@jsvision/ui`/`@jsvision/core`, spec-first per phase (Spec → RED → implement →
GREEN → impl tests → verify). Because **every** component is a TV decode, **GATE-1 BEFORE-decode +
GATE-2 AFTER-diff are mandatory** (`codeops/tv-fidelity-gate.md`). Cross-package edits are **additive
only**: an additive `numCols` on ui `ListRows`/`ListView` (PA-14) and a **0-or-1** core `fileInfo` role
(PA-6). The `valid()` error box is a **local** dialog (PA-3), not a new ui primitive.

**🚨 Update this document (mark `[x]` + timestamp, bump the Progress header) after EACH completed task.**

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 1 | Scaffold + GATE-1 decode + `numCols`/bar ui seams + `fileInfo` role branch (spec-first) | 9 |
| 2 | `FileSystem` seam + pure cores (wildcard/scan+sort/tree) (spec-first) | 7 |
| 3 | Listing trio — `FileList` + `FileInput` + `FileInfoPane` (spec-first) | 5 |
| 4 | `FileDialog` + local error dialog (spec-first) | 4 |
| 5 | `DirList` + `ChDirDialog` (spec-first) | 4 |
| 6 | History dropdown + convenience openers (spec-first) | 4 |
| 7 | GATE-2 AFTER-diff + impl tests & hardening | 5 |
| 8 | Packaging, kitchen-sink stories, `demo:files` | 5 |

**Total: 43 tasks across 8 phases.**

---

## Phase 1: Scaffold + GATE-1 decode + `numCols`/bar ui seams + `fileInfo` role branch (spec-first)

**Reference**: [02](02-current-state.md) · [03-01…03-05] · **Objective**: stand up the package, record the
full decode, land the two additive cross-package seams spec-first.

| # | Task | File |
|---|------|------|
| 1.1 | **[GATE-1 BEFORE-decode]** Re-verify cell-by-cell vs the `.cpp` and finalize the decode in `03-02`…`03-04` + a decode note for the code JSDoc: FileDialog/ChDirDialog geometry (`tfildlg.cpp:58-137`/`tchdrdlg.cpp:42-76`), FileList rows+sort+2-col (`tfillist.cpp:64/113-121`,`tfilecol.cpp:40-56`,`tlstview.cpp:150`), FileInfoPane fields (`stddlg.cpp:221-299`), DirList connectors (`tdirlist.cpp:104-186`,`tvtext1.cpp:119-124`), and every `getColor(N)` through the gray-dialog→`cpAppColor` chain incl. `cpInfoPane 0x1E` (`stddlg.cpp:67`). | `03-*` docs |
| 1.2 | Scaffold `packages/files/`: `package.json` (`private:true`, deps `@jsvision/ui`/`@jsvision/core`), `tsconfig.json`, `vitest.config.ts` — mirror `packages/ui/`. Empty `src/index.ts`. Confirm Turbo picks it up (`yarn build` no-op green). | `packages/files/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}` |
| 1.3 | Write `packages/ui/test/list-numcols.spec.test.ts` (ST-21): `numCols:2` flows column-major + `│` divider (cell-by-cell vs `tlstview.cpp`); an **injected/oriented bar** is accepted + acts as the vScrollBar (step `size.y*numCols`/`size.y`); `numCols:1`/default-bar unchanged. Run — **RED**. | `packages/ui/test/list-numcols.spec.test.ts` |
| 1.4 | Implement the additive `TListViewer` seams on `ListRows`/`ListView`: **`numCols`** (default 1) — column-major flow + interior `│` dividers (`getColor(5)`) + cross-column hit-test — **and an injectable/orientable `ScrollBar`** (default = the owned vertical bar; override supplies/positions the bar, e.g. FileList's horizontal-bottom bar), decoded from `tlstview.cpp`/`tlistbox.cpp` (JSDoc). Scroll model stays vertical. | `packages/ui/src/list/list-rows.ts`, `list-view.ts` |
| 1.5 | Run `list-numcols.spec` **GREEN** + the RD-11 `listview`/`listbox`/`scroller`/`fidelity`/`containers.packaging` suites **green, unchanged** (PA-14 regression guard). | — |
| 1.6 | Write `packages/files/test/files-theme.spec.test.ts` (ST-15): resolve `cpInfoPane 0x1E` decode; assert the reused roles render; **if** distinct, `fileInfo` role exists (byte-frozen) + `encode()` non-throw + no existing role changed. Run — **RED** (or trivially green if no role needed). | `packages/files/test/files-theme.spec.test.ts` |
| 1.7 | **[PA-6 branch]** Resolve `0x1E` through the palette chain. **If distinct:** add the additive `fileInfo` role to `theme.ts` + re-export path + append it to the closed-set theme-guard allowlists (RD-21 pattern; keep every byte assertion). **If covered:** record "0 new roles" in the decode note, no core edit. | `packages/core/src/engine/color/theme.ts` (+ re-exports + `packages/ui/test/*theme*`) *(conditional)* |
| 1.8 | Run `files-theme.spec` **GREEN**; `yarn verify`. | — |
| 1.9 | Update the **"single column only"** JSDoc in `list-view.ts` + `list-rows.ts` to reflect the `numCols`/injectable-bar seams (no longer single-column-only; the `numCols` work RD-11 reserved for RD-07/AR-104 now lands here). | `packages/ui/src/list/{list-view,list-rows}.ts` |

**Deliverables**: package scaffolds + builds; GATE-1 decode recorded; `numCols` lands additively (RD-11
green); the `fileInfo` role branch resolved (0-or-1 role, guards extended if added); `yarn verify` green.
**Verify**: `yarn verify`

---

## Phase 2: `FileSystem` seam + pure cores (spec-first)

**Reference**: [03-01](03-01-fs-seam-and-cores.md) · [07](07-testing-strategy.md)

| # | Task | File |
|---|------|------|
| 2.1 | Write `test/helpers/memory-fs.ts` (the in-memory `FileSystem`, PA-11) + `fs-seam.spec.test.ts` (ST-1) + `wildcard.spec.test.ts` (ST-2) + `scan.spec.test.ts` (ST-3 sort/ST-4 hidden/ST-12 scan errors/ST-13 symlink) + `tree.spec.test.ts` (ST-7 geometry). Run — **RED**. | `packages/files/test/{helpers/memory-fs.ts,fs-seam.spec,wildcard.spec,scan.spec,tree.spec}.test.ts` |
| 2.2 | Implement `src/fs/types.ts` (`FileSystem`/`DirEntry`/`FileStat`) + `src/fs/node-fs.ts` (`nodeFileSystem`, `node:fs`/`node:path`/`node:os` only). | `packages/files/src/fs/{types.ts,node-fs.ts}` |
| 2.3 | Run `fs-seam.spec` **GREEN**. | — |
| 2.4 | Implement `src/fs/wildcard.ts` (`isWild`/`wildcardMatch`, case-sensitive, `*.*`→`*`; decode JSDoc `findfrst.cpp:162-186`). Run `wildcard.spec` **GREEN** (fix code, never the oracle). | `packages/files/src/fs/wildcard.ts` |
| 2.5 | Implement `src/fs/scan.ts` (`scanDirectory` over the seam + `compareEntries`; hidden default, wildcard + `filter` AND, guarded reads; decode JSDoc `tfillist.cpp:159-240`,`tfilecol.cpp:40-56`). Run `scan.spec` **GREEN**. | `packages/files/src/fs/scan.ts` |
| 2.6 | Implement `src/fs/tree.ts` (`buildDirTree` path-chain + connectors + platform root; decode JSDoc `tdirlist.cpp`,`tvtext1.cpp:119-124`). Run `tree.spec` **GREEN**. | `packages/files/src/fs/tree.ts` |
| 2.7 | `src/fs/index.ts` barrel; `yarn verify`. | `packages/files/src/fs/index.ts` |

**Deliverables**: seam + `node:fs` default + pure wildcard/scan/sort/tree, all spec-green, zero-dep,
bounds-checked. **Verify**: `yarn verify`

---

## Phase 3: Listing trio — `FileList` + `FileInput` + `FileInfoPane` (spec-first)

**Reference**: [03-02](03-02-list-input-infopane.md) · [07](07-testing-strategy.md)

| # | Task | File |
|---|------|------|
| 3.1 | Write `file-list.spec.test.ts` (ST-3 rows/sort/2-col cell-by-cell, ST-4 toggle+filter, ST-14 sanitize), `file-input.spec.test.ts` (ST-5 mirror, ST-14), `file-info-pane.spec.test.ts` (ST-6 layout cell-by-cell, ST-13 broken link, ST-14). Run — **RED**. | `packages/files/test/{file-list,file-input,file-info-pane}.spec.test.ts` |
| 3.2 | Implement `src/list/file-list.ts` (`extends ListView<DirEntry>`, `numCols:2`, dir→trailing sep `getText`, pre-sorted `computed`, `showHidden`+`filter`, focus/open broadcasts, type-ahead; decode JSDoc). ≤ 500 lines. | `packages/files/src/list/file-list.ts` |
| 3.3 | Implement `src/input/file-input.ts` (`extends Input`, mirror-on-focus-broadcast, dir→+sep+wildcard, not-focused guard; decode JSDoc `stddlg.cpp:78-91`). | `packages/files/src/input/file-input.ts` |
| 3.4 | Implement `src/list/file-info-pane.ts` (`extends View`, row0 path / row1 name+right-aligned fields (12-hour `MONTHS`), no attrs field, clamp to `size.x`, `fileInfo`/reused role; decode JSDoc `stddlg.cpp:221-299`). | `packages/files/src/list/file-info-pane.ts` |
| 3.5 | Run the three specs **GREEN** (on any fidelity mismatch the **code** is wrong — fix vs the `.cpp`); `yarn verify`. | — |

**Deliverables**: the listing trio spec-green, cell-by-cell faithful, sanitized, bounds-checked.
**Verify**: `yarn verify`

---

## Phase 4: `FileDialog` + local error dialog (spec-first)

**Reference**: [03-03](03-03-file-dialog.md) · [07](07-testing-strategy.md)

| # | Task | File |
|---|------|------|
| 4.1 | Write `file-dialog.spec.test.ts` (ST-8 geometry/composition open-mode, ST-9 valid/wildcard/dir/error/cancel, ST-11 cross-platform, ST-12 errors, ST-19 save-mode). Run — **RED**. | `packages/files/test/file-dialog.spec.test.ts` |
| 4.2 | Implement `src/dialog/error-dialog.ts` (`errorBox(host,msg)` — a small modal gray `Dialog` + `Label` + `okButton`, sanitized message; PA-3). | `packages/files/src/dialog/error-dialog.ts` |
| 4.3 | Implement `src/dialog/file-dialog.ts` (`extends Dialog`, 49×19-min composition at decoded rects, open+save button sets, `valid()` state machine over the seam, resolve/cancel via `execView`; decode JSDoc `tfildlg.cpp:58-351`). Split `file-dialog-geometry.ts` if > 500. | `packages/files/src/dialog/file-dialog.ts` (+ geometry helper if needed) |
| 4.4 | Run `file-dialog.spec` **GREEN** (fix code vs `tfildlg.cpp` on mismatch); `yarn verify`. | — |

**Deliverables**: `FileDialog` (open+save) + error dialog spec-green; wildcard/dir/valid/cancel faithful;
every fs call guarded. **Verify**: `yarn verify`

---

## Phase 5: `DirList` + `ChDirDialog` (spec-first)

**Reference**: [03-04](03-04-dir-list-chdir-dialog.md) · [07](07-testing-strategy.md)

| # | Task | File |
|---|------|------|
| 5.1 | Write `dir-list.spec.test.ts` (ST-7 tree render cell-by-cell, roots, `cmChangeDir`, ST-14) + `chdir-dialog.spec.test.ts` (ST-10 geometry+Chdir/Revert/valid, ST-11, ST-12). Run — **RED**. | `packages/files/test/{dir-list,chdir-dialog}.spec.test.ts` |
| 5.2 | Implement `src/list/dir-list.ts` (`extends ListBox`, `buildDirTree` items, connector `getText`, platform root, select→change-dir; decode JSDoc `tdirlist.cpp`). | `packages/files/src/list/dir-list.ts` |
| 5.3 | Implement `src/dialog/chdir-dialog.ts` (`extends Dialog`, 48×18-min composition, Chdir descends / Revert restores start / `valid(cmOK)` resolves-or-errors via the seam + error dialog; decode JSDoc `tchdrdlg.cpp:42-218`). | `packages/files/src/dialog/chdir-dialog.ts` |
| 5.4 | `src/list/index.ts` + `src/dialog/index.ts` barrels. Run both specs **GREEN**; `yarn verify`. | `packages/files/src/{list,dialog}/index.ts` |

**Deliverables**: `DirList` + `ChDirDialog` spec-green, connectors + geometry faithful, guarded.
**Verify**: `yarn verify`

---

## Phase 6: History dropdown + convenience openers (spec-first)

**Reference**: [03-05](03-05-history-openers-packaging.md) · [07](07-testing-strategy.md)

| # | Task | File |
|---|------|------|
| 6.1 | Write `history-files.spec.test.ts` (ST-18: History on both inputs at the decoded coords; RD-14 suites green) + `openers.spec.test.ts` (ST-20: `openFile`/`changeDir` resolve+cancel+default fs+save-mode). Run — **RED**. | `packages/files/test/{history-files,openers}.spec.test.ts` |
| 6.2 | Wire `History` into `FileDialog` (`31,3,34,4`) + `ChDirDialog` (`42,3,45,4`) with per-dialog recent-path ids (PA-9; no `dropdown/` edit). | `packages/files/src/dialog/{file-dialog,chdir-dialog}.ts` |
| 6.3 | Implement `src/openers.ts` (`openFile`/`changeDir` — `host` = an `execView`-capable app handle (NOT `ModalHost`, PF-002); each runs **add-to-desktop → `execView` → remove-in-`finally`**; default `nodeFileSystem`; `save` picks the set). | `packages/files/src/openers.ts` |
| 6.4 | Run both specs **GREEN** + the RD-14 `history.*`/`combo-box.*` suites **green, unchanged**; `yarn verify`. | — |

**Deliverables**: History dropdowns + openers spec-green; RD-14 regression clean. **Verify**: `yarn verify`

---

## Phase 7: GATE-2 AFTER-diff + impl tests & hardening

**Reference**: all `03-*` · [07](07-testing-strategy.md) · **Objective**: prove the rendered output vs the
`.cpp`; cover edges; harden cross-cutting.

| # | Task | File |
|---|------|------|
| 7.1 | **[GATE-2 AFTER-diff]** Re-open each `.cpp` and diff the composed output **cell-by-cell**: FileDialog + ChDirDialog geometry/child rects/button strip, FileList 2-col rows + sort + `│` divider + trailing sep, FileInfoPane fields (no attrs), DirList connectors, and every resolved colour. Record the diff in each component's JSDoc / commit; fix code on any disagreement (the C++ outranks our spec for TV draws). | component JSDoc / commit |
| 7.2 | Cross-platform hardening (ST-11): run the suite under a Windows-style seam (`\`, drive roots) — directory marker, info-pane path, `DirList` roots correct both ways. | `packages/files/test/*` |
| 7.3 | Error/symlink/sanitize hardening (ST-12/13/14): EACCES/ENOENT/ENOTDIR dir, per-entry stat failure, empty dir, broken/cyclic symlink, control-byte names — defined result, no throw, sanitize-clean. | `packages/files/test/*` |
| 7.4 | Write the impl-test suite (edges/internals) per [07](07-testing-strategy.md): `wildcard.impl`, `scan.impl`, `tree.impl`, `file-list.impl`, `file-input.impl`, `file-info-pane.impl`, `file-dialog.impl`, `chdir-dialog.impl`, `dir-list.impl`, `openers.impl`. | `packages/files/test/*.impl.test.ts` |
| 7.5 | Full verification: `yarn verify` + RD-11 + RD-14 suites still green. | — |

**Deliverables**: GATE-2 AFTER-diff recorded (all six draws); edge/security/cross-platform tests green;
RD-11/RD-14 unchanged. **Verify**: `yarn verify`

---

## Phase 8: Packaging, kitchen-sink stories, `demo:files`

**Reference**: [03-05](03-05-history-openers-packaging.md)

| # | Task | File |
|---|------|------|
| 8.1 | Write `files.packaging.spec.test.ts` (ST-16): explicit re-exports present, `check:deps` clean, files ≤ 500, `sync-versions --check` excludes `@jsvision/files`. Run — **RED**. | `packages/files/test/files.packaging.spec.test.ts` |
| 8.2 | Complete the barrel `src/index.ts` — explicit named re-exports (six components + `FileSystem`/`DirEntry`/`FileStat`/`nodeFileSystem` + `openFile`/`changeDir` + option types). Run — **GREEN**. | `packages/files/src/index.ts` |
| 8.3 | **Kitchen-sink stories (+ smoke, ST-17)**: `stories/file-dialog.story.ts` (id `files/file-dialog`, category `Files`, `rd:'RD-09'`) + `stories/chdir-dialog.story.ts` (id `files/chdir-dialog`) over an in-memory fs + two `stories/index.ts` lines; each is a **canvas-fit representative scene** (72×16 smoke canvas < the 49×19/48×18 dialogs, PF-005 — no clipped text); both pass `kitchen-sink.smoke.spec`. | `packages/examples/kitchen-sink/stories/{file-dialog,chdir-dialog}.story.ts`, `stories/index.ts` |
| 8.4 | **`demo:files`** (ST-17): `examples/files-demo/main.ts` (ASCII frame per step) + `"demo:files"` script + `files-demo.e2e.test.ts`; add `@jsvision/files` to `packages/examples/package.json`. | `packages/examples/files-demo/main.ts`, `packages/examples/package.json`, `packages/examples/test/files-demo.e2e.test.ts` |
| 8.5 | Full verification incl. `yarn check:deps` + `yarn test:e2e`; update CLAUDE.md/roadmap (exec_plan post-analysis). | — |

**Deliverables**: package public API + explicit re-exports; `check:deps` clean; both stories smoke-green;
`demo:files` headless + e2e green. **Verify**: `yarn verify`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp on completion; bump the Progress header;
> never batch. Immutable-oracle rule: a failing spec test means the **code** is wrong — fix the code,
> never the spec. For a TV-derived draw, a spec oracle disagreeing with a faithful `.cpp` decode is the
> defect — fix it against the source, cite the `.cpp`.

### Phase 1: Scaffold + GATE-1 decode + `numCols`/bar seams + `fileInfo` branch
- [x] 1.1 [GATE-1 BEFORE-decode] Re-verify + finalize the decode in `03-*` + code-JSDoc note (all six + `getColor` chain) — 2026-07-05 (multi-col `tlstview.cpp` decode re-verified; `tfildlg`/`tfillist`/`tchdrdlg`/`tvtext1` citations spot-verified against source)
- [x] 1.2 Scaffold `packages/files/` (package.json/tsconfig/vitest); Turbo picks it up — 2026-07-05 (`@jsvision/files:build` green)
- [x] 1.3 Write `list-numcols.spec` (ST-21: `numCols` + injectable/oriented bar); run RED — 2026-07-05
- [x] 1.4 Implement `numCols` + the injectable/orientable-bar seam on `ListRows`/`ListView` — 2026-07-05 (+ additive `ScrollBar.setRange` arrowStep param + `arrowStep()` getter realizing TV `setStep(pgStep,arStep)`)
- [x] 1.5 `list-numcols.spec` GREEN + RD-11 list suites green (regression guard) — 2026-07-05 (11 suites / 53 tests green)
- [x] 1.6 Write `files-theme.spec` (ST-15); run RED — 2026-07-05
- [x] 1.7 [PA-6 branch] Resolve `0x1E`; add `fileInfo` role + guards **if distinct**, else 0 roles — 2026-07-05 (**distinct** → added `fileInfo` = `0x13` cyan-on-blue; 4 closed-set theme guards extended; PA-6 runtime resolution recorded)
- [x] 1.8 `files-theme.spec` GREEN; `yarn verify` — 2026-07-05 (verify 11/11 turbo tasks; ui 1117 tests; files 3 tests)
- [x] 1.9 Update the "single column only" JSDoc in `list-view.ts`/`list-rows.ts` — 2026-07-05

### Phase 2: `FileSystem` seam + pure cores
- [x] 2.1 Write `memory-fs.ts` helper + `fs-seam`/`wildcard`/`scan`/`tree` specs; run RED — 2026-07-05 (+ PA-2 runtime symlink decision recorded)
- [x] 2.2 Implement `fs/types.ts` + `fs/node-fs.ts` — 2026-07-05
- [x] 2.3 `fs-seam.spec` GREEN — 2026-07-05
- [x] 2.4 Implement `fs/wildcard.ts`; `wildcard.spec` GREEN — 2026-07-05 (`findfrst.cpp:173-186` recursive `?`/`*`, case-sensitive, `*.*`→`*`)
- [x] 2.5 Implement `fs/scan.ts` (+ `compareEntries`); `scan.spec` GREEN — 2026-07-05 (`tfilecol.cpp:47-56` sort; `tfillist.cpp` hidden/dir/`..` populate)
- [x] 2.6 Implement `fs/tree.ts`; `tree.spec` GREEN — 2026-07-05 (`tdirlist.cpp:104-186` chain+subdir connectors + graphics fixup)
- [x] 2.7 `fs/index.ts` barrel; `yarn verify` — 2026-07-05 (verify 11/11; files 19 tests; check:deps clean)

### Phase 3: Listing trio
- [x] 3.1 Write `file-list`/`file-input`/`file-info-pane` specs; run RED — 2026-07-06
- [x] 3.2 Implement `list/file-list.ts` (2-col, sort, toggle, filter, broadcasts) — 2026-07-06 (`extends ListView<DirEntry>`, `numCols:2`, trailing-sep `getText`, reactive scan bind, `focusedEntry` accessor)
- [x] 3.3 Implement `input/file-input.ts` (mirror-on-focus) — 2026-07-06 (`stddlg.cpp:78` not-focused guard, dir→+sep+wildcard, `untrack` so only the focus broadcast re-mirrors)
- [x] 3.4 Implement `list/file-info-pane.ts` (path/name+fields, no attrs) — 2026-07-06 (`stddlg.cpp:221-299` field offsets, 12-hour, `fileInfo` role, broken-link no-fields)
- [x] 3.5 Three specs GREEN (fix code vs `.cpp`); `yarn verify` — 2026-07-06 (10 specs green first try, no fidelity mismatch; verify 11/11; files 29 tests; no reactive leak)

### Phase 4: `FileDialog` + error dialog
- [x] 4.1 Write `file-dialog.spec` (ST-8/9/11/12/19); run RED — 2026-07-06 (+ PA-3 runtime showError-seam decision recorded)
- [x] 4.2 Implement `dialog/error-dialog.ts` — 2026-07-06 (`errorBox(host,msg)` + `ExecHost`; add-to-desktop→execView→remove lifecycle)
- [x] 4.3 Implement `dialog/file-dialog.ts` (open+save, valid state machine) — 2026-07-06 (`tfildlg.cpp` 49×19 composition at decoded rects, injected horizontal-bottom bar PA-14, `valid()` wildcard/dir/file/error branches, Enter-on-list openEntry, save-mode Replace/Clear)
- [x] 4.4 `file-dialog.spec` GREEN; `yarn verify` — 2026-07-06 (6 specs green; verify 11/11; files 35 tests; typecheck clean; no production reactive leak)

### Phase 5: `DirList` + `ChDirDialog`
- [x] 5.1 Write `dir-list`/`chdir-dialog` specs; run RED — 2026-07-06 (ST-7/14 + ST-10/11/12; render assertions derived from the `tree.spec` SoT, not re-hardcoded)
- [x] 5.2 Implement `list/dir-list.ts` — 2026-07-06 (`extends ListView<DirNode>` — the faithful `TDirListBox` mapping since string `ListBox` can't carry the path; reactive `buildDirTree` re-root, `focusedNode`, `onChangeDir`)
- [x] 5.3 Implement `dialog/chdir-dialog.ts` (Chdir/Revert/valid) — 2026-07-06 (`tchdrdlg.cpp` 48×18 composition; path field reflects `directory`; `chdir()` descends focused node, `revert()` restores start, `valid(cmOK)` validates a readable dir → error seam else)
- [x] 5.4 `list`/`dialog` barrels; both specs GREEN; `yarn verify` — 2026-07-06 (single `src/index.ts` barrel wired: fs cores + listing trio + DirList + both dialogs + errorBox; 8 specs green; verify 11/11; files 43; typecheck clean)

### Phase 6: History + openers
- [x] 6.1 Write `history-files`/`openers` specs; run RED — 2026-07-06 (ST-18 History coords on both dialogs; ST-20 openFile/changeDir resolve+cancel+default-fs+save)
- [x] 6.2 Wire `History` into both dialogs (decoded coords) — 2026-07-06 (FileDialog `31,3,34,4` over fileInput; ChDirDialog `42,3,45,4` over pathInput; distinct default historyIds 0x0f11/0x0f12, PA-9; no dropdown/ edit)
- [x] 6.3 Implement `openers.ts` (`openFile`/`changeDir`; `execView`-capable host + add/execView/remove lifecycle, PF-002) — 2026-07-06 (default nodeFileSystem; errorBox wired into showError; save picks the set; resolves abs path on ok / null on cancel)
- [x] 6.4 Both specs GREEN + RD-14 suites green; `yarn verify` — 2026-07-06 (6 specs green; files 49; ui 1117 incl. history/combo suites unchanged; verify 11/11; typecheck clean)

### Phase 7: GATE-2 AFTER-diff + impl tests & hardening
- [x] 7.1 [GATE-2 AFTER-diff] Cell-by-cell diff of all six draws vs the `.cpp`; record — 2026-07-06 (re-read tfildlg/tchdrdlg/tfillist/stddlg/tdirlist; every child rect + getText + info-pane columns + connectors + colours verified; fixed FileDialog/ChDirDialog label rects to TV widths; recorded the cmFileOpen→Commands.ok binding + dirList+sb footprint reconciliations; GATE-2 notes in each component JSDoc)
- [x] 7.2 Cross-platform hardening (Windows-style seam) — ST-11 — 2026-07-06 (win32 seams across tree/dir-list/file-info-pane/file-dialog/chdir-dialog: drive roots, backslash join/resolve)
- [x] 7.3 Error/symlink/sanitize hardening — ST-12/13/14 — 2026-07-06 (unreadable-dir propagates a defined error caught by the FileList wrapper per ST-12; degraded per-entry seam; empty dir; control-byte names sanitize-clean across all views)
- [x] 7.4 Write the impl-test suite (10 files) — 2026-07-06 (61 impl tests derived cell-by-cell from source; FileInfoPane column math + 12-hour midnight edge, valid() branches, openEntry, openers add→execView→remove cleanup on resolve+cancel)
- [x] 7.5 Full verification; RD-11 + RD-14 green — 2026-07-06 (verify 11/11; files 110 = 49 spec + 61 impl; ui 1117 unchanged; core 600; examples 85; typecheck clean; no source bugs)

### Phase 8: Packaging, stories, `demo:files`
- [x] 8.1 Write `files.packaging.spec` (ST-16); run RED — 2026-07-06 (4 tests: 6 components exported classes, cores/errorBox/openers callables, files ≤500, private + deps=[core,ui])
- [x] 8.2 Complete the barrel `src/index.ts`; run GREEN — 2026-07-06 (barrel completed in Phases 5-6; packaging spec confirms the full public surface)
- [x] 8.3 Kitchen-sink `files/file-dialog` + `files/chdir-dialog` stories — canvas-fit scenes, PF-005 (+ smoke, ST-17) — 2026-07-06 (launch-button pattern like dialog.story: execView opens the modal live over nodeFileSystem, headless renders the button+hint — no clipped text; smoke now 38, both registered)
- [x] 8.4 `demo:files` headless + script + e2e (ST-17); examples dep — 2026-07-06 (files-demo/main.ts renders the FileDialog faithfully over an inline in-memory fs — 2-col listing/│/History/info-pane date-time, *.ts re-filter, src/ descend, resolved path, ChDirDialog tree incl. └──nested fixup; wrapped in createRoot — no reactive leak; e2e green; @jsvision/files added to examples)
- [x] 8.5 Full verification incl. `check:deps` + `test:e2e`; post-completion re-analysis — 2026-07-06 (verify 11/11; files 114; ui 1117; core 600; examples 87; e2e 16; check:deps clean; lint clean)

---

## Dependencies

```
Phase 1 (scaffold + GATE-1 decode + numCols/bar ui seams + fileInfo role branch)
    ↓
Phase 2 (FileSystem seam + pure cores — needs the scaffold)
    ↓
Phase 3 (listing trio — needs the cores + numCols + fileInfo role)
    ↓
Phase 4 (FileDialog — needs the listing trio + error dialog)
    ↓
Phase 5 (DirList + ChDirDialog — needs the cores + Dialog + error dialog)
    ↓
Phase 6 (History + openers — needs both dialogs)
    ↓
Phase 7 (GATE-2 AFTER-diff + impl tests — needs the rendered output)
    ↓
Phase 8 (packaging + stories + demo — needs the public API)
```

## Success Criteria

1. ✅ All 43 tasks completed
2. ✅ `yarn verify` + `yarn check:deps` (zero runtime deps) + `yarn test:e2e` clean
3. ✅ No dead code; every file ≤ 500 lines
4. ✅ GATE-1 BEFORE + GATE-2 AFTER recorded for all six TV-derived draws (decode incl. `getColor` chain)
5. ✅ Security: every name `sanitize`-clean; every fs call guarded (no crash, no garbage listing); all
   indexing bounds-checked; paths via `node:path` (no shell/`eval`); symlinks `lstat`-safe
6. ✅ Cross-package edits additive only: `numCols` + injectable/orientable-bar seam on ui (defaults
   unchanged, RD-11 green), 0-or-1 `fileInfo` role (no
   existing role/byte/export changed; guards extended if added); RD-14 suites green; local error dialog
   (no new ui primitive)
7. ✅ Kitchen-sink `files/file-dialog` + `files/chdir-dialog` stories pass smoke; `demo:files` headless + e2e
8. ✅ `@jsvision/files` (`private`) builds via Turbo, excluded from `sync-versions`; explicit re-exports
9. ✅ Documentation/roadmap updated (exec_plan post-completion re-analysis)
