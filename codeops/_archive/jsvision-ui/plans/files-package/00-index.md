# Files package (`@jsvision/files`) Implementation Plan

> **Feature**: The Turbo Vision file-system dialog family as a new `@jsvision/files` package on `@jsvision/ui`
> **Status**: Planning Complete
> **Created**: 2026-07-05
> **Implements**: jsvision-ui/RD-09
> **CodeOps Skills Version**: 3.3.0

## Overview

RD-09 stands up the **second published-shape package** in the portfolio — **`@jsvision/files`** — the
Turbo Vision file dialogs relocated out of the core UI package because they drag in `fs`/path concerns
`@jsvision/ui` deliberately avoids (component map §9). It ships **six components** built by composing
shipped `@jsvision/ui` widgets:

- **`FileDialog`** (decode of `TFileDialog`) — a modal open/save dialog: a `FileInput` + `~F~ile` label
  (+ `History`), a `FileList` + scrollbar + `~F~iles` label, a stacked button strip (Open/OK/Replace/
  Clear/Cancel/Help), and a `FileInfoPane`; resolves to the chosen absolute path.
- **`FileList`** (decode of `TFileList`, extends `ListView`) — the 2-column virtual-scroll listing:
  files, directories (trailing separator), and a synthesized `..` (sorted **last**), with type-ahead
  and focus/open broadcasts.
- **`FileInput`** (decode of `TFileInputLine`, extends `Input`) — the filename field that mirrors the
  focused list entry (appending the wildcard for a directory).
- **`FileInfoPane`** (decode of `TFileInfoPane`, a `View`) — the passive read-out: expanded path (row 0)
  + focused entry name/size/date/time (row 1), no attributes field.
- **`DirList`** (decode of `TDirListBox`, extends `ListBox`) — the directory tree with faithful
  `└─┬`/`├─`/`└─` connectors + a platform root list; selecting a node emits change-directory.
- **`ChDirDialog`** (decode of `TChDirDialog`) — a modal change-working-directory dialog: a path
  `Input` (+ `History`), a `DirList` tree + scrollbar, and OK/Chdir/Revert/Help.

Everything disk-touching goes through an **injectable `FileSystem` seam** (default `node:fs`), so the
whole family runs **headless against an in-memory fs** in tests + the kitchen-sink story. Because
**every** component has a TV counterpart, the **GATE-1 BEFORE-decode + GATE-2 AFTER-diff are mandatory**
(NON-NEGOTIABLE TV-fidelity directive + `codeops/tv-fidelity-gate.md`): dialog geometry
(`tfildlg.cpp`/`tchdrdlg.cpp`), list rows + sort (`tfillist.cpp`/`tfilecol.cpp`), info-pane fields
(`stddlg.cpp:221-299`), tree connectors (`tdirlist.cpp` + `tvtext1.cpp:119-124`), and every `getColor(N)`
through the gray-dialog → `cpAppColor` chain. The seam / wildcard / cross-platform / sanitize / reactive
/ opener extensions get spec oracles but no diff.

**v1 scope (PA-1):** all six Must-Have components + **all four Should-Haves** (convenience openers,
save-mode buttons, History dropdown, `filter` hook) + the full `FileSystem` seam. Cross-package edits are
**additive only**: **0-or-1** core theme role (`fileInfo`, only if the GATE-1 `cpInfoPane` decode proves
it distinct — PA-6); **two additive `@jsvision/ui` seams** on `ListRows`/`ListView` — a `numCols` param
(default `1`) **and** an injectable/orientable-`ScrollBar` seam (default = the owned vertical bar) — so
`FileList` gets TV's faithful 2-column `TListViewer` layout **plus** its decoded horizontal-bottom bar
(PA-14, RD-11 list suites stay green); otherwise pure composition + a local error dialog (PA-3). No
existing export changes.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (PA-1…PA-13) |
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope (Source: RD-09) |
| 02 | [Current State](02-current-state.md) | Reuse points in `@jsvision/ui`/`core` + packaging mechanics |
| 03-01 | [FileSystem seam + pure cores](03-01-fs-seam-and-cores.md) | The `FileSystem` interface + `node:fs` default + `wildcard`/`scan`+sort/`tree` |
| 03-02 | [FileList + FileInput + FileInfoPane](03-02-list-input-infopane.md) | The listing trio (decodes of `TFileList`/`TFileInputLine`/`TFileInfoPane`) |
| 03-03 | [FileDialog + error dialog](03-03-file-dialog.md) | The open/save dialog (decode of `TFileDialog`) + the local error dialog |
| 03-04 | [DirList + ChDirDialog](03-04-dir-list-chdir-dialog.md) | The directory tree + change-dir dialog (decodes of `TDirListBox`/`TChDirDialog`) |
| 03-05 | [History, openers, theme, packaging](03-05-history-openers-packaging.md) | Should-Haves, the `fileInfo` role branch, packaging, stories, demo |
| 07 | [Testing Strategy](07-testing-strategy.md) | ST-1…ST-21 spec oracles ↔ AC-1…AC-17 + Should-Haves |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and the task checklist |

## Quick Reference

### Usage Examples

```ts
import { openFile, changeDir, FileDialog, nodeFileSystem } from '@jsvision/files';

// Convenience opener (Should-Have) — a Promise over execView.
const path = await openFile({ host: app, wildcard: '*.ts', directory: process.cwd() });
if (path) load(path);

// Headless / test — inject an in-memory FileSystem; no real disk touched.
const dlg = new FileDialog({ fs: memoryFs, wildcard: '*.*', onResolve: (p) => {} });

// Change the working directory via the tree dialog.
const dir = await changeDir({ host: app, directory: '/home/user' });
```

### Key Decisions

| Decision | Outcome | AR Ref |
|----------|---------|--------|
| v1 scope | 6 Must-Have + all 4 Should-Have + full seam | PA-1 |
| `FileSystem` surface | Full sync surface (readDir/stat/lstat/path ops/roots) | PA-2 |
| `valid()` error box | Local gray error `Dialog` in `@jsvision/files` (no new ui primitive) | PA-3 |
| File split | Dir-per-concern: `fs/`, `list/`, `input/`, `dialog/`, `openers.ts` | PA-4 |
| Version sync | Auto-excluded via `private: true` (no skip-list edit) | PA-5 |
| Theme role | 0-or-1 additive `fileInfo`, pinned at GATE-1 (RD-21 pattern) | PA-6 |
| 2-column FileList + bottom bar | Additive `numCols` + injectable/orientable-bar seam on ui `ListRows`/`ListView` (defaults unchanged) | PA-14 |
| Fidelity | GATE-1 BEFORE + GATE-2 AFTER mandatory for all six | PA-13 |

## Related Files

**New package** — `packages/files/` (`package.json` `private:true`, `tsconfig.json`, `vitest.config.ts`),
`src/fs/{types,node-fs,wildcard,scan,tree,index}.ts`, `src/list/{file-list,file-info-pane,dir-list}.ts`,
`src/input/file-input.ts`, `src/dialog/{file-dialog,chdir-dialog,error-dialog}.ts`, `src/openers.ts`,
`src/index.ts`.
**Modified (additive, 0-or-1)** — `packages/core/src/engine/color/theme.ts` + `color/index.ts` + `engine/index.ts`
(the `fileInfo` role, only if GATE-1 needs it) + the closed-set theme guard allowlists.
**Modified (additive) — `@jsvision/ui`** — `packages/ui/src/list/list-rows.ts` + `list-view.ts` (the
`numCols` param + an injectable/orientable-`ScrollBar` seam, both defaulting to today's behaviour; PA-14)
— incl. the "single column only" JSDoc update. RD-11 list suites stay green.
**New examples** — `packages/examples/kitchen-sink/stories/{file-dialog,chdir-dialog}.story.ts`,
`packages/examples/files-demo/`, `packages/examples/test/files-demo.e2e.test.ts`, and a
`@jsvision/files` dependency in `packages/examples/package.json`.
**Consumed, not edited** — `@jsvision/ui` (`Dialog`/`ListView`/`ListBox`/`Input`/`Label`/`Button`/
`ScrollBar`/`History`/`filter`), `@jsvision/core` (`sanitize`/`ScreenBuffer`/`defaultTheme`).
