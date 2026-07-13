# Undo/redo, clipboard, search/replace + the `editorDialog` seam

> **Document**: 03-03-undo-clipboard-search.md
> **Parent**: [Index](00-index.md)
> **Files**: `packages/ui/src/editor/{undo.ts,search.ts,dialogs.ts}` (+ the `Editor` wiring in `editor.ts`)

## Overview

Three concerns composed by the `Editor`: the AR-253 undo/redo stack (a documented behavior
extension), the AR-254 clipboard-`Editor` seam + OSC-52 mirror, and the AR-255 literal
search/replace behind the ported `editorDialog` seam — plus the decoded dialog builders and the
PA-7 message-box helpers.

## TV decode (GATE 1)

- **TV undo baseline** (superseded by AR-253): `delCount`/`insCount` counters + deleted text parked
  in the gap; any `setSelect` move zeroes both; no redo (`teditor2.cpp:169-237,529-531,593-604`).
  Kept only as the semantic reference for *what counts as one coalesced step*.
- **Clipboard** (`editors.h:296`, `teditor1.cpp:297-331`, `editstat.cpp:27`): a real (usually
  hidden) `TEditor`; `clipCopy` = `clipboard->insertFrom(this)` — `insertFrom` inserts the
  **source's selected range** and leaves the copied range selected in the clipboard (PA-16);
  `clipCut` = copy + `deleteSelect`; `clipPaste` = `insertFrom(clipboard)`; `cmPaste` enabled iff
  `clipboard->hasSelection()` (`teditor2.cpp:623-637`); all guarded `if (clipboard)` — the PA-2
  no-clipboard semantics. **Recorded deviation (PF-009):** magiblot's `clipPaste` falls back to
  the **OS clipboard** when `clipboard == 0` (`teditor1.cpp:322-331`); ours is a paste no-op —
  OSC-52 *read* is DEF-25, and system paste already arrives as a bracketed `PasteEvent` — so cite
  the guards as "TV-derived", not "exactly TV's semantics".
- **Search/replace** (anchors per PF-009: `doSearchReplace` = `teditor1.cpp:400-429`; `find()` at
  `:476-485`; `teditor2.cpp:364-375` = `replace()`, `:389-421` = `search()`; `editors.h:86-105`,
  `editstat.cpp:18-24`): `find()`/`replace()` fill `TFindDialogRec`/`TReplaceDialogRec` → the
  `editorDialog` seam (default = cancel) → `doSearchReplace` loops literal `scan`/`iScan` (case) +
  `isWordChar` (whole-word — the function at `teditor2.cpp:61-64`, distinct from the editor
  word-hop classes `getCharType`/`isWordBoundary` `:45-59`) + `edReplacePrompt`; flags
  `efCaseSensitive 0x01 / efWholeWordsOnly 0x02 / efPromptOnReplace 0x04 / efReplaceAll 0x08`
  (`editors.h:99-103` — the `ed*` dialog codes are `:86-97`; exec-GATE-1 anchor);
  defaults `efBackupFiles | efPromptOnReplace`.
- **Find/Replace dialogs** (`examples/tvedit/tvedit2.cpp:55-112` — `:38-53` is `execDialog`; the
  tvedit sources live under `examples/tvedit/`, not `source/tvision/` — PF-009): Find
  `TDialog(0,0,38,12)` — input maxLen 80 at
  `(3,3,32,4)` + `~T~ext to find` + history; `CheckBoxes(3,5,35,7)` [Case sensitive, Whole words
  only]; OK `(14,9,24,11)` / Cancel `(26,9,36,11)`. Replace `TDialog(0,0,40,16)` — two inputs +
  4 checkboxes `(3,8,37,12)`; OK `(17,13,27,15)` / Cancel `(28,13,38,15)`.
- **Replace prompt** (`examples/tvedit/tvedit3.cpp:177-189`, PA-11): 40×7 box `TRect(0,1,40,8)`
  h-centred at the top; **trigger** (PF-009, `:184-186`): the box moves when the cursor's global y
  is `≤ makeGlobal(r.b).y + 1` — i.e. at/above **one row below** the box bottom; **destination**:
  the box's new *top* = `size.y − height − 2` (the move delta is `size.y − r.b.y − 2`) — never on
  the cursor line. The editor passes the **global cursor point** (`teditor1.cpp:415-419`).
- **Seam requests** (`editors.h:86-105`, `tvedit3.cpp:106-193`): `edOutOfMemory`, `edReadError`,
  `edWriteError`, `edCreateError` (error boxes), `edSaveModify`/`edSaveUntitled` (Yes/No/Cancel),
  `edSaveAs` (file dialog), `edFind`/`edReplace` (the builders), `edSearchFailed` (info box),
  `edReplacePrompt` (the prompt box).

## Implementation Details

### `undo.ts` (pure — the AR-253 extension)

```ts
export interface EditStep { at: number; removed: string; inserted: string } // inverse-applicable
export class UndoStack {
  constructor(depth: number);                       // PA-1 default 1000, whole-step eviction
  record(step: EditStep): void;                     // clears redo (fresh edit)
  coalesce(step: EditStep): void;                   // extends the open step (single-char typing/deleting at the caret)
  seal(): void;                                     // cursor move seals the open step; history kept
  undo(): EditStep | null; redo(): EditStep | null;
  readonly canUndo: boolean; readonly canRedo: boolean;
}
```

The `Editor` translates every buffer mutation into a step, applies inverses on undo, replays on
redo, and mirrors `canUndo`/`canRedo` into signals for greying (AC-6). A multi-chunk bracketed
paste records ONE step (AC-5).

### Clipboard wiring (in `editor.ts`)

`copy()`: guard `hasSelection`; `clipboard?.replaceAllWith(selText)` + select it (PA-16);
`ev.setClipboard?.(selText)` — the OSC-52 mirror (`event-loop.ts:317`, AC-5).
`cut()` = copy + delete (one step). `paste()`: `clipboard?.selectionText()` inserted at the caret,
replacing any selection.

### `search.ts` (pure)

```ts
export interface SearchOptions { caseSensitive: boolean; wholeWords: boolean }
export function scan(b: BufText, from: number, needle: string, o: SearchOptions): number; // −1 on miss
export function isWordChar(ch: string): boolean;   // the TV search whole-words class, teditor2.cpp:61-64
                                                    // (distinct from the editor word-hop classes :45-59 — PF-014/PF-009)
export function replaceRange(/* editor-level, counts replacements */): number;            // PF-009
```

`doSearchReplace` (editor method): loop scan → select match → if replacing honour
`efPromptOnReplace` via the seam (`edReplacePrompt {cursor}`) / `efReplaceAll`; returns the
replacement count (PF-009); a miss raises `edSearchFailed` (AC-8).

### `editorDialog` seam (PA-17)

```ts
export type EditorDialogRequest =
  | { kind: 'find'; rec: FindRec } | { kind: 'replace'; rec: ReplaceRec }
  | { kind: 'replacePrompt'; cursor: Point }
  | { kind: 'searchFailed' } | { kind: 'saveModify'; name: string }
  | { kind: 'saveUntitled' } | { kind: 'saveAs'; name: string }
  | { kind: 'readError' | 'writeError' | 'createError' | 'outOfMemory'; name?: string };
export type EditorDialogResult =
  | { kind: 'find'; rec: FindRec | null } | { kind: 'replace'; rec: ReplaceRec | null }
  | { kind: 'confirm'; answer: 'yes' | 'no' | 'cancel' } | { kind: 'path'; path: string | null }
  | { kind: 'ok' };
export type EditorDialogHandler = (req: EditorDialogRequest) => Promise<EditorDialogResult>;
export const defaultEditorDialog: EditorDialogHandler; // answers cancel/null (TV defEditorDialog)
```

`FindRec = { find: string; options: SearchOptions }`;
`ReplaceRec = FindRec & { replace: string; promptOnReplace: boolean; replaceAll: boolean }`
(the `efXXX` bits as booleans, AC-9 round-trip).

### `dialogs.ts` — decoded builders + PA-7 boxes

```ts
/** PF-002 — ui-local host type (files' ExecHost is NOT importable from ui; do not re-alias it).
 *  The createApplication() handle satisfies both structurally. `desktop.bounds` gives the
 *  desktop extent replacePrompt's PA-11 rect math needs. Exported from the ui barrel. */
export interface EditorDialogHost {
  loop: Pick<EventLoop, 'execView'>;
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;
}
export function findDialog(host: EditorDialogHost, initial?: FindRec): Promise<FindRec | null>;        // 38×12 decode
export function replaceDialog(host: EditorDialogHost, initial?: ReplaceRec): Promise<ReplaceRec | null>; // 40×16 decode
export function confirmBox(host: EditorDialogHost, message: string): Promise<'yes' | 'no' | 'cancel'>;  // PA-7
export function infoBox(host: EditorDialogHost, message: string): Promise<void>;                        // PA-7
export function replacePrompt(host: EditorDialogHost, cursor: Point): Promise<'yes' | 'no' | 'cancel'>; // PA-11 rect math
export function wireEditorDialogs(host: EditorDialogHost, opts?: { saveAs?: (name: string) => Promise<string | null> }): EditorDialogHandler;
```

Builders compose RD-11 `Dialog` + RD-06 controls at the decoded rects (gray-dialog roles);
`replacePrompt` places its box via `DialogOptions.rect` (explicit-rect placement is supported
un-centered, `dialog.ts:42-44` — PF-002); `wireEditorDialogs` is the default full handler the
demos use (`doEditDialog` analogue — `examples/tvedit/tvedit3.cpp:106-193`); messages sanitized.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| No `editorDialog` wired | `defaultEditorDialog` answers cancel — `cmFind` etc. are safe no-ops | AC-8 / PA-17 |
| Undo depth exceeded | Oldest whole steps evicted | AC-6 / PA-1 |
| Redo after fresh edit | Redo branch cleared | AC-6 |
| Empty needle | Search is a no-op (returns miss without the seam round-trip) | AC-8 edge |
| Seam handler throws/rejects | Caught; treated as cancel; loop error-isolation preserved | PA-17 |

## Testing Requirements

- Spec: ST-15…ST-21 (`undo.spec`, `editor-clipboard` cases in `editor.spec`, `search.spec`,
  `editor-dialogs.spec`).
- Impl: coalescing boundaries (case changes, deletes vs inserts), eviction order, prompt-rect math
  at both placements, seam-rejection paths.
