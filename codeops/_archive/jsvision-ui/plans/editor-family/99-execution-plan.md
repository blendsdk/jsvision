# Execution Plan: Editor family

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-07 02:18
> **Progress**: 59/59 tasks (100%) — ✅ COMPLETE
> **CodeOps Skills Version**: 3.3.0

## Overview

Build the TV editor family — pure cores first (buffer → format/keymap), then the `Editor` view,
then undo/clipboard/search, then the composition components, `Terminal`, the `@jsvision/files`
`FileEditor`, and the showcase/demos — spec-first per phase (spec → RED → implement → GREEN →
impl tests → verify). All six components are TV decodes: **GATE-1 BEFORE-decode + GATE-2
AFTER-diff are mandatory** (`codeops/tv-fidelity-gate.md`). Cross-package edits are additive only
(7 theme roles PA-8; `Commands.undo/redo` PF-003; `Window.dragging/active` PA-3/PA-19;
4 `FileSystem` methods PA-6).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 1 | Cross-package seams + GATE-1 record + theme roles (spec-first) | 6 |
| 2 | Buffer core — gap/segment/navigate/EOL (spec-first) | 5 |
| 3 | `formatLine` + keymap (pure, spec-first) | 5 |
| 4 | `Editor` view (spec-first) | 6 |
| 5 | Undo/redo + clipboard (spec-first) | 5 |
| 6 | Search/replace + `editorDialog` + dialog builders (spec-first) | 5 |
| 7 | `Memo` + `Indicator` + `EditWindow` (spec-first) | 6 |
| 8 | `Terminal` (spec-first) | 5 |
| 9 | `FileEditor` + `FileSystem` additions (spec-first) | 5 |
| 10 | GATE-2 AFTER-diff + impl tests & hardening | 5 |
| 11 | Packaging, kitchen-sink stories, `demo:editor`, `demo:tvedit` | 6 |

**Total: 59 tasks across 11 phases** (no fabricated hour estimates — scope bounded by the
task-size criteria in the quality checklist).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for
> progress. Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last Updated
>    stamp after EVERY task — never batch updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed
>    first, else the first `[ ]` task.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.
> **TV-fidelity rule:** no TV-derived component task goes `[x]` until its Phase-10 AFTER-diff is
> done; on a spec-oracle/source conflict the oracle is the defect (cite the `.cpp`).

---

## Phase 1: Cross-package seams + GATE-1 record + theme roles (spec-first)

### Step 1.1: GATE-1 + spec tests
**Reference**: register PA-3/PA-8/PA-14/PA-19 · [03-04 §seams] · [07] ST-27/ST-32

- [x] 1.1.1 **BEFORE-decode (all six)** ✅ (completed: 2026-07-07 00:34 — dedicated recon re-verified all 17 fact clusters vs the C++ @ 57b6f56: ALL CONFIRMED; 3 anchor corrections folded into 03-02/03-03/03-04 (`scanKeyMap :117-167`, `kbCtrlDel` dead entry = 25 `:71`, `ef*` flags `editors.h:99-103`), the TV `cmPaste`-enabled-when-null-clipboard nuance recorded on the 03-02 updateCommands decode (PA-2 deviation), the tvedit Exit=`kbCtrlQ` + status-`kbAltF3` quirks + the `cpAppColor` color-mode caveat recorded in 03-07) — re-verify cell-by-cell vs the `.cpp` and finalize the decodes recorded in `03-01`…`03-07`: `TEditor` (formatLine/draw/keymap/selection/sync — `edits.cpp`, `teditor1/2.cpp`), `TMemo` (`tmemo.cpp`), `TIndicator` (`tindictr.cpp`), `TEditWindow` (`teditwnd.cpp`), `TFileEditor` (`tfiledtr.cpp`), `TTerminal` (`textview.cpp`) + every `getColor(N)` chain to its `0xHL` byte (PA-8); note mode-gated features — `03-*` docs
- [x] 1.1.2 Write `packages/ui/test/editor-theme.spec.test.ts` (ST-32) + `packages/ui/test/window-seams.spec.test.ts` (ST-27 seam half). Run — **RED** ✅ (completed: 2026-07-07 00:34 — window-seams 6/6 RED (dragging/active/Commands.undo absent); editor-theme 2/3 RED (roles absent), the inventory case passes pre-impl BY DESIGN: it asserts the pre-RD-08 role set unchanged, true before the additive edit — the justified pre-pass)

### Step 1.2: Implementation
- [x] 1.2.1 ✅ (completed: 2026-07-07 00:37 — editor-theme 3/3 GREEN; tabs/feedback/date/color guards 12/12 green via the extended allowlists) Add the 7 additive roles to `packages/core/src/engine/color/theme.ts` (+ banner, `PALETTE.*` decodes, byte comments) and extend every prior closed-set guard — BOTH mechanisms (PA-14/PF-008): `LATER_ADDITIVE_ROLES` in `tabs-theme`/`feedback-theme`/`date-theme` AND the inline `knownKeys` Set in `color-theme.spec.test.ts:118` (table/files-theme: nothing) — `theme.ts`, `packages/ui/test/*-theme.spec.test.ts`
- [x] 1.2.2 ✅ (completed: 2026-07-07 00:42 — window-seams 6/6 GREEN) Add `Commands.undo`/`Commands.redo` (`status/commands.ts`, PF-003) + `Window.dragging`/`Window.active` signals (`window/window.ts`, PA-3/PA-19) + the Desktop writes at begin*/both clear sites/raise-focus (`desktop/desktop.ts`) — run seam spec **GREEN**

### Step 1.3: Hardening
- [x] 1.3.1 ✅ (completed: 2026-07-07 00:43 — full turbo test sweep green: ui 1129 / 189 files, core + files + examples all passing; only the sanctioned guard-allowlist extensions changed) Run ALL shipped ui/files/core suites — green unchanged except the sanctioned allowlist extensions (plan-local AC-1)
- [x] 1.3.2 ✅ (completed: 2026-07-07 00:43 — `yarn verify` 11/11 tasks, exit 0) `yarn verify`

**Deliverables**: decodes finalized; roles byte-frozen; seams live; zero regressions.
**Verify**: `yarn verify`

---

## Phase 2: Buffer core (spec-first)

### Step 2.1: Specification tests
- [x] 2.1.1 ✅ (completed: 2026-07-07 00:50 — both specs RED via missing-module collection failure, the standard new-module red) Write `packages/ui/test/buffer.spec.test.ts` (ST-1…ST-4) + `eol.spec.test.ts` (ST-5) from [07]. Run — **RED**

### Step 2.2: Implementation
- [x] 2.2.1 ✅ (completed: 2026-07-07 00:53) Implement `src/editor/buffer/segment.ts` (PA-5, `Intl.Segmenter`, lone-surrogate-safe) + `gap.ts` (`GapBuffer`, the `bufPtr` decode JSDoc) — [03-01]
- [x] 2.2.2 ✅ (completed: 2026-07-07 00:53 — buffer+eol specs 13/13 GREEN; one fidelity-gate oracle fix recorded: `prevLine` mid-line = current line's start per `teditor2.cpp:332-335`) Implement `buffer/navigate.ts` (lineStart/End, next/prevChar CRLF+cluster-atomic, word hops `teditor2.cpp:45-59`, lineMove, charPos/charPtr tab+width math) + `eol.ts` (detect/convert, AR-252) + `buffer/index.ts` — run **GREEN**

### Step 2.3: Impl tests & hardening
- [x] 2.3.1 ✅ (completed: 2026-07-07 00:55 — 8/8: seeded gap stress vs a string reference model, gap-position charAt/slice, amortized typing/backspace, reversed/clamped bounds, CR-only nav+detect+lineMove, tab-boundary charPtr(charPos) round-trips, 6-fixture hostile-UTF-8 totality/progress sweep, ZWJ cluster-start walk) Write `buffer.impl.test.ts` (gap stress, CR-only, hostile-UTF-8 sweeps per RD-13 HR-01)
- [x] 2.3.2 ✅ (completed: 2026-07-07 00:57 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: the XL pure core spec-green, hostile-input-safe. **Verify**: `yarn verify`

---

## Phase 3: `formatLine` + keymap (pure, spec-first)

### Step 3.1: Specification tests
- [x] 3.1.1 ✅ (completed: 2026-07-07 01:04 — both RED via missing-module collection failure) Write `packages/ui/test/format.spec.test.ts` (ST-6/ST-7) + `keymap.spec.test.ts` (ST-8/ST-9). Run — **RED**

### Step 3.2: Implementation
- [x] 3.2.1 ✅ (completed: 2026-07-07 01:10 — one boundary fix during green: a C0/DEL steps as ONE column, mirroring `ScreenBuffer.set` HR-05's one-char-one-cell sanitize, never a zero-width fold) Implement `src/editor/format.ts` (`formatLine` — selection split, tab stops, h-scroll space rendering, EOL padding; decode JSDoc `edits.cpp:31-92`) — [03-02]
- [x] 3.2.2 ✅ (completed: 2026-07-07 01:10 — format+keymap specs 11/11 GREEN) Implement `src/editor/keymap.ts` (the 3 tables transcribed 1:1 with per-entry cites `teditor1.cpp:44-111`; `resolveKey` + `KeyState`; PA-15 action ids) — run **GREEN**

### Step 3.3: Impl tests & hardening
- [x] 3.3.1 ✅ (completed: 2026-07-07 01:14 — 14/14: boundary/stacked tabs, hScroll-past-EOL, width 0, whole-row selection, right-edge wide straddle, combining fold + lone-mark degenerate, C0 one-column rule, mid-buffer line isolation; shift-transparent motions, modifier exactness, shift-exact Ins/Del codes, prefix-with-special-key, ctrl-held/uppercase follow-ups, prefix-in-prefix, the Ctrl-P omission) Write `format.impl.test.ts` + `keymap.impl.test.ts` (boundary tabs, modifier corners)
- [x] 3.3.2 ✅ (completed: 2026-07-07 01:15 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: renderer + keymap spec-green, decode-cited. **Verify**: `yarn verify`

---

## Phase 4: `Editor` view (spec-first)

### Step 4.1: Specification tests
- [x] 4.1.1 ✅ (completed: 2026-07-07 01:30 — RED via missing-module collection failure) Write `packages/ui/test/editor.spec.test.ts` (ST-10…ST-14). Run — **RED**

### Step 4.2: Implementation
- [x] 4.2.1 ✅ (completed: 2026-07-07 01:55 — also landed `editor-dialog.ts` early: the 03-03 seam types + `defaultEditorDialog`, needed by ST-14's find flow; a mechanical phase-ordering split noted in the file) Implement `src/editor/editor.ts` core — buffer/EOL/signals, draw (`size.y` lines from the drawPtr anchor, PA-9), typing/modes (overwrite/autoIndent), `desiredCaret` (PF-004), `execute()` + `editor-actions.ts` (PA-15) — [03-02]
- [x] 4.2.2 ✅ (completed: 2026-07-07 01:55) Implement `editor-mouse.ts` — TV drag model + capture auto-scroll + PA-18 multi-click (injectable clock), wheel
- [x] 4.2.3 ✅ (completed: 2026-07-07 01:55 — editor.spec 9/9 GREEN; the greying seam realized as the optional `EditorOptions.commands: EditorCommandSeam` — the `DesktopLoopSeam` idiom, default no-op; the value channel = the shared `Editor.delta` signals per the scroll-bar.ts:131-136 shared-signal design) Implement `attachGadgets` sync (the decoded `setRange`/`setValue` pushes + bar write-back) + command handling/greying (`updateCommands` decode, PA-4) + the scoped `preProcess` prefix claim (PF-001) — run **GREEN**

### Step 4.3: Impl tests & hardening
- [x] 4.3.1 ✅ (completed: 2026-07-07 02:02 — 12/12: click-window boundary/cycle/cell-reset, wide-cluster overwrite, prefix-recovery typing, the 5 deletion actions, persistent select arm/collapse, click clamp, wheel ±3 clamped, paste EOL conversion, off-view caret null, hostile scrollTo) Write `editor.impl.test.ts` (drag timing, prefix corners, overwrite at EOL/wide, sync math, click windows)
- [x] 4.3.2 ✅ (completed: 2026-07-07 02:03 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: a working fs-free `Editor` spec-green. **Verify**: `yarn verify`

---

## Phase 5: Undo/redo + clipboard (spec-first)

### Step 5.1: Specification tests
- [x] 5.1.1 ✅ (completed: 2026-07-07 02:18 — the 5 new cases RED, all Phase-4 cases green) Write `packages/ui/test/undo.spec.test.ts` (ST-15/ST-16) + the ST-17/ST-18 clipboard cases in `editor.spec.test.ts`. Run — **RED**

### Step 5.2: Implementation
- [x] 5.2.1 ✅ (completed: 2026-07-07 02:18 — record/coalesce/seal/clear + whole-step eviction; insertRaw records every mutation, typeText + backSpace/delChar arm coalescing, setSelect seals on caret moves, setText clears the stack) Implement `src/editor/undo.ts` (`UndoStack` — record/coalesce/seal, depth 1000 PA-1, whole-step eviction) + wire every buffer mutation in `editor.ts` — [03-03]
- [x] 5.2.2 ✅ (completed: 2026-07-07 02:18 — undo+editor specs 26/26 GREEN incl. all Phase-4 cases; copy fills the clipboard editor selected (PA-16) + ONE OSC-52 via the envelope sink; cut = copy+one-step delete; paste = the clipboard's selection, no-op with none injected (PA-2)) Implement clipboard ops (PA-2 injectable seam, PA-16 selection semantics, `ev.setClipboard` OSC mirror, bracketed paste = one step) — run **GREEN**

### Step 5.3: Impl tests & hardening
- [x] 5.3.1 ✅ (completed: 2026-07-07 02:18 — 9/9: insert/delete never merge, non-contiguous splits, backspace-left/forward-delete-right runs, seal + eviction order, coalesce clears redo, the 3-step type→backspace→type round-trip (one merge-rule fix: an insert never extends a PURE-DELETE step — direction changes split), delWord whole-step, setText clears history, overwrite undo restores the wide cluster) Write `undo.impl.test.ts` (coalescing boundaries, eviction order, redo-clear)
- [x] 5.3.2 ✅ (completed: 2026-07-07 02:18 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: AC-5/AC-6 green. **Verify**: `yarn verify`

---

## Phase 6: Search/replace + `editorDialog` + dialog builders (spec-first)

### Step 6.1: Specification tests
- [x] 6.1.1 ✅ (completed: 2026-07-07 02:18 — search 7/7 RED behaviorally, dialogs RED via missing module) Write `packages/ui/test/search.spec.test.ts` (ST-19/ST-20) + `editor-dialogs.spec.test.ts` (ST-21). Run — **RED**

### Step 6.2: Implementation
- [x] 6.2.1 ✅ (completed: 2026-07-07 02:18 — scan/iScan + the search-side `isWordChar` (`teditor2.cpp:61-64` quirk: tabs/newlines count as word chars); `find`/`replace`/`searchAgain`/`searchOnce`/`doSearchReplace` async on the editor, count returned per PF-009, empty-needle no-round-trip guard; the 03-03 `replaceRange` helper subsumed by the count-returning `doSearchReplace` — a mechanical simplification) Implement `src/editor/search.ts` (scan/iScan + `isWordChar` decode) + the seam types + `defaultEditorDialog` (PA-17) + `doSearchReplace` in `editor.ts` (prompt/replace-all, PF-009 count) — [03-03]
- [x] 6.2.2 ✅ (completed: 2026-07-07 02:18 — specs 22/22 GREEN incl. the editor regression; the TV rects verbatim over `padding:0` (the files double-inset convention); History dropdowns at the decoded rects; "Replace this occurence?" kept literally (TV's typo)) Implement `src/editor/dialogs.ts` — the ui-local `EditorDialogHost` type (PF-002), `findDialog` 38×12 / `replaceDialog` 40×16 (decode `examples/tvedit/tvedit2.cpp:55-112`, PF-009), `confirmBox`/`infoBox` (PA-7), `replacePrompt` (PA-11 rect math via `DialogOptions.rect`), `wireEditorDialogs` — run **GREEN**

### Step 6.3: Impl tests & hardening
- [x] 6.3.1 ✅ (completed: 2026-07-07 02:18 — 6/6: scan clamps/cases, the isWordChar quirk, empty-needle no-round-trip, overlap advance, seam rejection leaves the buffer untouched, zero-hit replace-all suppresses searchFailed) Write `search.impl.test.ts` (empty needle, overlapping hits, seam rejection)
- [x] 6.3.2 ✅ (completed: 2026-07-07 02:18 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: AC-8/AC-9 green; the seam fully usable. **Verify**: `yarn verify`

---

## Phase 7: `Memo` + `Indicator` + `EditWindow` (spec-first)

### Step 7.1: Specification tests
- [x] 7.1.1 ✅ (completed: 2026-07-07 02:18 — all three RED via missing modules) Write `packages/ui/test/memo.spec.test.ts` (ST-22/ST-23) + `indicator.spec.test.ts` (ST-24/ST-25) + `edit-window.spec.test.ts` (ST-26 + ST-27 gadget half). Run — **RED**

### Step 7.2: Implementation
- [x] 7.2.1 ✅ (completed: 2026-07-07 02:18) Implement `src/editor/memo.ts` (two-way `Signal<string>` with feedback guard, Tab pass-through, memo roles) — [03-04]
- [x] 7.2.2 ✅ (completed: 2026-07-07 02:18 — the drag signal duck-typed off the window ancestor, no `editor/`→`window/` import; ☼ is EAW-ambiguous → spans 2 cells under core wcwidth, a recorded deviation in the JSDoc per the fidelity directive's ambiguous-width note) Implement `src/editor/indicator.ts` (═/─ drag swap via `window.dragging`, `☼` marker, colon-at-8 layout, `setValue`)
- [x] 7.2.3 ✅ (completed: 2026-07-07 02:18 — specs 11/11 GREEN; padding:0 + verbatim TV rects, `layoutGadgets` re-pin at mount/onResized/zoom (the files wfGrow idiom), the PF-001 `editor?: Editor` + identity-check title, gadget visibility bound to the PA-19 `active` signal) Implement `src/editor/edit-window.ts` (decoded rects PF-006, min 24×6, tileable, gadget visibility ← `active` PA-10/PA-19, titles PF-013, `attachGadgets` wiring) — run **GREEN**

### Step 7.3: Impl tests & hardening
- [x] 7.3.1 ✅ (completed: 2026-07-07 02:18 — edit-window.impl 4/4: zoom re-pin round-trip, manager-less indicator, the memo 20-cycle feedback-guard stress, PF-001 precedence; drag set/clear sites + title switching already oracle-covered by window-seams + edit-window specs) Write `memo.impl` + `indicator.impl` + `edit-window.impl` (reflow, re-activate, title switches)
- [x] 7.3.2 ✅ (completed: 2026-07-07 02:18 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: AC-10/AC-11/AC-12 green. **Verify**: `yarn verify`

---

## Phase 8: `Terminal` (spec-first)

### Step 8.1: Specification tests
- [x] 8.1.1 ✅ (completed: 2026-07-07 02:18 — both RED via missing modules) Write `packages/ui/test/ring.spec.test.ts` (ST-28) + `terminal.spec.test.ts` (ST-29). Run — **RED**

### Step 8.2: Implementation
- [x] 8.2.1 ✅ (completed: 2026-07-07 02:18 — the byte queue realized as a line array + code-unit total, same observable semantics; exact-fill allowed per TV `canInsert`) Implement `src/terminal/ring.ts` (`LineRing` — code-unit cap PF-007, whole-line eviction, tail-truncate; decode JSDoc `textview.cpp:79-100` + the `do_sputn` tail-trim `:202-206`, PF-009) — [03-05]
- [x] 8.2.2 ✅ (completed: 2026-07-07 02:18 — specs 9/9 GREEN; wheel-only scroll-back per PF-006, write snaps to bottom) Implement `src/terminal/terminal.ts` (auto-scroll draw, scroll-back + snap, `terminalNormal`, sanitize) + `terminalWriter` (PA-4) + `terminal/index.ts` — run **GREEN**

### Step 8.3: Impl tests & hardening
- [x] 8.3.1 ✅ (completed: 2026-07-07 02:18 — ring.impl 6/6: multi-line eviction incl. the exact-fill boundary, CRLF verbatim lines, open-tail joins, capacity-0 clamp, wheel clamp both ends, terminalWriter) Write `ring.impl` + `terminal.impl` (multi-line eviction, CRLF writes, `writeLine('')`)
- [x] 8.3.2 ✅ (completed: 2026-07-07 02:18 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: AC-14 green. **Verify**: `yarn verify`

---

## Phase 9: `FileEditor` + `FileSystem` additions (spec-first)

### Step 9.1: Specification tests
- [x] 9.1.1 ✅ (completed: 2026-07-07 02:18 — RED: nodeFileSystem shape case + the missing FileEditor module; the memory-fs helper gained content backing as test infrastructure) Write `packages/files/test/fs-content.spec.test.ts` + `file-editor.spec.test.ts` (ST-30/ST-31, in-memory fs + scripted seam). Run — **RED**

### Step 9.2: Implementation
- [x] 9.2.1 ✅ (completed: 2026-07-07 02:18) Add `readFile`/`writeFile`/`rename`/`unlink` to `fs/types.ts` + `node-fs.ts` + `test/helpers/memory-fs.ts` (PA-6) — [03-06]
- [x] 9.2.2 ✅ (completed: 2026-07-07 02:18 — specs 10/10 GREEN; the backup name REPLACES the extension per the `fnmerge` decode; ALSO landed the RD-08 ui-barrel editor/terminal re-exports early — files imports `@jsvision/ui` by name, so the surface had to exist; task 11.2 verifies/completes packaging) Implement `src/editor/file-editor.ts` (loadFile missing⇒empty, the backup sequence `tfiledtr.cpp:180-219`/`:186-193` PF-009, save/saveAs via the seam, `valid()` state machine, AR-258 defaults) + the `openFileInEditor` factory (PF-001, [03-06]) + `commands.ts` + `editor/index.ts` — run **GREEN**

### Step 9.3: Impl tests & hardening
- [x] 9.3.1 ✅ (completed: 2026-07-07 02:18 — 6/6: backup-of-backup, extension-less `.bak`, saveAs-to-existing, writeError seam routing, CRLF round-trip through save, the openFileInEditor title bind) Write `file-editor.impl.test.ts` (backup cycles, rename failure, EOL round-trip through save)
- [x] 9.3.2 ✅ (completed: 2026-07-07 02:18 — `yarn verify` 11/11, exit 0) `yarn verify`

**Deliverables**: AC-13 green, disk-free. **Verify**: `yarn verify`

---

## Phase 10: GATE-2 AFTER-diff + impl tests & hardening

- [x] 10.1 ✅ (completed: 2026-07-07 02:18 — composite headless render dump diffed against every decode: editor rows/selection/tab-to-8/h-scroll, EditWindow frame `╔═[×]═ Untitled ═[↑]═╗` + all three gadget rects + `└─`/`─┘` grips, Terminal bottom-anchor, Memo gray pair; verdicts recorded in each component's JSDoc; recorded deviations: ☼ EAW two-cell (indicator), PA-2 paste-greying, shift-click decoder gap) **AFTER-diff (all six)** — render each component and diff glyphs/columns/hit-zones/colours against its decode cell-by-cell; fix deviations against the source; record resolved bytes in code JSDoc + commit — component JSDoc/commit
- [x] 10.2 ✅ (completed: 2026-07-07 02:18 — `editor-hardening.impl` 4/4: the AC-17 fixture through editor draw + Memo + Indicator + a 200-key hostile-UTF-8 loop fuzz; one REAL defect found & fixed at the gate: formatLine counted a C0 as one column while `DrawContext.text`'s sanitize DROPPED it, shifting every later cell — formatLine now emits controls as spaces so column math matches the write boundary) Hostile-content hardening sweep (AC-17): the escape/C0 fixture through editor draw, terminal writes, indicator/memo — buffer-level inert; plus hostile-UTF-8 navigation fuzz
- [x] 10.3 ✅ (completed: 2026-07-07 02:18 — ST-35 at the 80×24 dev-box frame; the estimator is the MIN of 15 warmed runs (contention-robust under the parallel vitest suite); logs-only under `CI`/`TUI_SKIP_PERF`) Write `packages/ui/test/editor-perf.spec.test.ts` (ST-35 — 1 MB insert/redraw/cursor < 16 ms off-CI, skip under `CI`/`TUI_SKIP_PERF`)
- [x] 10.4 ✅ (completed: 2026-07-07 02:18 — all [07] impl concerns covered; memo/indicator cases live in `edit-window.impl`, terminal cases in `ring.impl` — a file-naming consolidation, every listed behavior tested) Complete any remaining `*.impl.test.ts` from [07 §Implementation tests]
- [x] 10.5 ✅ (completed: 2026-07-07 02:18 — `yarn verify` 11/11, exit 0; ui 1262 tests) `yarn verify` + the full shipped-suite regression run

**Deliverables**: GATE-2 recorded for all six; AC-16/AC-17/AC-20 green. **Verify**: `yarn verify`

---

## Phase 11: Packaging, kitchen-sink stories, `demo:editor`, `demo:tvedit`

- [x] 11.1 ✅ (completed: 2026-07-07 02:18 — the ≤500 case went RED first (`editor.ts` had grown to 818) and forced the PF-011 splits: `editor-search.ts`/`editor-clipboard.ts`/`editor-draw.ts`/`editor-events.ts`/`editor-types.ts`, every editor suite re-verified green after each cut; exports were pre-passing by design since Phase 9) Write `packages/ui/test/editor.packaging.spec.test.ts` + the files packaging additions (ST-33). Run — **RED**
- [x] 11.2 ✅ (completed: 2026-07-07 02:18 — packaging 4/4 + the files-side case GREEN; internals (GapBuffer/LineRing/formatLine/resolveKey/UndoStack/scan) verified absent from the barrel) Complete the explicit named re-exports in `packages/ui/src/index.ts` + `packages/files/src/index.ts` per [03-07 §Packaging] — run **GREEN**
- [x] 11.3 ✅ (completed: 2026-07-07 02:18 — `editor/editor`, `editor/memo`, `editor/terminal` registered; smoke 41/41) Kitchen-sink stories (+ smoke, ST-34): `stories/{editor,memo,terminal}.story.ts` (ids `editor/*`, category `Editor`, `rd:'RD-08'`, canvas-fit scenes) + registry lines — `packages/examples/kitchen-sink/stories/`
- [x] 11.4 ✅ (completed: 2026-07-07 02:18 — the 9-step narrated walkthrough: load→type→double-click word→cut/paste via the clipboard editor→undo/redo→find→replace-all count; e2e asserts each narration line) `demo:editor` — `editor-demo/main.ts` (ASCII walkthrough per [03-07]) + script + `test/editor-demo.e2e.test.ts`
- [x] 11.5 ✅ (completed: 2026-07-07 02:18 — the live clone with the decoded menus/status/keymap (never Ctrl-Q/K, PF-001), `openFileInEditor` windows (the factory gained an optional pre-mount `rect`), the Clipboard window, `wireEditorDialogs`+`FileDialog` saveAs hook, the PF-012 `exitRequest` quit sweep; headless = one first frame for the e2e, showing the PA-10 gadget-hide on the inactive Clipboard window live) `demo:tvedit` — `tvedit-demo/main.ts` + script + `test/tvedit-demo.e2e.test.ts`
- [x] 11.6 ✅ (completed: 2026-07-07 02:18 — `yarn verify` 11/11 (ui 1266 · core 600 · files 145 · examples 90); examples `test:e2e` 18/18 incl. the two new demos; `lint` + `check:deps` clean) `yarn verify` + `yarn workspace @jsvision/examples test:e2e`

**Deliverables**: AC-18/AC-19 green — RD-08 complete. **Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (seams/theme/GATE-1)
    ↓
Phase 2 (buffer) → Phase 3 (format/keymap) → Phase 4 (Editor view)
    ↓ (4 required by all below)
Phase 5 (undo/clipboard) → Phase 6 (search/dialogs)
    ↓
Phase 7 (Memo/Indicator/EditWindow)   Phase 8 (Terminal — independent of 5-7, needs 1 only)
    ↓
Phase 9 (FileEditor — needs 6 seam + 7 EditWindow)
    ↓
Phase 10 (GATE-2 + hardening) → Phase 11 (packaging/showcase/demos)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed; all ST oracles green (ST-1…ST-35 ↔ AC-1…AC-20)
2. ✅ `yarn verify` green; no warnings/errors; all shipped RD suites unchanged (plan AC-1)
3. ✅ GATE-2 AFTER-diff recorded for all six TV-derived components
4. ✅ No dead code; files ≤ 500 lines; zero runtime deps (`check:deps`)
5. ✅ Security hardened — sanitize at every draw, seam-only fs paths, no OSC-52 read
6. ✅ Stories + demos shipped (`kitchen-sink-gate.md` satisfied); docs/roadmap updated
7. ✅ Post-completion project re-analysis (exec_plan skill)
