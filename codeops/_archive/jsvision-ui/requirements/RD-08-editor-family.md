# RD-08: Editor family — Editor/Memo/EditWindow/Indicator/Terminal (decode-first from `teditor1.cpp`/`teditor2.cpp`/`edits.cpp`)

> **Document**: RD-08-editor-family.md
> **Status**: Draft
> **Created**: 2026-07-06 (`make_requirements` — the component-map **Phase 3 — Heavy** slice)
> **Project**: jsvision UI (`@jsvision/ui` `src/editor/` + `src/terminal/`; the `FileEditor` fs-binding in `@jsvision/files`)
> **Depends On**: RD-05 (App shell — done; `Window`/`Desktop`/menus/status the `EditWindow` + `tvedit` clone compose), RD-11 (Containers — done; `ScrollBar` the editor syncs, `Dialog` + button helpers the find/replace dialogs compose), RD-06/RD-07 (Essential controls + completions — done; `Input`/`Label`/`Button`/`CheckGroup`, the OSC-52 clipboard **write** + bracketed paste + the `View.desiredCaret()` hardware-caret seam), RD-04 (Event loop — done; commands/keymap/focus/`setCapture`), RD-01/RD-02/RD-03 (reactive core, layout, view spine — done), RD-09 (`@jsvision/files` — done; the injectable `FileSystem` seam + `FileDialog` the `FileEditor`/`tvedit` clone use), `@jsvision/core` (done; `sanitize`, width engine, `Theme`/`defaultTheme`, cursor).
> **Set**: **Phase 3 — Heavy** (component map §8 "Editors & text views" — the last unstarted RD; demo target: *clone `tvedit`*). The XL risk item the map flags as "as big as the rest combined" — planned as a self-contained module.
> **CodeOps Skills Version**: 3.3.0

---

## Feature Overview

The Turbo Vision **editor family**: a gap-buffer multiline text `Editor` with selection, clipboard,
search/replace, undo, and scrollbar/indicator integration; the dialog-embeddable `Memo`; the
`EditWindow` chrome (editor + `Indicator` + scrollbars in a tileable window); the `line:col`
`Indicator`; and the `Terminal` streaming log sink. The editor **core is fs-free** and lives in
`@jsvision/ui`; the file binding (`FileEditor` — load/save/save-prompts/backups) ships in
**`@jsvision/files`** over its RD-09 `FileSystem` seam *(AR-249)*.

**GATE-1 fidelity finding (`magiblot/tvision`).** Turbo Vision has **every** class in this family to
decode — so per the **NON-NEGOTIABLE TV-fidelity directive** the drawing/geometry/glyphs/colour of
each is a **decode**, not a design (re-verified cell-by-cell at plan GATE-1/GATE-2):

| Reimagined | TV class | Declared | Implemented |
|-----------|----------|----------|-------------|
| `Editor` | `TEditor : TView` | `editors.h:219-353` | `teditor1.cpp`/`teditor2.cpp`/`edits.cpp`/`editstat.cpp` |
| `Memo` | `TMemo : TEditor` | `editors.h:357-395` | `tmemo.cpp:27-98` |
| `EditWindow` | `TEditWindow : TWindow` | `editors.h:478-517` | `teditwnd.cpp:29-95` |
| `Indicator` | `TIndicator : TView` | `editors.h:118-160` | `tindictr.cpp:27-88` |
| `FileEditor` (in `@jsvision/files`) | `TFileEditor : TEditor` | `editors.h:424-474` | `tfiledtr.cpp:48-319` |
| `Terminal` | `TTerminal : TScroller` (+ `TTextDevice`) | `textview.h:37-95` | `textview.cpp:35-250`, `ttprvlns.cpp:18-47` |

**Decoded facts (to be re-verified at plan GATE-1/GATE-2):**

| Piece | TV decode | `file:line` |
|-------|-----------|-------------|
| Gap buffer | `bufPtr(P) = P < curPtr ? P : P + gapLen`; gap sits at the cursor, moved by `memmove` in `setSelect`; text loads at the buffer **end** (gap at front), `gapLen = bufSize − length` | `edits.cpp:21-29`, `teditor2.cpp:423-442,513-532` |
| Navigation | `lineStart`/`lineEnd` scan for `\r`/`\n` CRLF-aware; `nextChar`/`prevChar` cluster-aware + CRLF-atomic; `nextLine = nextChar(lineEnd(P))`; `lineMove` preserves the visual column via `charPos`/`charPtr`; word hops via char-class boundaries | `edits.cpp:94-159`, `teditor2.cpp:270-352`, `teditor1.cpp:239-295` |
| `formatLine` (the row renderer) | per-char selection colour: `selStart ≤ P < selEnd` → the high attr, else low; tabs expand `pos = (pos\|7)+1` (8-col stops); h-scroll: chars left of `hScroll` skipped, a partially-scrolled tab/wide char renders as spaces; stops at `\r`/`\n`; pads the rest of the row with the trailing colour | `edits.cpp:31-92` (the tab math lives in `nextCharAndPos`, `teditor1.cpp:255`, which `formatLine` calls) |
| `Editor` palette | `cpEditor "\x06\x07"` (1 = normal, 2 = selected) → window palette 6/7 → `wpBlueWindow` `cpBlueWindow "\x08…\x0F"` → `cpAppColor`: **normal `0x1E`** (yellow-on-blue), **selected `0x71`** (blue-on-lightGray) | `teditor1.cpp:171,466,496-500` (the `cpEditor` `#define` + `getPalette`; `cpMemo` = `tmemo.cpp:27`, `cpIndicator` = `tindictr.cpp:27`; `editors.h:180-181` is the palette-layout comment only), `views.h:955`, `app.h:142-151` |
| Selection & mouse | `[selStart, selEnd)` with `curPtr` the moving anchor; Shift/`selecting` → extend; double-click snaps to words, triple-click to lines (`smDouble`/`smTriple`); drag auto-scrolls at edges; wheel scrolls | `teditor2.cpp:459-539`, `teditor1.cpp:521-584`, `editors.h:44-47` |
| Keymap | 3 count-prefixed tables — `firstKeys` (41 entries: WordStar Ctrl-letters + arrows/Home/End/PgUp/PgDn/Ins/Del + clipboard), `quickKeys` (Ctrl-Q…), `blockKeys` (Ctrl-K…); prefix escapes `kbCtrlQ→0xFF01`/`kbCtrlK→0xFF02` held in `keyState`; commands `cmCharLeft=500 … cmDelWordLeft=525`, `cmFind=82`/`cmReplace=83`/`cmSearchAgain=84` | `teditor1.cpp:44-111,333-367`, `editors.h:52-84` |
| Undo (TV baseline) | **no stack** — `delCount`/`insCount` counters + deleted text parked in the gap; any `setSelect` cursor move zeroes both; no redo. *(Superseded by AR-253 — see Scope Decisions.)* | `teditor2.cpp:169-237,529-531,593-604` |
| Clipboard | `static TEditor *clipboard` (a real, usually hidden editor; `tvedit` titles its window "Clipboard"); `clipCopy` = `clipboard->insertFrom(this)` with an OS-clipboard fallback; `clipCut` = copy + `deleteSelect`; `clipPaste` = `insertFrom(clipboard)` | `editors.h:296`, `teditor1.cpp:297-331`, `editstat.cpp:27` |
| Search/replace | `find()`/`replace()` fill `TFindDialogRec`/`TReplaceDialogRec` → the **`editorDialog` seam** (static callback, default = `cmCancel`) → `doSearchReplace` loops literal `scan`/`iScan` (case) + `isWordChar` (whole-word) + `edReplacePrompt`; flags `efCaseSensitive 0x01 / efWholeWordsOnly 0x02 / efPromptOnReplace 0x04 / efReplaceAll 0x08`; default `editorFlags = efBackupFiles \| efPromptOnReplace` | `teditor1.cpp:400-429,476-485`, `teditor2.cpp:364-421`, `editors.h:86-105`, `editstat.cpp:18-24` |
| Find/Replace dialogs (from `tvedit`) | Find `TDialog(0,0,38,12)`: input (maxLen 80) at `(3,3,32,4)` + `~T~ext to find` + history; `CheckBoxes(3,5,35,7)` [Case sensitive, Whole words only]; OK `(14,9,24,11)` / Cancel `(26,9,36,11)`. Replace `TDialog(0,0,40,16)`: two inputs + 4 checkboxes `(3,8,37,12)`; OK `(17,13,27,15)` / Cancel `(28,13,38,15)` | `tvedit2.cpp:38-112` |
| `Memo` | `TEditor` minus file; palette `cpMemo "\x1A\x1B"` (gray-window chain); swallows **Tab** (dialog field nav) then delegates; data = a `ushort`-length blob (64 KB cap — dropped, AR-263) | `tmemo.cpp:27-98`, `editors.h:357-361` |
| `Indicator` | palette `cpIndicator "\x02\x03"`; fills its width with `═` (`\xCD` `dragFrame`) normally / `─` (`\xC4`) **while dragging** (colour swaps `getColor(1)`↔`(2)`); `modified` ⇒ char `\x0F` at column 0; location `" line:col "` **1-based**, right-aligned so the `:` sits at column 8; `growMode` sticks to the window bottom | `tindictr.cpp:27-88`, `tvtext1.cpp:83-84` |
| `EditWindow` | min **24×6**; `ofTileable`; hScrollBar `(18, y−1, x−2, y)` (room for the indicator), vScrollBar `(x−1, 1, x, y−1)`, indicator `(2, y−1, 16, y)`, editor = the framed interior (`grow(−1,−1)`); title = filename \| `"Untitled"` \| `"Clipboard"`; **blue window** palette (`wpBlueWindow`, no override); frame redraw on `cmUpdateTitle` | `teditwnd.cpp:29-95` (`minEditWinSize` 24×6 at `:29`, `sizeLimits` `:91-95`; `editors.h:485-492` is the palette-layout comment only), `tvtext2.cpp:153-154` |
| `FileEditor` | `loadFile` reads to the buffer end (gap at front), missing file ⇒ empty + ok; `saveFile` writes the two gap halves, `.bak` first when `efBackupFiles` (`backupExt=".bak"`); `save`→`saveAs` when untitled (`edSaveAs` via the seam, broadcasts `cmUpdateTitle`); `valid(close/quit)` prompts `edSaveModify`/`edSaveUntitled` → Yes save / No drop / Cancel abort | `tfiledtr.cpp:104-219,147-167,264-291`, `tvtext1.cpp:126` |
| `Terminal` | a **circular byte queue** (`bufSize = min(32000, n)`; `queFront`/`queBack`); oversized writes truncate to the last `bufSize−1` bytes; whole oldest **lines** evicted until a write fits; `\n`s grow `limit.y`; auto-scrolls to the bottom; draw walks line boundaries backwards from `queFront` (`prevLines`), colour `mapColor(1)`, cursor parked on the last line | `textview.cpp:66,79-100,117-240`, `ttprvlns.cpp:18-47` |
| Scrollbar sync | `doUpdate` pushes H = `(delta.x, 0, limit.x−size.x, size.x/2, 1)`, V = `(delta.y, 0, limit.y−size.y, size.y−1, 1)` + `indicator->setValue(curPos, modified)`; `cmScrollBarChanged` broadcasts route back via `checkScrollBar`; `limit.x = maxLineLength = 256` (h-scroll extent only, **not** a truncation) | `teditor1.cpp:431-451,502-512,740-756`, `editors.h:108`, `teditor2.cpp:433` |

**Behavior may extend TV** (the AR-253 undo/redo stack, reactive binding, Unicode clusters, the
OSC-52 system-clipboard mirror, the PF-009 replace-count return) but the **drawing — row rendering, palettes, keymap, indicator/window
geometry, dialog layouts, ring-buffer semantics — must match the decode**, pinned at plan
GATE-1/GATE-2.

The components in scope (all six — AR-248/AR-249):

| Component | Basis | Package | Role |
|-----------|-------|---------|------|
| `Editor` | **decode** — `TEditor` | `ui` `src/editor/` | The fs-free gap-buffer multiline editor `View`: selection, clipboard, WordStar keymap, search/replace via the `editorDialog` seam, undo/redo, scrollbar + indicator sync. |
| `Memo` | **decode** — `TMemo` | `ui` `src/editor/` | The dialog-embeddable editor bound to a two-way `Signal<string>`; swallows Tab for field navigation. |
| `EditWindow` | **decode** — `TEditWindow` | `ui` `src/editor/` | The tileable blue window composing editor + `Indicator` + both scrollbars; reactive title (file/Untitled/Clipboard). |
| `Indicator` | **decode** — `TIndicator` | `ui` `src/editor/` | The bottom-frame `line:col` + modified read-out with the drag-state frame swap. |
| `Terminal` | **decode** — `TTerminal` | `ui` `src/terminal/` | The streaming log sink: a capped code-unit ring with whole-line eviction and auto-scroll; `write()`/`writeLine()`. |
| `FileEditor` | **decode** — `TFileEditor` | **`@jsvision/files`** | The file binding over the RD-09 `FileSystem` seam: load/save/saveAs, `.bak` backups, the modified-close save prompt. |

---

## Functional Requirements

### Must Have

#### The gap-buffer text core (AR-250, AR-251) — `XL`
- `Editor` stores text in a **movable-gap buffer** over **UTF-16 code units** (JS-native string
  units): logical position `P` maps to physical index via TV's `bufPtr` rule; insert/delete at the
  cursor is O(1) amortized; moving the cursor moves the gap *(AR-250/AR-251)*.
- The navigation primitives transcribe TV: `lineStart`/`lineEnd` (CRLF-aware), `nextChar`/`prevChar`
  (**grapheme-cluster + CRLF-atomic** — a cursor step never lands inside a `\r\n` pair, a surrogate
  pair, or a combining cluster; cluster boundaries come from a **new pure segmentation module in the
  buffer core** built on `Intl.Segmenter` (`granularity: 'grapheme'` — built into Node ≥ 20, a true
  zero-dep; promotion to `@jsvision/core` is a plan-time option and the natural future DEF-21
  consumer, *PF-002*)), `nextWord`/`prevWord` (char-class boundaries per `teditor2.cpp:45-59` — a
  distinct TV decode from Input's `tinputli.cpp` word hops in `controls/input-editing.ts`; keep the
  two decodes separate rather than merging them, *PF-014*), `lineMove` (visual-column-preserving),
  `charPos`/`charPtr` (visual column ⇄ position, expanding 8-col tabs `pos = (pos|7)+1` and
  wide-glyph **widths** via core's width engine, `WIDTH_MODE='wcwidth'`) *(AR-251/AR-263)*.
- **Line endings** *(AR-252)*: each buffer has one `lineEndingType` (`'lf' | 'crlf' | 'cr'`)
  **auto-detected from the first line break** of loaded/set text, defaulting to **`lf`** when the text
  has none; loaded/`setText` content is stored **verbatim** (mixed EOLs preserved — TV `loadFile`
  reads raw bytes straight into the buffer, so round-trip is byte-identical even for mixed-EOL
  files); every **new edit** (typed, pasted, clipboard) is converted to the buffer's type on the way
  in (TV `insertBuffer` conversion) *(PF-008)*.
- Unbounded buffer size (no 64 KB `ushort` limits — the fork's `uint` widening carried to its
  conclusion); `maxLineLength = 256` is kept **only** as the horizontal-scroll extent (`limit.x`).

#### Editing, selection & modes (decode) — `L`
- The full TV command set (`cmCharLeft…cmDelWordLeft`, `editors.h:52-84`) as jsvision commands:
  char/word/line/page/text motion, newline, backspace, del-char/word/word-left, del-to-line-start/end,
  del-line, select-all, start-select, hide-select, insert-mode toggle, indent-mode toggle.
- Selection `[selStart, selEnd)` with the TV anchoring model; Shift+motion extends; mouse drag
  selects with edge auto-scroll; **double-click selects words, triple-click selects lines**; wheel
  scrolls *(decode)*.
- **Overwrite mode** (Ins toggles; a typed char replaces the char under the cursor, extending the
  replaced span cluster-safely at EOL boundaries) and **autoIndent** (newline copies the previous
  line's leading whitespace when enabled) *(decode)*.
- **The faithful keymap** *(AR-259)*: all three TV tables — `firstKeys` (WordStar Ctrl-letters +
  arrows/Home/End/PgUp/PgDn/Ins/Del/Backspace + clipboard keys), the **Ctrl-Q** quick table
  (Q-F find, Q-A replace, Q-S/D line start/end, Q-R/C text start/end, Q-H/Y delete to start/end) and
  the **Ctrl-K** block table (K-B start select, K-K copy, K-C paste, K-Y cut, K-H hide) — with the
  stateful prefix escape (`keyState`), case-normalized within a prefix. The editor claims Ctrl-Q/
  Ctrl-K in **`preProcess` scoped to the focused editor** (the shipped TabView idiom — `preProcess`
  + `isWithin(ev.getFocused(), this)`, `tabs/tab-view.ts:311-336`), so a focused editor beats menu
  accelerators and other windows' handlers; the RD-04 app-keymap consume step precedes all views and
  **cannot** be preempted (`event/dispatch.ts:114-120`, the deliberate PA-1 contract), so the
  documented constraint is: **apps must not bind Ctrl-Q/Ctrl-K in the app keymap** — menu items stay
  the discoverable path *(PF-001)*.

#### Undo/redo — the AR-253 behavior extension — `L`
- A **bounded multi-level undo/redo stack** (documented extension superseding TV's single-level
  `delCount`/`insCount` counters): every buffer mutation records an inverse edit; **consecutive
  single-char typing/deleting at the caret coalesces** into one step; a cursor move seals the open
  step (but does **not** discard history); redo replays undone steps and is cleared by a fresh edit;
  depth-bounded (default pinned at plan time) with whole-steps evicted oldest-first. `cmUndo`/
  `cmRedo` commands + `canUndo`/`canRedo` state for menu greying *(AR-253)*.

#### Rendering (decode) — `M`
- `Editor.draw()` renders per TV `formatLine`: per-cell selection colour split at `selStart`/`selEnd`,
  8-col tab expansion, horizontal scroll with partially-visible tabs/wide glyphs rendered as spaces
  (never a split wide cell), EOL stop + trailing-colour padding *(decode)*.
- Colours: additive core theme roles for **editor normal `0x1E`** and **editor selected `0x71`**
  (byte-pinned at GATE-1 through the `cpEditor`→`wpBlueWindow`→`cpAppColor` chain), plus the
  `Memo`/`Indicator`(/`Terminal`) roles resolved the same way — exact byte set + role names pinned
  at plan GATE-1 *(AR-262)*.
- The caret rides RD-07's seam: `desiredCaret()` reports the cursor cell (**position only** — the
  seam is `Point | null` and core's `cursor` has no DECSCUSR shape API; an insert-vs-overwrite caret
  shape would need additive surface through all three layers and is deferred → **DEF-36**, *PF-004*);
  the hardware caret lands at `curPos − delta` when focused.
- **Every drawn cell routes through core's write-time `sanitize` boundary** — file/paste content is
  hostile input *(see Security)*.

#### Clipboard (AR-254) — `M`
- A **shared clipboard-`Editor`** (app-owned, injectable — the TV static made a seam): `clipCopy`
  copies the selection into it (`insertFrom`), `clipCut` also deletes, `clipPaste` inserts from it;
  the clipboard editor is a real `Editor`, so `tvedit`'s **Clipboard window** works.
- Copy/cut additionally **mirror the text to the system clipboard** via RD-07's OSC-52 write;
  external paste arrives as the host's bracketed-paste `PasteEvent` (chunk-inserted as one undo
  step). OSC-52 **read** stays DEF-25 *(AR-254)*.

#### Search & replace (AR-255) — `M`
- The **`editorDialog` seam**, ported: an injectable callback (per-editor with an app-level default,
  replacing TV's static) receiving the `edXXX` dialog requests (`edFind`/`edReplace`/
  `edReplacePrompt`/`edSearchFailed`/`edSaveModify`/`edSaveUntitled`/`edSaveAs`/`edReadError`/
  `edWriteError`/`edCreateError`/`edOutOfMemory`); the default answers **cancel** (TV
  `defEditorDialog`).
- **Literal search** with `efCaseSensitive`/`efWholeWordsOnly` (TV `scan`/`iScan` + `isWordChar`);
  `cmFind`/`cmReplace`/`cmSearchAgain`; replace honours `efPromptOnReplace` (the prompt repositions
  off the cursor line) and `efReplaceAll`; a failed search reports `edSearchFailed`. Regex → DEF-35.
- **The decoded find/replace dialog builders ship in `@jsvision/ui`** (`findDialog()`/
  `replaceDialog()` — Find 38×12, Replace 40×16, fields/checkboxes/buttons per `tvedit2.cpp:55-112`)
  so every consumer gets working dialogs; the demo wires them through the seam *(AR-255)*.

#### `Memo` (decode) — `S`
- `Editor` minus files, for dialogs: binds a **two-way `Signal<string>`** (the house idiom — writes
  outside land in the buffer, edits inside update the signal; the AR-263 modernization of
  `getData`/`setData`); swallows **Tab** so dialog field navigation works; `cpMemo` gray-window
  colours; no 64 KB cap *(AR-263)*.

#### `Indicator` (decode) — `S`
- The bottom-frame read-out: fills with `═` (U+2550) normally and `─` (U+2500) **while the window
  drags** (with the decoded colour swap) — the drag state arrives via an **additive ui-internal
  seam**: a reactive `Window` drag-state signal set/cleared by the Desktop gesture lifecycle (today
  the in-flight gesture is a private non-reactive field, `desktop.ts:53`; exact shape pinned at plan
  time, *PF-005*); `modified` ⇒ the `\x0F` marker glyph (Unicode mapping
  pinned at GATE-1) at column 0; location `" line:col "` (both 1-based) right-aligned with the colon
  at column 8; updates via the editor's `doUpdate` push *(decode)*.

#### `EditWindow` (decode) — `M`
- A tileable **blue** window composing the family with TV's exact rects: hScrollBar starting at
  x=18 on the bottom edge, vScrollBar on the right, `Indicator` at `(2 … 16)` on the bottom, editor
  filling the framed interior; min size **24×6**; bars/indicator ride the frame (visibility per TV's
  active-state rule — **to be pinned at GATE-1**, *PF-015*); reactive title = filename | `"Untitled"`
  | `"Clipboard"` (the existing `Window.title` signal — `FileEditor.saveAs` writes it; TV's
  `cmUpdateTitle` broadcast needs no analogue, *PF-013*) *(decode)*.

#### `FileEditor` — in `@jsvision/files` (AR-249, AR-258) — `M`
- `Editor` + file binding over the **RD-09 `FileSystem` seam** (no direct `node:fs` in `ui`;
  `@jsvision/files` gains `readFile`/`writeFile`(/`rename`/`unlink`) on the seam as needed — additive,
  pinned at plan time): `loadFile` (missing file ⇒ empty buffer, still valid), `save`/`saveAs`
  (untitled routes to `edSaveAs` through the seam — the demo answers with the RD-09 `FileDialog`),
  and `saveFile` writing the exact buffer content.
- **Faithful defaults** *(AR-258)*: `efBackupFiles` **ON** (save first renames the existing file to
  `.bak`) and `efPromptOnReplace` **ON** — both toggleable flags; closing/quitting with a modified
  buffer runs the `valid()` prompt (Yes save / No drop / Cancel abort) *(decode)*.

#### `Terminal` (AR-257) — `M`
- The streaming log sink in `src/terminal/`: a **code-unit-capped circular queue** (the cap is
  measured in **UTF-16 code units** — the AR-251 buffer unit; TV counts C bytes; default cap 32000,
  configurable, *PF-007*) with TV's semantics — oversized writes keep only the tail, whole oldest **lines**
  evicted until a write fits, `\n` grows the line limit, auto-scroll to the bottom on write,
  bottom-up draw from the queue front; `write(text)`/`writeLine(text)` replace the C++
  streambuf/`otstream` *(AR-257/AR-263)*; content sanitized at draw.

#### Demos & showcase (AR-260 — NON-NEGOTIABLE gates) — `M`
- **Kitchen-sink stories** (headless-smoke-tested): `editor/editor` (a live `Editor` with selection +
  search hints), `editor/memo` (a `Memo` in a form with its bound-signal echo), `editor/terminal`
  (a `Terminal` being written to). The `EditWindow`/`Indicator` show inside the editor story's frame
  as fits the canvas.
- **`demo:editor`** — the headless ASCII walkthrough (house pattern): type → select (word/line) →
  cut/paste → undo/redo → find/replace → the indicator tracking `line:col`, one frame per step.
- **`demo:tvedit`** — the **live `tvedit` clone** (real TTY): the decoded menu bar + status line
  (`tvedit3.cpp:36-94`), multiple `EditWindow`s on the desktop (open/new/save/save-as via
  `@jsvision/files`' `FileDialog` + `ChDirDialog`), the Clipboard window, find/replace wired through
  the `editorDialog` seam (`doEditDialog`, `tvedit3.cpp:106-193`), cascade/tile — the component-map
  Phase-3 acceptance oracle *(AR-260)*.

### Should Have

- **`Editor.text` accessor** — a read API (`getText(range?)`) + programmatic `setText`/`insertText`
  beyond the `Memo` signal binding (needed by the demos/tests anyway).
- **Status/command greying** — `cmSave`/`cmUndo`/`cmRedo`/cut/copy enable-state tracks
  modified/selection/history via the RD-04 command registry (TV `updateCommands`).
- **`Terminal` `otstream` analogue** — a tiny `terminalWriter(term)` returning a `(s) => void` sink
  usable as a logger target.

### Won't Have (Out of Scope)

| Item | Why | Tracked |
|------|-----|---------|
| Right-click context menu (`initContextMenu`/`popupMenu`) | Needs a popup-menu-at-point primitive jsvision doesn't have | **DEF-34** *(AR-256)* |
| Regex search | TV search is literal; `search()` is the clean seam for it later | **DEF-35** *(AR-255)* |
| `cmEncoding` / single-byte mode | The fork's UTF-8↔byte toggle is meaningless for JS strings | *(AR-251/AR-263 — dropped)* |
| Syntax highlighting, word wrap, multiple carets | Not in TV; out of the fidelity scope entirely | — |
| OSC-52 clipboard **read** | Core-decoder round-trip, non-additive | DEF-25 (unchanged) |
| Hardware-caret **shape** (insert vs overwrite via DECSCUSR) | The RD-07 seam (`desiredCaret(): Point \| null`) + core `cursor` carry position only; shape needs additive surface through three layers | **DEF-36** *(PF-004)* |
| C++ `streambuf`/`iostream` surface | Replaced by `write()`/`writeLine()` | *(AR-257/AR-263)* |

---

## Technical Requirements

- **Module layout** *(AR-262)*: `@jsvision/ui` `src/editor/` (dir-per-concern: `buffer` (gap +
  navigation, pure), `format` (the `formatLine` renderer, pure), `keymap` (the three tables +
  prefix state, pure data), `undo` (the AR-253 stack, pure), `search` (pure `scan`/`iScan`), then
  `editor.ts`/`memo.ts`/`edit-window.ts`/`indicator.ts`/`dialogs.ts` views) + `src/terminal/`
  (`ring.ts` pure queue + `terminal.ts` view). Files ≤ 500 lines (the pure cores make the XL
  splittable); **explicit named re-exports** from each package's `src/index.ts`. `FileEditor` +
  the `FileSystem` additions in `@jsvision/files` `src/editor/`.
- **Purity split**: buffer/format/keymap/undo/search/ring are **view-free pure modules** (the
  RD-16 `columns.ts` idiom) — spec-testable without a render root.
- **Reactivity**: `modified`, `curPos` (for the indicator), selection presence, and undo/redo
  availability surface as signals/computeds; `Memo` binds `Signal<string>` two-way with the
  ComboBox-idiom feedback guard. Repaints coalesce per the RD-03 scheduler (whole-view vs
  single-line damage decided at plan time via the `ufLine`/`ufView` decode).
- **Additive-only cross-package surface**: new core theme roles (editor/memo/indicator/terminal set,
  byte-pinned at GATE-1) *(AR-262)*; the `@jsvision/files` `FileSystem` read/write additions; no
  breaking change to any shipped API. Zero runtime dependencies, ESM-only, NodeNext.
- **Performance NFR** *(AR-261, informational — house RD-10 pattern)*: on a ~1 MB buffer,
  single-char insert + coalesced redraw, and a cursor move, each complete **< 16 ms** on the dev
  box; asserted off-CI only (skipped under `CI`/`TUI_SKIP_PERF`), never gating.

## Integration Points

### With RD-05/RD-11 (App shell, containers)
- `EditWindow extends Window` (blue palette); scrollbars are RD-11 `ScrollBar`s driven through the
  decoded `setParams` sync; the find/replace builders compose RD-11 `Dialog` + RD-06 controls.

### With RD-07 (clipboard + caret)
- OSC-52 write mirror on copy/cut; bracketed `PasteEvent` insertion; `desiredCaret()` for the
  hardware caret; `Commands.cut/copy/paste` reused + **additive `Commands.undo` and `Commands.redo`**
  (verified: neither exists today — `status/commands.ts:12-45`, *PF-003*).

### With RD-09 (`@jsvision/files`)
- `FileEditor` lives there, over the `FileSystem` seam (+ additive file read/write methods);
  `demo:tvedit` uses `FileDialog`/`ChDirDialog` and the `openFile` flow.

### With `@jsvision/core`
- Width engine for wide-glyph **widths** (cluster boundaries are the PF-002 `Intl.Segmenter` module,
  not core); `sanitize` at every draw; additive theme roles; the host caret/cursor plumbing already
  shipped.

## Scope Decisions

> Every decision back-references the [Ambiguity Register](00-ambiguity-register.md).

| AR | Decision |
|----|----------|
| AR-248 | All five components in RD-08 (Editor/Memo/EditWindow/Indicator/Terminal). |
| AR-249 | `Editor` core fs-free in `ui`; `FileEditor` binding in `@jsvision/files` over the RD-09 seam. |
| AR-250 | Faithful movable-gap buffer over a code-unit array (decode-direct transcription). |
| AR-251 | Positions are UTF-16 code units; navigation is cluster-aware (the PF-002 `Intl.Segmenter` pure module) + width-aware via core; `cmEncoding` dropped. |
| AR-252 | Per-buffer EOL auto-detect + preserve + insert-conversion; default `lf`. |
| AR-253 | **Modern bounded undo/redo stack** — the documented behavior extension over TV's single-level counters. |
| AR-254 | Shared clipboard-`Editor` + OSC-52 write mirror + bracketed-paste; DEF-25 read unchanged. |
| AR-255 | `editorDialog` seam ported faithfully **and** the decoded find/replace dialog builders ship in `ui`; regex → DEF-35. |
| AR-256 | Right-click context menu **deferred** → DEF-34 (owner: a future menus RD; revisit: first popup-at-point need). |
| AR-257 | Faithful ring `Terminal` (named `Terminal`), `write()`/`writeLine()`, default cap 32000 (measured in UTF-16 code units per PF-007). |
| AR-258 | Faithful save defaults: `.bak` ON + prompt-on-replace ON, both toggleable. |
| AR-259 | Full faithful WordStar keymap incl. both prefix tables. |
| AR-260 | Proof = live `demo:tvedit` clone + headless `demo:editor` + kitchen-sink stories. |
| AR-261 | Informational 1 MB / 16 ms perf NFR, off-CI. |
| AR-262 | `src/editor/` + `src/terminal/`; additive theme roles byte-pinned at plan GATE-1. |
| AR-263 | Modernization batch (64 KB cap dropped, `Signal<string>` memo, `write()` API, faithful tabs/extents/geometry). |

## Security Considerations

- **Hostile file content is the headline vector**: a file on disk (or a paste) can contain C0/DEL/
  escape bytes; every editor/terminal/indicator cell routes through core's write-time **`sanitize`**
  boundary, so no control sequence reaches the terminal (the AR-245 rule, applied to buffer
  content). The RD-13 hostile-UTF-8 hardening (HR-01) applies to buffer navigation: malformed
  surrogate content must never crash a cursor step or `formatLine`.
- File paths only ever pass through the `@jsvision/files` `FileSystem` seam (canonicalization +
  traversal concerns live there, per RD-09); `ui` stays fs-free.
- The OSC-52 mirror **writes** only (no clipboard read — no exfiltration-by-read surface); backup
  (`.bak`) writes stay inside the target file's directory via the seam's path helpers.
- Search input is literal (no regex engine → no ReDoS surface; noted for DEF-35).

## Acceptance Criteria

> Spec oracles; the plan's GATE-1/GATE-2 re-verify every decoded fact cell-by-cell.

1. **AC-1 (gap primitives)**: with content `"ab\ncd"` and the cursor after `b`, `lineStart`/`lineEnd`
   return the decoded offsets for both EOL styles (`\n` and `\r\n` — a cursor step treats `\r\n` as
   one unit); `charPos` expands a tab at visual column 3 to the next 8-col stop (`(pos|7)+1`);
   `lineMove` up/down preserves the visual column across a shorter line (clamping at its EOL).
2. **AC-2 (formatLine)**: a row with selection `[2,5)` renders cells 0-1 in the editor-normal role
   and 2-4 in editor-selected (`0x1E`/`0x71` at GATE-1); a tab renders as spaces to the stop; with
   `delta.x=4`, a wide glyph straddling the left edge renders as spaces (never a split cell); text
   after EOL pads with the trailing colour to the view width.
3. **AC-3 (keymap)**: Ctrl-S/Ctrl-D/Ctrl-E/Ctrl-X move left/right/up/down; Ctrl-Q then F emits
   `cmFind` (the prefix consumes the first event and sets `keyState`); Ctrl-K then B starts a
   selection; an unknown key after a prefix clears the prefix without editing; arrows/Home/End/
   PgUp/PgDn/Ins/Del map per `firstKeys`.
4. **AC-4 (selection)**: Shift+Right extends by one cluster; double-click on a word selects exactly
   that word (char-class boundaries); triple-click selects the whole line incl. its EOL; a plain
   click collapses the selection; drag past the bottom edge auto-scrolls and extends.
5. **AC-5 (clipboard)**: with `"hello"` selected, copy leaves the clipboard-`Editor` containing
   exactly `"hello"` and emits one OSC-52 write with its base64; cut additionally removes it from
   the buffer as one undo step; paste inserts the clipboard content at the caret (replacing any
   selection); a 2-chunk bracketed paste inserts once and undoes as one step.
6. **AC-6 (undo/redo — AR-253)**: typing `a`,`b`,`c` coalesces to one undo step; a cursor move then
   typing `d` starts a second; two undos restore `""` and two redos restore `"abcd"`; a fresh edit
   after one undo clears the redo branch; history is depth-bounded (oldest steps evicted whole);
   `canUndo`/`canRedo` flip accordingly.
7. **AC-7 (modes)**: Ins toggles overwrite (typing over `"xy"` gives `"ay"` not `"axy"`; at EOL it
   appends); with autoIndent on, Enter after `"  foo"` yields a new line starting `"  "`; with it
   off, no indent copy.
8. **AC-8 (search/replace)**: find `"abc"` case-insensitive matches `"ABC"` and moves the selection
   onto the match; whole-words rejects `"abcd"`; `cmSearchAgain` finds the next; replace with
   prompt-on-replace raises `edReplacePrompt` per hit (accept/skip work); replace-all replaces every
   hit in one pass and the replace operation **returns the replacement count** (a documented
   test-visible extension — TV reports none, *PF-009*); a miss raises `edSearchFailed`; with no `editorDialog`
   wired, `cmFind` is a safe no-op (default answers cancel).
9. **AC-9 (find/replace dialogs)**: `findDialog()` measures 38×12 with the input at TV's rect, the
   2-box check cluster and OK/Cancel at the decoded rects; `replaceDialog()` 40×16 with the 4-box
   cluster; both round-trip `{find, replace?, options}` records whose flag bits map to
   `efCaseSensitive/efWholeWordsOnly/efPromptOnReplace/efReplaceAll`.
10. **AC-10 (Memo)**: a `Memo` bound to `Signal("hi")` shows `"hi"`; typing updates the signal on
    the same tick (no feedback loop when the signal is also written externally); Tab moves dialog
    focus instead of inserting; colours resolve through the gray-window chain at GATE-1.
11. **AC-11 (Indicator)**: at cursor (0,0) it shows `" 1:1 "` with the colon at column 8, filled
    with `═`; moving to line 12, col 5 shows `" 12:5 "`; a modified buffer puts the marker glyph at
    column 0; while its window drags, the fill swaps to `─` with the decoded colour swap, and back.
12. **AC-12 (EditWindow)**: at 60×20 the rects match TV's `TRect`s verbatim (end-**exclusive**,
    `teditwnd.cpp:41,46,51`, *PF-006*): hScrollBar `TRect(18,19,58,20)` = columns 18..57 of row 19,
    vScrollBar `TRect(59,1,60,19)` = rows 1..18 of column 59, indicator `TRect(2,19,16,20)` =
    columns 2..15, the editor the framed interior; `sizeLimits` min is 24×6; titles: no file →
    `"Untitled"`, a file → its name, the clipboard editor → `"Clipboard"`; a save-as re-renders the
    title (a `Window.title` signal write).
13. **AC-13 (FileEditor)**: loading a missing path yields an empty valid buffer; save writes exactly
    the buffer content (gap position irrelevant); with backups ON a save of an existing file first
    renames it to `.bak` (old content readable there); untitled save routes `edSaveAs` through the
    seam; closing modified raises `edSaveModify` — Yes saves, No drops, Cancel keeps the window;
    all through an in-memory `FileSystem` (no real disk in tests).
14. **AC-14 (Terminal)**: with cap 32 (UTF-16 code units, *PF-007*) and 5 writes of 10-unit lines,
    the oldest whole lines are evicted (never a partial line at the head); a single 100-unit write
    keeps only its tail;
    the view auto-scrolls so the last line is visible; `writeLine("a")` adds exactly one line;
    an empty ring draws an empty view (no crash).
15. **AC-15 (EOL round-trip — AR-252)**: setting CRLF text auto-detects `crlf`; typing Enter inserts
    `\r\n`; a pasted `\n` becomes `\r\n`; reading back yields byte-identical CRLF text; the default
    for break-less text is `lf`; a **mixed-EOL** text loads and reads back byte-identically (stored
    verbatim — only new edits are converted, *PF-008*).
16. **AC-16 (Unicode)**: arrow keys never split `👍` (surrogate pair), `e`+U+0301 (combining), or a
    wide CJK glyph; backspace deletes a whole cluster; `charPos` counts a wide glyph as 2 columns;
    the caret cell always lands on a cluster lead.
17. **AC-17 (sanitize)**: a buffer/terminal line containing `\x1b]0;x\x07` and C0 bytes renders as
    inert cells (no escape reaches the output stream) — asserted at the `ScreenBuffer`/serialize
    level (write-time sanitize, the established ui test pattern; the `@xterm/headless` golden
    harness is core-package-local, *PF-010*).
18. **AC-18 (showcase — NON-NEGOTIABLE)**: the three kitchen-sink stories exist, are registered, and
    pass the headless smoke test; `demo:editor` prints its ASCII walkthrough headlessly (e2e-covered);
    `demo:tvedit` launches on a real TTY wiring menus/status/FileDialog/find-replace/Clipboard window.
19. **AC-19 (packaging)**: explicit named re-exports for every public symbol from `ui` and `files`
    `src/index.ts`; packaging spec tests; `check:deps` stays clean (zero runtime deps); all files
    ≤ 500 lines.
20. **AC-20 (perf — informational, AR-261)**: the bench-style spec asserts the 1 MB insert/redraw/
    cursor-move < 16 ms off-CI and skips under `CI`/`TUI_SKIP_PERF`.

## Complexity Estimate

| Piece | Estimate |
|-------|----------|
| Gap buffer + navigation + EOL core (pure) | **XL** (the make-or-break module; pure + heavily spec-tested) |
| formatLine renderer + Editor view/draw/caret | L |
| Keymap + commands + selection/mouse | L |
| Undo/redo stack (AR-253) | M |
| Search/replace + seam + dialog builders | M |
| Memo / Indicator / EditWindow | S / S / M |
| FileEditor (`@jsvision/files`) | M |
| Terminal (`src/terminal/`) | M |
| Demos (tvedit clone + headless + stories) | M |
