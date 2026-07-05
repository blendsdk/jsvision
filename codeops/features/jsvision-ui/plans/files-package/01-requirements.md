# Requirements: Files package (`@jsvision/files`)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-09](../../requirements/RD-09-files-package.md)
> **CodeOps Skills Version**: 3.3.0

This document scopes the plan to the RD. It **references, does not restate** — every AC below is the
RD's immutable oracle (AC-1…AC-17), and every decode fact traces to the RD's decode table + the C++
`file:line`. See RD-09 for the full narrative; see [07](07-testing-strategy.md) for the ST oracles.

## Feature scope

Build **`@jsvision/files`**, a new private workspace package on `@jsvision/ui`, shipping the six
TV file-system components + the `FileSystem` seam + all four Should-Haves (PA-1).

### In scope

| Area | What | AC / AR |
|------|------|---------|
| `FileSystem` seam | Injectable sync interface + default `node:fs` impl (full surface, PA-2); zero runtime deps | AC-1 / AR-235 |
| Pure cores | `wildcardMatch`/`isWild` (case-sensitive `?`/`*`, `*.*`→`*`); `scanDirectory` over the seam; the `TFileCollection` sort comparator; the `DirList` path-chain + connector geometry | AC-2/AC-3/AC-7 |
| `FileList` | `ListView` extension: 2-column rows (dir ⇒ trailing sep, **not** `[NAME]`), sort (files→dirs→`..` last), hidden default + reveal toggle, focus/open broadcasts, type-ahead, the `filter` hook | AC-3/AC-4 / AR-238/239 |
| `FileInput` | `Input` extension: mirror the focused entry (dir → +sep+wildcard) | AC-5 / AR-238 |
| `FileInfoPane` | `View`: expanded path (row 0) + name/size/date/time (row 1, `months[]`, 12-hour), no attributes field | AC-6 / AR-238/247 |
| `DirList` | `ListBox` extension: path-chain + subdirs with `└─┬`/`├─`/`└─` connectors, `indentSize=2`, platform roots, `cmChangeDir` | AC-7 / AR-238/237 |
| `FileDialog` | `Dialog` compose at decoded geometry (49×19), open **+ save mode** (Open/OK/Replace/Clear/Cancel/Help), wildcard/dir/valid resolution, local error dialog, resolve to path | AC-8/AC-9 / AR-238/241 |
| `ChDirDialog` | `Dialog` compose (48×18): path input + `DirList` tree + OK/Chdir/Revert/Help, `valid(cmOK)`, resolve to dir | AC-10 / AR-238/241 |
| Cross-cutting | Cross-platform paths (POSIX+Windows), graceful errors (no crash), symlinks (lstat-tagged), sanitize every name | AC-11/12/13/14 / AR-237/240/241/245 |
| Should-Haves (PA-1) | History dropdown (both inputs), save-mode buttons, convenience openers `openFile`/`changeDir`, caller `filter` hook | RD Should-Have |
| Theme / packaging | 0-or-1 additive `fileInfo` role (PA-6); new `packages/files/` (`private`), Turbo/CI wiring, `check:deps`, ≤500 lines | AC-15/AC-16 / AR-242/246/247 |
| Showcase | `files/file-dialog` + `files/chdir-dialog` stories over in-memory fs + `demo:files` | AC-17 / AR-244 |

### Out of scope (RD "Won't Have") / deferred

- File-content editing (`TFileEditor` disk I/O) — editor tier.
- Remote/virtual/archived filesystems — the seam allows them later; only `node:fs` ships.
- File operations (copy/move/delete/rename/mkdir) — TV's dialogs don't perform them.
- Watching / live refresh (`fs.watch`) — one synchronous read per navigation.
- **DEF-32** async directory reads + loading state; **DEF-33** extended glob (`**`/brace/char-class) —
  both tracked-deferred in the RD, **not** in this plan.
- A **faithful shared `messageBox`/`TMsgBox`** — a separate future RD (PA-3); this plan uses a local
  error dialog only.

## Definition of done

1. All 17 ACs (+ the four Should-Have oracles) encoded as spec oracles ST-1…ST-21 and green.
2. GATE-1 BEFORE-decode recorded in the `03-*` docs + code JSDoc; GATE-2 AFTER-diff of all six
   TV-derived draws recorded (PA-13).
3. `yarn verify` + `yarn check:deps` + `yarn test:e2e` clean; every file ≤ 500 lines.
4. Kitchen-sink stories pass the smoke test; `demo:files` runs headless (e2e green).
5. 0-or-1 additive `fileInfo` role only; no existing role/export/`@jsvision/ui` change (PA-6/PA-3).
6. Security hardened: every name `sanitize`-clean; every fs call guarded (no crash); all indexing
   bounds-checked; paths resolved via `node:path` (no shell, no `eval`).
