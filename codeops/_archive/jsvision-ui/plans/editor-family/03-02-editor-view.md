# Editor view: `formatLine` + keymap + the `Editor` View

> **Document**: 03-02-editor-view.md
> **Parent**: [Index](00-index.md)
> **Files**: `packages/ui/src/editor/{format.ts,keymap.ts,editor.ts,editor-mouse.ts,
> editor-actions.ts}` (the mouse/actions splits are decided deliverables — PF-011; an fs-free
> editor with modes/mouse/gadget-sync will not fit 500 lines)

## Overview

The `Editor` view: TV's `formatLine` row renderer (pure), the faithful 3-table WordStar keymap
(pure data + prefix state), and the focusable `View` binding buffer ⇄ screen with selection, mouse,
modes, caret, and scrollbar/indicator sync.

## TV decode (GATE 1)

- **`formatLine`** (`edits.cpp:31-92`): per-char colour split — `selStart ≤ P < selEnd` → the high
  attr (selected), else low (normal); tabs expand to 8-col stops (`(pos|7)+1` via
  `nextCharAndPos`, `teditor1.cpp:255`); chars left of `hScroll` are skipped and a
  partially-scrolled tab/wide char renders as **spaces** (never a split cell); stops at `\r`/`\n`;
  pads the rest of the row with the trailing colour.
- **Colours**: `cpEditor "\x06\x07"` (`teditor1.cpp:171,496-500`) → `cpBlueWindow[6/7]=0x0D/0x0E`
  (`views.h:955`) → `cpAppColor[13/14]` = **normal `0x1E`**, **selected `0x71`** (`app.h:143`) —
  roles `editorNormal`/`editorSelected` (PA-8). `drawLines` fetches the pair as
  `getColor(0x0201)` (`teditor1.cpp:466`).
- **`draw()`** (`teditor1.cpp:453-474`): formats exactly `size.y` lines starting at `drawPtr` (the
  cached first-visible-line position, re-anchored by `lineMove` when `delta.y` changes);
  `writeBuf` one row at a time. The cursor is positioned in `doUpdate`
  (`setCursor(curPos.x−delta.x, curPos.y−delta.y)`, `teditor1.cpp:435`) — ours via
  `desiredCaret()` (PF-004; position only, shape = DEF-36).
- **Keymap** (`teditor1.cpp:44-111`; `scanKeyMap` `:117-167` — exec-GATE-1 corrected anchor, the
  `:333-367` range is `convertEvent`; commands `editors.h:52-84`): `firstKeys` (41 entries —
  WordStar Ctrl-letters, arrows/Home/End/PgUp/PgDn/Ins/Del/Backspace, clipboard keys), `quickKeys`
  (Ctrl-Q…), `blockKeys` (Ctrl-K…); prefix escapes `kbCtrlQ→0xFF01`/`kbCtrlK→0xFF02` held in
  `keyState`; case-normalized within a prefix; an unknown key after a prefix clears it without
  editing. **Decode nuances for keymap.ts's JSDoc (PF-005):** `firstKeys` lists `kbCtrlDel`
  **twice** — `cmDelWord` (entry 25, `teditor1.cpp:71`) then `cmClear` (entry 41, `:87` — dead:
  first match wins in `scanKeyMap`, `:117-167`) — so Ctrl-Del → `delWord` and the menu reaches
  clear by command; Ctrl-P/`cmEncoding` is the RD-sanctioned omission.
- **Selection & mouse** (`teditor2.cpp:459-539`, `teditor1.cpp:521-584`, `editors.h:44-47`):
  `[selStart, selEnd)` with `curPtr` the moving anchor; Shift/`selecting` extends; drag
  auto-scrolls at edges; `smDouble` snaps to words, `smTriple` to lines; wheel scrolls.
- **Scrollbar/indicator sync** (`doUpdate` `teditor1.cpp:431-451` — the `setParams` pushes at
  `:442,444` (PF-009); write-back `checkScrollBar` `:502-512`; `:740-756`): `doUpdate` pushes
  H = `(delta.x, 0, limit.x−size.x, size.x/2, 1)`, V = `(delta.y, 0, limit.y−size.y, size.y−1, 1)`
  + `indicator.setValue(curPos, modified)`; `cmScrollBarChanged` routes back via `checkScrollBar`;
  `limit.x = maxLineLength = 256` (h-scroll extent only, `editors.h:108`, `teditor2.cpp:433`).
- **Modes**: overwrite (Ins) replaces the char under the cursor (cluster-safe span, appends at
  EOL); autoIndent copies the previous line's leading whitespace on Enter (`teditor2.cpp` newline
  path).
- **updateCommands** (`teditor2.cpp:623-637`): undo iff history (`:625`); cut/copy iff selection
  (`:628-629`, all clipboard ops gated `isClipboard()==False` `:626`); **clear iff selection**
  (`cmClear`, `:633` — PF-005); paste iff `clipboard==0 || clipboard->hasSelection()` (`:630-631`
  — TV keeps paste ENABLED in the null-clipboard case because magiblot falls back to the OS
  clipboard; **ours greys paste with no clipboard injected**, the recorded PA-2 deviation);
  find/replace/searchAgain always (active only).

## Implementation Details

### `format.ts` (pure)

```ts
export interface FormatCell { ch: string; selected: boolean; width: 1 | 2 }
/** One visual row: TV formatLine over the buffer, hScroll-clipped, width chars wide. */
export function formatLine(b: BufText, lineStartP: number, hScroll: number, width: number,
                           sel: { start: number; end: number } | null): FormatCell[];
```

The view maps `selected` → `editorSelected`/`editorNormal` and writes cells through
`DrawContext` (write-time sanitize — AC-17).

### `keymap.ts` (pure data + resolver)

```ts
export type EditorAction = 'charLeft' | /* … the 26 TV cm names … */ 'delWordLeft'
  | 'find' | 'replace' | 'searchAgain' | 'undo' | 'redo'
  | 'cut' | 'copy' | 'paste' | 'startSelect' | 'hideSelect' | 'selectAll'
  | 'clear'                                  // PF-005 — deleteSelect semantics (cmClear, teditor2.cpp:633)
  | 'toggleInsert' | 'toggleIndent' | 'newLine';
export type KeyState = 0 | 'ctrlQ' | 'ctrlK';
export interface KeyResolution { action?: EditorAction; nextState: KeyState; consumed: boolean }
export function resolveKey(state: KeyState, ev: { key: string; ctrl: boolean; shift: boolean; alt: boolean }): KeyResolution;
```

The three tables transcribed 1:1 (decode JSDoc per entry); `keyState` is TV's prefix escape made a
tiny state machine (PA-15 — actions are internal ids, not registry commands).

### `editor.ts` — `class Editor extends View`

```ts
export interface EditorOptions {
  clipboard?: Editor;                       // PA-2 — no implicit default
  editorDialog?: EditorDialogHandler;       // 03-03; default answers cancel
  undoDepth?: number;                       // PA-1 — default 1000
  autoIndent?: boolean; overwrite?: boolean;
  now?: () => number;                       // PA-18 multi-click clock (default Date.now)
}
export interface IndicatorTarget {          // plan-preflight PF-003 — structural seam; the Phase-7
  setValue(pos: { line: number; col: number }, modified: boolean): void; // Indicator satisfies it
}
export class Editor extends View {
  focusable = true; preProcess = true;      // PF-001 — scoped by isWithin(ev.getFocused?.() ?? null, this)
  // reactive state (signals/computeds): modified, curPos {line,col} (1-based for the indicator),
  // hasSelection, canUndo, canRedo, insertMode, lineCount
  getText(range?: { from: number; to: number }): string;      // Should-Have (PA-4)
  setText(text: string): void;              // verbatim store + EOL re-detect (AR-252)
  insertText(text: string): void;           // converted like typed input
  execute(action: EditorAction): void;      // PA-15 public action entry
  attachGadgets(h?: ScrollBar, v?: ScrollBar, ind?: IndicatorTarget): void; // 03-04 wiring; PF-003 type
  desiredCaret(): Point | null;             // curPos − delta while focused (PF-004)
}
```

**Event routing** (`onEvent`/`preProcess`):
1. `preProcess` claims ONLY Ctrl-Q/Ctrl-K (and a pending `keyState` follow-up) when
   `isWithin(ev.getFocused?.() ?? null, this)` — the TabView idiom, optional-chained as shipped
   (`tab-view.ts:311-336`; `getFocused` is an optional member, `view/types.ts:158` — PF-010);
   everything else waits for the focused phase. The app-keymap constraint (no Ctrl-Q/K app
   bindings) is documented on the class (PF-001).
2. Focused phase: `resolveKey` → `execute(action)`; printable keys insert (overwrite-aware,
   EOL-converted); `paste` events insert as ONE undo step (AC-5); mouse down/move/up implement the
   TV drag model + PA-18 multi-click (same-cell downs within 500 ms; count 2 = word, 3 = line) with
   `ev.setCapture` for edge auto-scroll; wheel scrolls `delta.y`.
3. Command phase: `Commands.cut/copy/paste/undo/redo` +
   `EditorCommands.find/replace/searchAgain/clear` handled when focused (PA-15, `clear` per
   PF-005; `save`/`saveAs` are files-owned `FileCommands` — PF-004); greying via the registry per
   the `updateCommands` decode (PA-4).

**Scroll model**: `delta {x,y}` signals; `trackCursor` keeps the caret visible; `limit.x = 256`
(decode); `limit.y = lineCount`. `attachGadgets` pushes the decoded `setRange` params on every
update tick and subscribes to bar `value` changes (the shared-signal channel,
`scroll-bar.ts:131-136`).

**Repaint**: whole-view `invalidate()` on any buffer/selection/scroll change, coalesced by the
RD-03 scheduler; `draw()` formats only the `size.y` visible lines from the `drawPtr` anchor (PA-9).

## Integration Points

Buffer core (03-01); undo/clipboard/search (03-03) — `Editor` composes their pure modules;
`EditWindow` (03-04) wires gadgets; theme roles (03-07).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Unknown key after a prefix | Clear `keyState`, consume, no edit | AC-3 (decode) |
| Action on empty selection (cut/copy) | No-op; commands greyed per decode | PA-4/PA-16 |
| Paste with no clipboard editor | Internal paste no-op (OSC mirror unaffected) | PA-2 |
| Mouse beyond last line/col | Clamp to nearest valid position (TV `charPtr` clamp) | AC-4 (decode) |
| Draw with hostile buffer bytes | Write-time sanitize (every cell via `DrawContext`) | AC-17 |

## Testing Requirements

- Spec: ST-6…ST-14 (`format.spec`, `keymap.spec`, `editor.spec`) — [07](07-testing-strategy.md).
- Impl: drag auto-scroll timing, prefix + modifier corner cases, overwrite at EOL/wide glyphs,
  gadget-sync param math, multi-click window boundaries (injected clock).
