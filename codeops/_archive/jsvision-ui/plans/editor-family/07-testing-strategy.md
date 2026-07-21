# Testing Strategy: Editor family

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
|-----------|--------|
| Pure cores (buffer/format/keymap/undo/search/ring) | 90% |
| Views (Editor/Memo/Indicator/EditWindow/Terminal/FileEditor) | 80% |
| Demos / stories / glue | 60% (smoke + e2e) |

- Test names state behavior (`should … when …`); house harness = headless `RenderRoot`/`EventLoop`
  + buffer-level assertions (the established ui pattern, PF-010); `FileEditor` runs entirely on the
  in-memory fs.
- **TV-fidelity caveat**: for TV-derived draws, the C++ outranks these oracles — a decode-conflict
  fix goes through `codeops/tv-fidelity-gate.md`, citing the `.cpp`.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from RD-08 (AC-1…AC-20), the 03-* decodes, and the Ambiguity Register
> (PA-1…PA-19). IMMUTABLE ORACLE RULE: if the implementation disagrees, the implementation is
> wrong (sole exception: the TV-fidelity caveat above). Every case carries its source.

### Buffer core (`buffer.spec`, `eol.spec`) — 03-01

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-1 | `"ab\ncd"`, p after `b` (=2): `lineStart/lineEnd`; same with `"ab\r\ncd"`; `charPos` with a tab at visual col 3; `lineMove` down from `"abcdef"` col 5 onto `"xy"` | `lineStart=0, lineEnd=2`; CRLF: step over `\r\n` is ONE unit; tab expands to col 8 (`(pos\|7)+1`); `lineMove` clamps to the short line's EOL and restores col 5 on return | AC-1 |
| ST-2 | `nextChar`/`prevChar` over `"a👍b"`, `"éx"`, `"漢z"` | Steps land only on cluster starts; `👍` (2 units) and `e+́` traverse as one; backspace-delete removes the whole cluster | AC-16 |
| ST-3 | `nextWord`/`prevWord` over `"foo  bar(baz)"` from 0 | Hops land per the TV char classes (`teditor2.cpp:45-59`); distinct from Input's hops (no merge) | AC-4 / PF-014 |
| ST-4 | Navigation over `"\uD83D"` (lone surrogate) and p outside `[0,length]` | Never throws; lone surrogate = one 1-unit cluster; positions clamp | RD §Security (HR-01) |
| ST-5 | `setText("a\r\nb")` → type Enter → paste `"x\ny"`; `setText("a\nb\r\nc")` read back; `setText("plain")` | Detected `crlf`; Enter inserts `\r\n`; pasted `\n`→`\r\n`; mixed-EOL text round-trips byte-identical (verbatim store); break-less ⇒ `lf` | AC-15 / AR-252 / PF-008 |

### `formatLine` + keymap (`format.spec`, `keymap.spec`) — 03-02

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-6 | Row `"hello!"` with selection `[2,5)` | Cells 0–1 `editorNormal`, 2–4 `editorSelected`, rest normal; bytes `0x1E`/`0x71` per the pinned roles | AC-2 / PA-8 |
| ST-7 | Row with `\t` at col 3; `hScroll=4` with a wide glyph straddling col 4; text ending before width; a row containing `\x1b]0;x\x07` + C0 bytes | Tab renders as spaces to col 8; straddled wide glyph renders as spaces (never split); EOL pads with trailing colour to width; hostile bytes land as inert sanitized cells in the `ScreenBuffer` | AC-2 / AC-17 / PF-010 |
| ST-8 | `resolveKey` on Ctrl-S/D/E/X, arrows, Home/End/PgUp/PgDn/Ins/Del/Backspace | The decoded `firstKeys` actions (charLeft/charRight/lineUp/lineDown, …) | AC-3 |
| ST-9 | Ctrl-Q then `f` / `F`; Ctrl-K then `b`; Ctrl-Q then `z` | `find` (case-normalized in prefix), `startSelect`; unknown clears the prefix, consumed, no action | AC-3 |

### `Editor` view (`editor.spec`) — 03-02

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-10 | Shift+Right over `"👍x"`; plain click at a cell; double-click on `bar` in `"foo bar"`; triple-click on line 2; drag below the bottom edge (injected clock, PA-18) | Extends one cluster; click collapses selection; exactly `bar` selected; whole line incl. EOL; auto-scroll + extend | AC-4 / PA-18 |
| ST-11 | Ins, then type `a` over `"xy"` at 0; Ins-typing at EOL; Enter after `"  foo"` with autoIndent on/off | `"ay"`; appends at EOL; new line starts `"  "` / no copy | AC-7 |
| ST-12 | `desiredCaret()` focused at curPos (5,2) with `delta` (1,1); unfocused | `{x:4, y:1}`; `null` | PF-004 / AC-2 |
| ST-13 | `attachGadgets` then edit/scroll (the indicator half uses a **recording `IndicatorTarget`** — the PF-003 structural seam; `Indicator` itself lands Phase 7) | H bar `setRange(0, limit.x−size.x, size.x/2, 1)` value `delta.x`; V `setRange(0, limit.y−size.y, size.y−1, 1)` value `delta.y`; `indicator.setValue({line,col} 1-based, modified)`; bar-value writes scroll the editor back | AC-11/AC-12 (decode: `setParams` pushes `teditor1.cpp:442,444` in `doUpdate` `:431-451`; write-back `checkScrollBar` `:502-512` — PF-009) |
| ST-14 | App with MenuBar; focused editor receives Ctrl-Q,F; the same key with focus elsewhere | Focused: editor consumes (find flows), menu never sees it; unfocused: editor untouched | PF-001 |

### Undo / clipboard / search (`undo.spec`, `search.spec`, `editor-dialogs.spec` + `editor.spec` cases) — 03-03

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-15 | Type `a`,`b`,`c`; move cursor; type `d`; undo ×2; redo ×2 | One coalesced step + a second; `""` after 2 undos; `"abcd"` after 2 redos | AC-6 |
| ST-16 | Undo once then type; fill past `undoDepth` (small injected depth) | Redo branch cleared; oldest whole steps evicted; `canUndo`/`canRedo` signals flip | AC-6 / PA-1 |
| ST-17 | Select `"hello"`; copy; cut; paste over a selection | Clipboard editor contains exactly `"hello"` and holds it selected (PA-16); ONE OSC-52 write with its base64; cut removes as one step; paste replaces the selection; with **no** clipboard injected: copy/cut still mirror + delete, paste no-ops | AC-5 / PA-2 / PA-16 |
| ST-18 | A 2-chunk bracketed paste | One insertion, one undo step | AC-5 |
| ST-19 | Find `"abc"` case-insensitive in `"xABCx"`; whole-words vs `"abcd"`; `searchAgain`; a miss; no seam wired | Selection lands on the match; `"abcd"` rejected; next hit found; `edSearchFailed` raised; `cmFind` a safe no-op (default cancels) | AC-8 / PA-17 |
| ST-20 | Replace with `promptOnReplace` over 3 hits (yes, no, yes); `replaceAll` over 4 hits | Prompt raised per hit, accept/skip honored; replace-all does 4 in one pass and **returns 4** | AC-8 / PF-009 |
| ST-21 | `findDialog()` / `replaceDialog()` composition; `replacePrompt` with cursor above/below the box | 38×12 + input `(3,3,32,4)` + 2-box cluster + OK/Cancel rects; 40×16 + 4-box `(3,8,37,12)`; records round-trip the flag booleans; prompt at top rows 1–8 h-centred, or — when the cursor's global y ≤ box bottom + 1 (`tvedit3.cpp:184-186`, PF-009) — moved so its **top** = `size.y − height − 2` | AC-9 / PA-11 |

### Memo / Indicator / EditWindow (`memo.spec`, `indicator.spec`, `edit-window.spec`, `window-seams.spec`) — 03-04

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-22 | `Memo` bound to `signal("hi")`; type `!`; external `set("new")`; Tab inside a `Dialog` | Shows `"hi"`; signal reads `"hi!"` same tick; buffer follows external writes (no loop); Tab moves dialog focus, nothing inserted | AC-10 |
| ST-23 | Memo cell colours | `memoNormal 0x30` / `memoSelected 0x2F` | AC-10 / PA-8 |
| ST-24 | Indicator at (0,0); at line 12 col 5; modified | `" 1:1 "` / `" 12:5 "` right-aligned with `:` at column 8; `☼` (U+263C) at column 0 when modified; fill `═` in `indicatorNormal 0x1F` | AC-11 / PA-8 |
| ST-25 | `window.dragging.set(true)` then `false` | Fill swaps to `─` in `indicatorDragging 0x1A`, then back | AC-11 / PA-3 |
| ST-26 | `EditWindow` at 60×20; resize to 20×5; titles — default (no `editor`), `editor === clipboard`, and an external `title` signal write (simulating the files factory's `fileName` bind / saveAs — plan-preflight PF-001 mechanics, pure-ui) | hScrollBar cols 18..57 row 19, vScrollBar rows 1..18 col 59, indicator cols 2..15 (PF-006 end-exclusive); clamped to 24×6; `"Untitled"` / `"Clipboard"` (the `teditwnd.cpp:70-78` identity check) / the written name; title re-renders on the signal write | AC-12 / PF-013 |
| ST-27 | Desktop `beginMove`→mouse-up and →stale-capture abort; window activate/deactivate | `dragging` true→false at BOTH clear sites; `active` tracks raise/focus; gadgets (both bars + indicator) hidden while inactive, shown when active | PA-3 / PA-19 / PA-10 |

### Terminal (`ring.spec`, `terminal.spec`) — 03-05

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-28 | Cap 32 units; five 10-unit `writeLine`s; one 100-unit write; `writeLine("a")`; empty ring | Oldest WHOLE lines evicted (never a partial head); the 100-unit write keeps only its tail (≤31 units); exactly one line added; empty ring draws empty, no crash | AC-14 / PF-007 |
| ST-29 | Writes exceeding view height; a write containing `\x1b]0;x\x07`+C0; colour | View auto-scrolls (last line visible); hostile bytes inert in the buffer; cells in `terminalNormal 0x1E` | AC-14 / AC-17 / PA-8 |

### FileEditor + fs seam (`fs-content.spec`, `file-editor.spec` — `packages/files/test/`) — 03-06

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-30 | The 4 new seam methods on memory-fs + node-fs shape; load a missing path; save `"a\r\nb"`; save over an existing file with backups ON | `readFile`/`writeFile`/`rename`/`unlink` present + behave; empty valid buffer; written bytes exactly the buffer content; old content readable at `.bak` (unlink-stale → rename → write sequence) | AC-13 / PA-6 |
| ST-31 | Save while untitled; close with modified buffer (answer Yes / No / Cancel via a scripted seam) | `edSaveAs` request through the seam (path answer saves + retitles); Yes saves then closes, No drops, Cancel keeps the window | AC-13 / PA-17 |

### Theme / packaging / showcase — 03-07

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-32 | `defaultTheme` after the additive edit | The 7 `editor*/memo*/indicator*/terminal*` roles present at the PA-8 bytes; no existing role changed; prior closed-set guards pass via extended allowlists | PA-8 / PA-14 |
| ST-33 | `ui` + `files` barrels; repo checks | Every 03-07 §Packaging symbol re-exported by name; internals absent; files ≤ 500 lines; `check:deps` clean | AC-19 |
| ST-34 | Kitchen-sink registry | `editor/editor`, `editor/memo`, `editor/terminal` registered with required metadata; all pass the headless smoke (paint something, unique ids) | AC-18 / AR-260 |
| ST-35 | 1 MB buffer: single-char insert + coalesced redraw; a cursor move (off-CI) | Each < 16 ms on the dev box; skipped under `CI`/`TUI_SKIP_PERF`; never gates | AC-20 / AR-261 |

> **⚠️ AUTHORING RULE:** expectations above come from RD-08 + the recorded decodes only. Any gap
> found while writing a spec test = a new ambiguity → register + user decision first.

## Test Categories

### Specification tests (files ↔ ST cases)

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `packages/ui/test/buffer.spec.test.ts` | ST-1…ST-4 | 03-01 gap/segment/navigate |
| `packages/ui/test/eol.spec.test.ts` | ST-5 | 03-01 EOL |
| `packages/ui/test/format.spec.test.ts` | ST-6, ST-7 | 03-02 formatLine |
| `packages/ui/test/keymap.spec.test.ts` | ST-8, ST-9 | 03-02 keymap |
| `packages/ui/test/editor.spec.test.ts` | ST-10…ST-14, ST-17, ST-18 | 03-02/03-03 view |
| `packages/ui/test/undo.spec.test.ts` | ST-15, ST-16 | 03-03 stack |
| `packages/ui/test/search.spec.test.ts` | ST-19, ST-20 | 03-03 search |
| `packages/ui/test/editor-dialogs.spec.test.ts` | ST-21 | 03-03 builders/boxes |
| `packages/ui/test/memo.spec.test.ts` | ST-22, ST-23 | 03-04 |
| `packages/ui/test/indicator.spec.test.ts` | ST-24, ST-25 | 03-04 |
| `packages/ui/test/edit-window.spec.test.ts` | ST-26, ST-27 (gadget half) | 03-04 |
| `packages/ui/test/window-seams.spec.test.ts` | ST-27 (seam half) | 03-04 PA-3/PA-19 |
| `packages/ui/test/ring.spec.test.ts` | ST-28 | 03-05 |
| `packages/ui/test/terminal.spec.test.ts` | ST-29 | 03-05 |
| `packages/files/test/fs-content.spec.test.ts` | ST-30 (seam half) | 03-06 PA-6 |
| `packages/files/test/file-editor.spec.test.ts` | ST-30, ST-31 | 03-06 |
| `packages/ui/test/editor-theme.spec.test.ts` | ST-32 | 03-07 |
| `packages/ui/test/editor.packaging.spec.test.ts` + files packaging | ST-33 | 03-07 |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (extended) | ST-34 | 03-07 |
| `packages/ui/test/editor-perf.spec.test.ts` | ST-35 | AC-20 (off-CI) |

### Implementation tests (after green)

`buffer.impl`, `format.impl`, `keymap.impl`, `editor.impl` (drag timing, prefix corners,
overwrite/wide edges, sync math, multi-click windows), `undo.impl` (coalesce boundaries,
eviction), `search.impl`, `memo.impl`, `indicator.impl`, `edit-window.impl`, `ring.impl`,
`terminal.impl`, `file-editor.impl` (backup cycles, rename failure) — per the 03-* Testing
Requirements. Priority: High for buffer/undo/editor, Med for the rest.

### Integration / E2E

| Test | Components | Description |
|------|-----------|-------------|
| `editor-demo.e2e.test.ts` | full ui family | The headless ASCII walkthrough runs + prints expected frames |
| `tvedit-demo.e2e.test.ts` | family + files + shell | Clone launches (child process), first-frame assertions |

## Test Data

- **Fixtures**: sample texts (mixed-EOL, tabs, wide/cluster-heavy, 1 MB generated), hostile-byte
  strings (the AC-17 set), a scripted `EditorDialogHandler` (records requests, plays answers).
- **Mocks**: none beyond the existing in-memory `FileSystem` and the injectable clock (PA-18) —
  real objects otherwise (house rule).

## Verification Checklist

- [ ] All ST cases concrete (input → expected) and source-traced
- [ ] Spec tests written BEFORE implementation; red phase verified per phase
- [ ] Green phase after implementation (fidelity conflicts resolved per the TV gate)
- [ ] Impl tests after green; `yarn verify` at every phase end (PA-12)
- [ ] No regressions: all shipped RD suites green (plan-local AC-1)
