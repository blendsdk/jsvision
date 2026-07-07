# Preflight Report: editor-family (RD-08 — Editor/Memo/EditWindow/Indicator/Terminal + FileEditor)

> **Status**: ✅ **PREFLIGHT PASSED — all 12 findings resolved & applied** (0 critical, 1 major, 8 minor, 3 observations; user accepted every recommendation in bulk 2026-07-06; **document fixes applied 2026-07-07** at the start of `exec_plan editor-family`)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/editor-family/` (12 docs, untracked; 99-execution-plan Last Updated 2026-07-06 20:50)
> **Codebase Grounded**: ~40 jsvision `file:line` claims verified across `packages/{ui,core,files,examples}` (25-claim recon agent + direct reads) · 27 Turbo Vision citation clusters re-verified against `/home/gevik/workdir/github/tvision` (dedicated recon agent) · 1 independent challenger on the MAJOR/borderline batch
> **Hardening**: challenger CONFIRMED PF-001 at MAJOR and PF-002 at MINOR; both recommendations adopted with the challenger's concretizations
> **Last Updated**: 2026-07-06

> ⚠️ **SAME-DAY REVIEW**: the plan was authored 2026-07-06 (same day, same model family; the
> authoring session was cleared before this audit). Bias risk is partially mitigated by the fresh
> context, two independent recon subagents, and the independent challenger — not eliminated.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM-only (NodeNext, strict), yarn 1.x + Turborepo, zero runtime deps, vitest spec/impl split, Node ≥ 20.
**Architecture:** `@jsvision/core` engine → `@jsvision/ui` (depends on core ONLY) → `@jsvision/files` (depends on core + ui) → examples. TV fidelity = NON-NEGOTIABLE decode directive (GATE-1/GATE-2).
**Key files examined:** ui `desktop/desktop.ts`, `window/window.ts`, `status/commands.ts`, `scroll/scroll-bar.ts`, `event/{event-loop,dispatch,hit-test,types}.ts`, `view/{view,render-root,types}.ts`, `tabs/tab-view.ts`, `controls/{input,input-editing}.ts`, `dialog/dialog.ts`; core `render/osc.ts`, `input/{events,mouse}.ts`, `color/theme.ts`; files `package.json`, `fs/types.ts`, `dialog/error-dialog.ts`, `openers.ts`, barrel; examples `package.json`, kitchen-sink `story.ts`/`stories/index.ts`; ui theme-guard specs; TV `edits.cpp`, `teditor1/2.cpp`, `editstat.cpp`, `tmemo.cpp`, `tindictr.cpp`, `teditwnd.cpp`, `tfiledtr.cpp`, `textview.cpp`, `ttprvlns.cpp`, `tscrolle.cpp`, `tvtext1.cpp`, `editors.h`, `views.h`, `app.h`, `dialogs.h`, `examples/tvedit/tvedit2/3.cpp`.
**Reference verification:** jsvision-side 24/25 clusters VERIFIED (deviations → PF-002, PF-008, PF-010). TV-side: **every substantive decode CONFIRMED** — all four palette byte chains (`0x1E`/`0x71`, `0x30`/`0x2F`, `0x1F`/`0x1A`, terminal `0x1E`) independently re-derived; the Indicator not-dragging→`═`(0xCD `dragFrame`)/dragging→`─`(0xC4 `normalFrame`) mapping confirmed exactly as pinned; triple-click confirmed implemented (magiblot `smTriple`, `teditor2.cpp:476-493`); `firstKeys` 41 entries re-read (Ctrl-N/Ctrl-W absent → the clone's app-keymap chords are conflict-free); all dialog/window rects, the `.bak` sequence, and the tvedit menu/status bindings verified. Anchor-level drifts → PF-009; two TV facts the plan missed → PF-005.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-007) | 🟡 |
| 3 | Logical Contradictions | 2 (PF-004, PF-006) | 🟡 |
| 4 | Completeness Gaps | 2 (PF-005, PF-012) | 🟡 |
| 5 | Dependency Issues | (PF-001 co-filed) | 🟠 |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 (PF-003) | 🟡 |
| 12 | Consistency | 2 (PF-009, PF-011) | 🟡 |
| 13 | Codebase Alignment | 4 (PF-001, PF-002, PF-008, PF-010) | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 1 | ✅ resolved & applied (2026-07-07) |
| 🟡 MINOR | 8 | ✅ all resolved & applied (2026-07-07) |
| 🔵 OBSERVATION | 3 | ✅ all resolved & applied (2026-07-07) |

---

## Findings

### PF-001: `EditWindow`'s `fs?: FileSystem` / "hosts a `FileEditor`" is a ui→files circular dependency 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Architecture Mismatch, Dependency Reality) + 5 — Dependency Issues
**Location:** `03-04-memo-indicator-editwindow.md` §edit-window.ts (`EditWindowOptions.fs?: FileSystem` — "presence ⇒ hosts a FileEditor (03-06)"); `03-06-file-editor.md` §Integration ("EditWindow (03-04) hosts a FileEditor when fs is provided"); `00-index.md` Quick Reference (`new EditWindow({ …, fs: nodeFileSystem })` + the import of an **unspecified** `openFileInEditor` from `@jsvision/files`).
**Codebase Evidence:** `packages/ui/package.json` deps = `@jsvision/core` only; `packages/files/package.json` deps = core + **ui**. `FileSystem` lives at `packages/files/src/fs/types.ts`; `FileEditor` is planned for `packages/files/src/editor/`. ui can neither import the `FileSystem` type nor construct a `FileEditor`; adding files to ui's deps would create a workspace cycle that breaks turbo's `^build` topological ordering (`turbo.json`). Additionally, ST-26 (`07-testing-strategy.md`) is a **ui** spec test asserting the `"Clipboard"` title case, and `03-07`'s tvedit demo needs "an EditWindow hosting the shared clipboard editor" — yet `EditWindowOptions` has no way to host a caller-supplied editor (TV does it via `editor == clipboard`, `teditwnd.cpp:70-78`).
**The Problem:** As specified, `edit-window.ts` cannot typecheck or build — Phase 7, Phase 9's integration, ST-26's Clipboard case, and the Phase-3 acceptance oracle (`demo:tvedit`) are all blocked on a composition mechanism the plan doesn't define. The `openFileInEditor` symbol in the usage example anticipates the right fix but is specified nowhere (not in 03-06's API, not in 03-07's export list).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **`editor?: Editor` on `EditWindowOptions`** (host a caller-supplied editor; default = construct a bare `Editor`); `@jsvision/files` ships the factory `openFileInEditor(host, opts)` (constructs `FileEditor` + `EditWindow({ editor })`, binds `fileEditor.fileName → win.title` with `?? 'Untitled'`); Clipboard title via TV's identity check `hostedEditor === options.clipboard ? 'Clipboard'` (`teditwnd.cpp:70-78`); drop `fs`/`fileName` from `EditWindowOptions`; specify `openFileInEditor` in 03-06 + add it to 03-07's files exports | No dependency cycle; TV-grounded (TV *always* news a TFileEditor inside TEditWindow, `teditwnd.cpp:58` — internal construction was already an extension, so injection is no less faithful); `FileEditor extends Editor` covers bare/file/clipboard uniformly; ST-26 stays a pure-ui test; title updates flow reactively with zero ui knowledge of files | 03-04/03-06/00-index/03-07 + ST-26 mechanics need a respec pass; a precedence rule is needed (supplied `editor` wins; `clipboard`/`editorDialog` options apply only to the default-constructed editor) |
| B | Move `EditWindow` to `@jsvision/files` | Sees both types; arguably file-bound in TV | Contradicts RD-08's ui placement, the ui export list, and ST-26/ST-27 in `packages/ui/test/`; drags blue-window chrome into files |
| C | files-side `FileEditWindow extends EditWindow` (template-method `createEditor()` seam) | No ui option change | Still needs a factory for the demos + the title bind; adds a cross-package protected inheritance seam for no gain over A |

**Recommendation:** Option A — with the four concretizations (editor-precedence rule; `fileName`→`title` bind in the files factory; the `editor === clipboard` title check citing `teditwnd.cpp:70-78`; `openFileInEditor` specified in 03-06 and exported in 03-07). Considered and dropped: a ui-local structural `FileSystem` duplicate — it still cannot construct a files class, so it fixes nothing.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED at MAJOR (not CRITICAL — the architecture survives; the fix is a contained respec), picked A and supplied the TV grounding + turbo-cycle evidence.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-002: `ExecHost` in ui `dialogs.ts` signatures is a files-package type ui cannot import 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Phantom Reference in ui)
**Location:** `03-03-undo-clipboard-search.md` §dialogs.ts — six exported signatures typed `host: ExecHost`; `03-07` §Packaging (no host type in the ui export list).
**Codebase Evidence:** `ExecHost` exists only in files — `packages/files/src/dialog/error-dialog.ts:18` (`{ loop: Pick<EventLoop,'execView'>; desktop: Pick<Desktop,'addWindow'|'removeWindow'> }`), exported at `files/src/index.ts:38`. Nothing equivalent exists in `packages/ui/src` (`ModalHost` at `event/types.ts:21` is the *inward* modal handle — `endModal` only — and cannot open dialogs; a bare `EventLoop` is insufficient because the shipped pattern is `desktop.addWindow(dlg)` → `execView` → `removeWindow` in `finally`, `error-dialog.ts:46-51` / `openers.ts:65-71`).
**The Problem:** As written, `packages/ui/src/editor/dialogs.ts` references an undeclared type. Additionally, `replacePrompt`'s PA-11 rect math needs the **desktop's height** (`size.y − height − 2`, `tvedit3.cpp:177-189`) — files' `Pick<Desktop, 'addWindow'|'removeWindow'>` shape exposes no extent, so a byte-copy of files' `ExecHost` is insufficient for that one builder.
**Resolution (single viable option):** Declare a ui-local host type in `dialogs.ts` — `{ loop: Pick<EventLoop,'execView'>; desktop: Pick<Desktop,'addWindow'|'removeWindow'|'bounds'> }` (or equivalent extent access) — export it from the ui barrel (add to 03-07's list), and place the prompt via `DialogOptions.rect` (explicit-rect placement is supported un-centered, `dialog.ts:42-44`). Do **not** re-alias files' `ExecHost` to the wider type (files' shipped tests pass minimal `{addWindow, removeWindow}` hosts); the `createApplication()` handle satisfies both structurally. (Considered and dropped: reusing `ModalHost` — wrong direction; bare `EventLoop` — cannot mount.)
**Confidence:** High. **Hardening:** challenger CONFIRMED at MINOR and contributed the desktop-extent + no-re-alias corrections adopted above.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-003: Phase 4's `attachGadgets(…, ind?: Indicator)` + ST-13 depend on the `Indicator` type built in Phase 7 🟡 MINOR

**Dimension:** 11 — Ordering & Sequencing
**Location:** `03-02-editor-view.md` §editor.ts (`attachGadgets(h?: ScrollBar, v?: ScrollBar, ind?: Indicator)`); `07-testing-strategy.md` ST-13 (`indicator.setValue(…)` asserted in `editor.spec`, Phase 4); `99-execution-plan.md` 4.2.3 vs 7.2.2.
**Codebase Evidence:** `ScrollBar` ships (RD-11, `scroll-bar.ts:131-136`) so the bar half compiles in Phase 4; `Indicator` (`src/editor/indicator.ts`) does not exist until task 7.2.2 — `editor.ts` cannot import its type in Phase 4, and ST-13 must go GREEN at 4.2.3.
**Resolution (single viable option):** Type the third parameter as a minimal structural target declared in 03-02 (e.g. `IndicatorTarget { setValue(pos: {line: number; col: number}, modified: boolean): void }`); `Indicator` satisfies it in Phase 7; ST-13's indicator assertions use a recording implementation of the interface (an interface seam, not a mock of a real object — consistent with the house scripted-seam pattern already used for `EditorDialogHandler`). (Considered and dropped: moving ST-13's indicator half to Phase 7 — it fragments the decoded `doUpdate` push oracle across files for no gain.)

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-004: `save`/`saveAs` command constants are owned twice — PA-15's `EditorCommands` vs 03-06's `FileCommands` 🟡 MINOR

**Dimension:** 3 — Logical Contradictions (cross-document)
**Location:** `00-ambiguity-register.md` PA-15 ("editor-package `EditorCommands.find/replace/searchAgain/save/saveAs`"); `03-06-file-editor.md` §commands.ts (`FileCommands = { save: 'save', saveAs: 'saveAs', open: 'open', new: 'new' }`).
**Codebase Evidence:** The registry keys commands by string (`ui/src/event/commands.ts`); two constants resolving to the same string are benign but confusing, and two constants resolving to *different* strings ("save" vs an editor-prefixed variant) would silently split the menu binding from the handler. Save/saveAs handling + greying is `TFileEditor`'s in TV (`tfiledtr.cpp:257-262` — `cmSave`/`cmSaveAs` enabled there, not in `TEditor`).
**The Problem:** The plan assigns the same two commands to both packages without reconciling them; an executor must guess the owner.
**Resolution (single viable option — an amendment, not a re-litigation of PA-15's split-surface decision):** `FileCommands` (files) owns `save`/`saveAs` — the TV decode places both in `TFileEditor`, and the fs-free ui `Editor` has no save behavior to bind; `EditorCommands` (ui) = `find`/`replace`/`searchAgain` only. Note the amendment on PA-15. (Considered and dropped: ui owning them with files re-exporting — inverts the decode's ownership.)

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-005: The `clear` action is missing — the decoded tvedit Edit menu needs it, and TV's `firstKeys` has a decode nuance the plan doesn't record 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-02-editor-view.md` §keymap.ts (`EditorAction` union — no `'clear'`) + §updateCommands decode (omits `cmClear`); `03-07-theme-packaging-demos.md` §tvedit menus ("~E~dit … Clear Ctrl-Del"); PA-15 (no clear in any command surface).
**Codebase Evidence:** TV `teditor2.cpp:633` — `setCmdState(cmClear, hasSelection())`; the tvedit Edit menu binds Clear→`cmClear` with `kbCtrlDel` (`examples/tvedit/tvedit3.cpp:57-60` region); **and** `firstKeys` (`teditor1.cpp:44-87`) lists `kbCtrlDel` **twice** — `cmDelWord` (entry 27) then `cmClear` (entry 41, dead: first match wins in `scanKeyMap`).
**The Problem:** The clone's Edit menu cannot be built as decoded — "Clear" has no action id, no command, and no greying entry in the plan. The `kbCtrlDel` duplicate also matters for the "transcribed 1:1" keymap table: a naive transcription would either drop an entry or invert the first-match precedence.
**Resolution (single viable option):** Add `'clear'` to `EditorAction` (deleteSelect semantics, `deleteSelect` decode) + a registry-level clear command for the menu (recommend reusing the existing pattern: an `EditorCommands.clear`), + the `cmClear` row in the updateCommands greying decode; document the `kbCtrlDel` first-match duplicate (Ctrl-Del → `delWord`; the menu reaches clear by command) and the RD-sanctioned Ctrl-P/`cmEncoding` omission in keymap.ts's decode JSDoc.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-006: `Terminal` claims PgUp scroll-back while declaring `focusable = false` 🟡 MINOR

**Dimension:** 3 — Logical Contradictions
**Location:** `03-05-terminal.md` §terminal.ts ("`focusable = false`" + "wheel/PgUp scroll-back within the ring (TScroller keys)").
**Codebase Evidence:** Key events reach only the focused chain (`dispatch.ts:13` — pre → focused → post); a non-focusable view never receives PgUp. Wheel is fine: mouse/wheel branch off to hit-test before the focus phases (`dispatch.ts:147-148`), reaching the view under the pointer regardless of focusability.
**The Problem:** One of the two claims must yield; as written the spec/impl tests would encode an unreachable behavior.
**Options:** (a) **Wheel-only scroll-back** — drop the PgUp claim (TV's `TTerminal` is a passive scroller; keyboard scrolling in TV comes from attached scrollbars our Terminal doesn't have); (b) make `Terminal` focusable — adds it to the Tab order of every host app for a log sink, un-TV-like.
**Recommendation:** (a) — matches the decode and the passive-sink role; ST-29 already tests auto-scroll, not PgUp.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-007: `BufText = { charAt, length }` is too narrow for cluster segmentation 🟡 MINOR

**Dimension:** 2 — Implicit Assumptions
**Location:** `03-01-buffer-core.md` §navigate.ts ("`BufText` is the minimal read interface (`GapBuffer` satisfies it) so oracles can run on plain strings").
**Codebase Evidence:** `segment.ts`'s primitives take a `string` (`nextClusterEnd(text: string, i)` — `Intl.Segmenter` segments strings); `nextChar`/`prevChar` need the cluster text around `p`. With only `charAt`, navigate would rebuild substrings one char at a time (O(line) per step, and awkward at buffer boundaries). `GapBuffer` already has `slice(from, to)`; plain strings have `slice` natively — so widening costs the oracles nothing.
**Resolution (single viable option):** Add `slice(from: number, to: number): string` to `BufText` and note that cluster steps operate on the line slice (`lineStart(p)…lineEnd(p)`), which also keeps `Intl.Segmenter` inputs line-bounded.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-008: The theme-guard extension instruction names only `LATER_ADDITIVE_ROLES` — `color-theme.spec` uses a different closed-set mechanism 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Test Impact)
**Location:** `00-ambiguity-register.md` PA-14; `03-07` §Theme ("every prior closed-set guard's `LATER_ADDITIVE_ROLES` allowlist is extended"); `99` task 1.2.1.
**Codebase Evidence:** `LATER_ADDITIVE_ROLES` exists in exactly three specs — `tabs-theme`, `feedback-theme`, `date-theme`. `color-theme.spec.test.ts:117-122` enforces its closed set via an **inline `knownKeys` Set** (`[...Object.keys(EXPECTED_UNCHANGED), 'colorMarker', 'fileInfo']`) and will fail on the 7 new roles; `table-theme` and files' `files-theme` have no closed-set guard (nothing to extend).
**The Problem:** An executor following the instruction literally greps for `LATER_ADDITIVE_ROLES`, extends three files, and hits an unexplained `color-theme` failure at task 1.3.1. The "grep the guards at exec time" hedge partially covers this, but the named mechanism is wrong for one of the four affected specs.
**Resolution (single viable option):** Amend PA-14/03-07/1.2.1 to name both mechanisms: extend `LATER_ADDITIVE_ROLES` in tabs/feedback/date **and** the inline `knownKeys` set in `color-theme.spec.test.ts:118`; note table/files-theme need nothing.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-009: TV citation-anchor pack — eight anchors drift from the verified source (facts all correct) 🟡 MINOR

**Dimension:** 12 — Consistency (fidelity-directive citation accuracy — anchors propagate into GATE-1 JSDoc)
**Location / Codebase Evidence (all verified in tvision):**
1. **`saveFile` + backup = `tfiledtr.cpp:180-219`**, not `147-167` (that range is `save()`/`saveAs()`) — appears in 03-06, register PA-6, task 9.2.2. Backup logic at `:186-193`.
2. **`doSearchReplace` = `teditor1.cpp:400-429`**; `teditor2.cpp:364-421` is `replace()` (364-375) + `scrollTo()` + `search()` (389-421) — 03-03's prose maps the ranges loosely.
3. **The `setParams` pushes are `teditor1.cpp:442,444`** (inside `doUpdate` 431-451); `502-512` is the `checkScrollBar` function — ST-13's "(decode `teditor1.cpp:502-512`)" anchor points at the wrong function.
4. **Word-hop classes = `getCharType`/`isWordBoundary` (`teditor2.cpp:45-59`)**; the function literally named `isWordChar` is `:61-64` and serves the *search* whole-words test — 03-01/03-03 conflate the names (behavior claims are right).
5. **TTerminal's oversized-write tail-trim is `textview.cpp:202-206`** (in `do_sputn`), not `:79-100` (bufDec/bufInc/canInsert).
6. **`tvedit2.cpp`/`tvedit3.cpp` live under `examples/tvedit/`**, not `source/tvision/`; the find/replace dialogs are at `tvedit2.cpp:55-112` (38-53 is `execDialog`).
7. **Replace-prompt trigger**: the decode is `pt->y <= makeGlobal(r.b).y + 1` (`tvedit3.cpp:184-186`) — the plan's "at/above the box bottom" is off by one row; the move delta is `size.y − r.b.y − 2` (the plan's "size.y − height − 2" is correct **as the destination top**, worth stating unambiguously since ST-21 pins this math).
8. **`TMemo` class = `editors.h:363-391`** (`:357-361` is the `TMemoData` struct).
Plus one decode nuance for PA-2's JSDoc: magiblot's `clipPaste` falls back to the **OS clipboard** when `clipboard == 0` (`teditor1.cpp:322-331`) — our no-op-paste default remains right (OSC-52 read is DEF-25; system paste arrives as bracketed `PasteEvent`), but the deviation should be recorded rather than citing the guards as "exactly TV's semantics".
**Resolution (single viable option):** Correct the anchors in the 03-* docs + register rows + ST-13/ST-21 sources so GATE-1 JSDoc inherits accurate citations (the RD-level PF-011 precedent).

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-010: `ev.getFocused()` is written non-optionally; the member is optional 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment (minor API-shape drift)
**Location:** `03-02` §Event routing ("`isWithin(ev.getFocused(), this)`"); same phrase in 01/00-index.
**Codebase Evidence:** `view/types.ts:158` — `getFocused?: () => View | null` (optional); the shipped TabView idiom reads `ev.getFocused?.() ?? null` (`tab-view.ts:320`).
**Suggestion:** Use the optional-chain form (or note it) so the transcription matches the shipped idiom.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-011: `editor-mouse.ts`/`editor-actions.ts` are conditional in 03-02 but unconditional tasks in 99 🔵 OBSERVATION

**Dimension:** 12 — Consistency
**Location:** `03-02` header ("+ `editor-mouse.ts` / `editor-actions.ts` splits **if** `editor.ts` would exceed 500 lines — expected") vs `99` tasks 4.2.1/4.2.2 (which name both files as deliverables).
**Suggestion:** Treat the split as decided (the 99 wording): an fs-free editor view with modes/mouse/gadget-sync will not fit 500 lines; aligning 03-02's header avoids a false degree of freedom.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

### PF-012: The tvedit clone's quit-with-modified sweep has no stated mechanism 🔵 OBSERVATION

**Dimension:** 4 — Completeness Gaps (demo-local)
**Location:** `03-06` §Integration ("the RD-04 quit path runs `valid('quit')` across open editors"); `03-07` §Error Handling ("Clone quit with modified buffers → `valid('quit')` sweep").
**Codebase Evidence:** `createApplication`'s hidden quit-command sink ends `run()` when `Commands.quit` fires; `valid()` is async (PA-17) — a handler racing the sink cannot await prompts.
**Suggestion:** Note in 03-07 that the clone binds Exit/Alt-X to a demo-local command (e.g. `'exitRequest'`) that awaits the `valid('quit')` sweep and only then emits `Commands.quit` — no new framework surface needed; this keeps the executor from reaching for a quit-veto seam.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk accept); **fix applied to the documents 2026-07-07**

---

## What was checked and found clean

- **The GATE-1 decode substance** (the plan's core value): all palette chains, the Indicator glyph/state mapping, `firstKeys`/`quickKeys`/`blockKeys` shape + prefix escapes, dialog and window rects, `.bak` sequence, ring semantics, `updateCommands`, `insertFrom` selection semantics (PA-16), gadget `sfActive→sfVisible` (PA-10), the replace-prompt geometry (destination), tvedit menu/status bindings — **verified against the C++, no substantive mis-decode**. The plan's PF-001 constraint (Ctrl-Q/K out of the app keymap) is honored by the clone design; Ctrl-N/Ctrl-W are absent from `firstKeys`, so the clone's app-keymap chords are conflict-free.
- **jsvision seam claims**: desktop gesture sites (3 set + exactly 2 clear), `window.ts:61/:174-190`, `commands.ts` (no undo/redo), `scroll-bar.ts:131-136`, `event-loop.ts:317`/`osc.ts:49-53`, `render-root.ts:207,255`, `view.ts:144`, `input.ts:248`, `fs/types.ts:41-68` (+ `dirname`/`join` present for `.bak`), no barrel export collisions, dispatch built-in Tab, no mouse click-count in core — all as the plan states.
- Task math (59 across 11 phases), ST↔AC coverage, phase dependency graph (incl. Phase 8's independence), security posture (sanitize-at-draw, seam-only fs, OSC-52 write-only, literal search), scope (Should-Haves = PA-4, nothing beyond RD-08), and the AR register's decisions were each swept — no findings beyond those listed.

## Verdict

# ✅ PREFLIGHT PASSED — all 12 findings resolved

No CRITICALs. The TV decode substance — the plan's core value — verified clean across all 27
citation clusters (all four palette byte chains re-derived; the Indicator `═`/`─` state mapping,
triple-click, `firstKeys`, dialog/window rects, `.bak` sequence, tvedit bindings all confirmed).
The one MAJOR (PF-001, the `EditWindow` ui→files circular dependency) was challenger-confirmed
and resolved per Option A (caller-supplied `editor?: Editor` + a files-side `openFileInEditor`
factory + the TV `editor === clipboard` title check). User accepted all 12 recommendations in
bulk (2026-07-06).

> ✅ **Fixes applied 2026-07-07** (at the start of `exec_plan editor-family`): all 12 findings
> written into the plan docs — PF-001 (03-04 `editor?: Editor` + 03-06 `openFileInEditor` +
> 00-index/03-07/ST-26), PF-002 (`EditorDialogHost` in 03-03 + 03-07 exports), PF-003
> (`IndicatorTarget` in 03-02 + ST-13), PF-004/PF-005 (PA-15 amendment + `'clear'` + the
> `kbCtrlDel` nuance), PF-006 (wheel-only Terminal), PF-007 (`BufText.slice`), PF-008 (PA-14
> both-mechanisms + task 1.2.1), PF-009 (all 8 anchors + the clipPaste nuance on PA-2),
> PF-010/PF-011/PF-012 (optional-chain idiom, splits decided, `'exitRequest'` quit sweep).
