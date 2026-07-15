<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Text editing

The multi-line `Editor`, `Memo`, and edit-window chrome.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## confirmBox

Show a modal message with Yes / No / Cancel buttons.

```ts
confirmBox(host: EditorDialogHost, message: string): Promise<'yes' | 'no' | 'cancel'>
```

## defaultEditorDialog

A no-op dialog handler that cancels every prompt (find/replace return `null`, confirmations return `'cancel'`).

```ts
const defaultEditorDialog: EditorDialogHandler
```

## Editor

A focusable, scrollable multiline text editor.

```ts
new Editor(options: EditorOptions = {})   // extends View
// methods & signals:
modified: Signal<boolean>
curPos: Signal<{ line: number; col: number }>
hasSelection: Signal<boolean>
insertMode: Signal<boolean>
lineCount: Signal<number>
canUndo: Signal<boolean>
canRedo: Signal<boolean>
delta: { readonly x: Signal<number>; readonly y: Signal<number> }
eolKind: LineEnding
curPtr
selEndP
selecting
overwrite: boolean
autoIndentOn: boolean
curY
drawLine
drawPtrP
limitY
keyBindings: EditorKeyBindings
options: EditorOptions
undoStack: UndoStack
vBar: GadgetBar | null
indicator: IndicatorTarget | null
setText(text: string): void
getText(range?: { from: number; to: number }): string
insertText(text: string): void
selectionText(): string
execute(action: EditorAction): void
attachGadgets(h?: GadgetBar, v?: GadgetBar, ind?: IndicatorTarget): void
replaceStr
searchOpts: SearchOptions
promptOnReplace
replaceAllFlag
doReplace
find(): Promise<void>
replace(): Promise<number>
searchAgain(): Promise<number>
searchOnce(): boolean
doSearchReplace(): Promise<number>
copy(): void
cut(): void
paste(): void
undo(): void
redo(): void
viewH(): number
deleteSelect(): void
toggleInsMode(): void
scrollTo(x: number, y: number): void
getMousePtr(local: Point): number
```

## EditorAction

An internal editor action id — a camelCase name for one editor operation.

```ts
type EditorAction = | 'charLeft'
  | 'charRight'
  | 'wordLeft'
  | 'wordRight'
  | 'lineStart'
  | 'lineEnd'
  | 'lineUp'
  | 'lineDown'
  | 'pageUp'
  | 'pageDown'
  | 'textStart'
  | 'textEnd'
  | 'newLine'
  | 'backSpace'
  | 'delChar'
  | 'delWord'
  | 'delWordLeft'
  | 'delStart'
  | 'delEnd'
  | 'delLine'
  | 'toggleInsert'
  | 'toggleIndent'
  | 'startSelect'
  | 'hideSelect'
  | 'selectAll'
  | 'clear' // delete the selection; reached by menu/command, no direct key
  | 'cut'
  | 'copy'
  | 'paste'
  | 'find'
  | 'replace'
  | 'searchAgain'
  | 'undo'
  | 'redo'
```

## EditorCommands

The app-level editor command names.

```ts
const EditorCommands: { readonly find: "find"; readonly replace: "replace"; readonly searchAgain: "searchAgain"; readonly clear: "clear"; }
```

## EditorCommandSeam

Optional hook for greying out menu/status commands (Cut, Copy, Paste, …) as the editor's state changes.

```ts
interface EditorCommandSeam {
  enable(command: string, enabled: boolean): void;   // Enable or disable a command by name; wire this to your app's command registry.
}
```

## EditorDialogHandler

One async handler that answers every editor prompt.

```ts
type EditorDialogHandler = (req: EditorDialogRequest) => Promise<EditorDialogResult>
```

## EditorDialogHost

What the dialog builders need from the host to run a modal — the shared `{ loop, desktop }` seam.

```ts
type EditorDialogHost = ModalDialogHost
```

## EditorDialogRequest

One request the editor sends through the seam, as a discriminated union on `kind`.

```ts
type EditorDialogRequest = | { kind: 'find'; rec: FindRec }
  | { kind: 'replace'; rec: ReplaceRec }
  | { kind: 'replacePrompt'; cursor: Point }
  | { kind: 'searchFailed' }
  | { kind: 'saveModify'; name: string }
  | { kind: 'saveUntitled' }
  | { kind: 'saveAs'; name: string }
  | { kind: 'readError' | 'writeError' | 'createError' | 'outOfMemory'; name?: string }
```

## EditorDialogResult

The handler's typed answer, matched to the request `kind`.

```ts
type EditorDialogResult = | { kind: 'find'; rec: FindRec | null }
  | { kind: 'replace'; rec: ReplaceRec | null }
  | { kind: 'confirm'; answer: 'yes' | 'no' | 'cancel' }
  | { kind: 'path'; path: string | null }
  | { kind: 'ok' }
```

## EditorKeyBindings

Which editor key set is active.

```ts
type EditorKeyBindings = 'modern' | 'wordstar'
```

## EditorOptions

Construction options for Editor.

```ts
interface EditorOptions {
  clipboard?: Editor;   // The shared clipboard editor. There is no implicit default: without one, in-app Cut/Copy/Paste between editors is a no-op. Pass the same `Editor` instance to every editor that should share a clipboard (typically a single hidden editor).
  editorDialog?: EditorDialogHandler;   // Handler for find/replace/save prompts. Defaults to a handler that cancels every prompt.
  undoDepth?: number;   // Maximum retained undo steps (default 1000).
  autoIndent?: boolean;   // Copy the previous line's leading whitespace when pressing Enter (default false).
  overwrite?: boolean;   // Start in overwrite mode; Insert toggles it (default false = insert mode).
  commands?: EditorCommandSeam;   // Hook for greying out editing commands as selection/undo state changes (default: none).
  keyBindings?: EditorKeyBindings;   // Editor key set — `'modern'` (default) overlays Ctrl+X/C/V/A; `'wordstar'` = the classic WordStar layout.
}
```

## EditWindow

A blue editor window: an Editor framed by a movable/resizable window, with a vertical and horizontal scroll bar and a `line:col` indicator wired in.

```ts
new EditWindow(options: EditWindowOptions = {})   // extends Window
// methods & signals:
editor: Editor
onResized(): void
zoom(): void
```

## EditWindowOptions

Options for EditWindow.

```ts
interface EditWindowOptions {
  rect?: Rect;   // The initial window rect. Prefer setting it here rather than assigning `layout.rect` after construction: the window pins its scroll bars against this rect on the first layout, and a post-construction assignment can leave one stale frame painted before the window re-pins.
  editor?: Editor;   // The editor to host (e.g. a file-backed editor, or the shared clipboard editor). Omit for a plain `Editor`.
  clipboard?: Editor;   // The shared clipboard editor — passed to a default-constructed editor, and used for the "Clipboard" title.
  editorDialog?: EditorDialogHandler;   // The find/replace/save dialog handler for a default-constructed editor.
}
```

## findDialog

Open the Find dialog — a text field with "Case sensitive" and "Whole words only" checkboxes.

```ts
findDialog(host: EditorDialogHost, initial?: FindRec): Promise<FindRec | null>
```

## FindRec

What the user entered in the Find dialog.

```ts
interface FindRec {
  find: string;   // The text to search for.
  options: SearchOptions;   // The match options.
}
```

## Indicator

The `line:col` status strip shown in an editor window's bottom border.

```ts
new Indicator()   // extends View
// methods & signals:
setValue(pos: { line: number; col: number }, modified: boolean): void
```

## IndicatorTarget

What the editor needs from a line/column indicator; the `Indicator` view satisfies it.

```ts
interface IndicatorTarget {
  setValue(pos: { line: number; col: number }, modified: boolean): void;   // Push the caret position (1-based `line`/`col`) and the modified flag to display.
}
```

## infoBox

Show a modal message with a single OK button.

```ts
infoBox(host: EditorDialogHost, message: string): Promise<void>
```

## LineEnding

A buffer's line-ending kind.

```ts
type LineEnding = 'lf' | 'crlf' | 'cr'
```

## Memo

A dialog-embeddable, signal-bound multiline editor.

```ts
new Memo(options: MemoOptions)   // extends Editor
```

## MemoOptions

Options for Memo.

```ts
interface MemoOptions {
  value: Signal<string>;   // The two-way bound content: edits write it; writing it from outside replaces the buffer.
}
```

## replaceDialog

Open the Replace dialog — find + replace fields plus "Case sensitive", "Whole words only", "Prompt on replace", and "Replace all" checkboxes.

```ts
replaceDialog(host: EditorDialogHost, initial?: ReplaceRec): Promise<ReplaceRec | null>
```

## replacePrompt

Show the "replace this occurrence?" prompt (Yes / No / Cancel) used during an interactive replace.

```ts
replacePrompt(host: EditorDialogHost, cursor: Point): Promise<'yes' | 'no' | 'cancel'>
```

## ReplaceRec

What the user entered in the Replace dialog.

```ts
interface ReplaceRec {
  replace: string;   // The replacement text.
  promptOnReplace: boolean;   // Ask for confirmation before each replacement when `true`.
  replaceAll: boolean;   // Replace every match without stopping when `true`.
}
```

## SearchOptions

Options controlling how a literal search matches.

```ts
interface SearchOptions {
  caseSensitive: boolean;   // Match case exactly when `true`.
  wholeWords: boolean;   // Match only whole words (a match flanked by word characters is skipped) when `true`.
}
```

## wireEditorDialogs

Build a complete `editorDialog` handler backed by the dialogs in this module — Find, Replace, the replace prompt, "not found", the save-confirmation prompts, and file-error boxes.

```ts
wireEditorDialogs(host: EditorDialogHost, opts?: { saveAs?: (name: string) => Promise<string | null> }): EditorDialogHandler
```
