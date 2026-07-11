---
title: Editor
description: Editor — a focusable multiline text editor with a modern or WordStar keymap, multi-level undo/redo, a shared clipboard, and find/replace.
---

# Editor

`Editor` is a focusable, scrollable multiline text editor. It has a modern (or classic WordStar)
keymap, multi-level undo/redo, cut/copy/paste through a **shared clipboard**, and find/replace. Add it
to a `Group`, give it a size, and drive it through the event loop or programmatically
(`setText`/`getText`/`insertText`/`execute`). A set of reactive signals — `curPos`, `modified`,
`canUndo`, and more — let you reflect the editor's state in a status line or indicator. For scroll
bars and a `line:col` indicator wired in for you, use [`EditWindow`](/components/editor/edit-window);
to bind the content to a signal inside a dialog, use [`Memo`](/components/editor/memo).

## Usage

```ts
import { Group, Editor, createEventLoop, effect } from '@jsvision/ui';

const editor = new Editor({ clipboard: new Editor() }); // share one hidden editor as the clipboard
const root = new Group();
root.add(editor);

const loop = createEventLoop({ width: 60, height: 20 }, {});
loop.mount(root);
loop.focusView(editor);
editor.setText('The quick brown fox\nSecond line.');

effect(() => {
  const { line, col } = editor.curPos();
  console.log(`caret at ${line}:${col}`);
});
```

## Live example

<PlayComingSoon title="Editor" />

## Props

`new Editor(options)` — every field is optional; a bare `new Editor()` is fully usable.

| Prop           | Type                     | Default    | Description                                                                    |
| -------------- | ------------------------ | ---------- | ------------------------------------------------------------------------------ |
| `clipboard`    | `Editor`                 | —          | The shared clipboard editor. Without one, in-app Cut/Copy/Paste is a no-op.    |
| `keyBindings`  | `'modern' \| 'wordstar'` | `'modern'` | `'modern'` overlays Ctrl+X/C/V/A; `'wordstar'` is the classic WordStar layout. |
| `undoDepth`    | `number`                 | `1000`     | Maximum retained undo steps.                                                   |
| `autoIndent`   | `boolean`                | `false`    | Copy the previous line's leading whitespace on Enter.                          |
| `overwrite`    | `boolean`                | `false`    | Start in overwrite mode (Insert toggles it).                                   |
| `editorDialog` | `EditorDialogHandler`    | cancel-all | Handler for find/replace/save prompts.                                         |
| `commands`     | `EditorCommandSeam`      | —          | Hook for greying out Cut/Copy/Paste as selection/undo state changes.           |

### Reactive state

Subscribe or bind these to reflect the editor in your UI: `modified`, `curPos` (`{line, col}`,
1-based), `hasSelection`, `insertMode`, `lineCount`, `canUndo`, `canRedo`, and `delta` (the
`{x, y}` scroll offset — also the value channel a scroll bar binds to).

### Methods

`setText` / `getText` / `insertText` / `selectionText`, `execute(action)` (run one keymap action —
e.g. `'lineDown'`, `'textEnd'`, `'selectAll'`), `copy` / `cut` / `paste`, `undo` / `redo`, and
`find` / `replace` / `searchAgain` (async, resolve when the interaction is done).

## Keyboard & mouse

The editor claims keys before app chrome (so it can own the WordStar Ctrl-Q / Ctrl-K prefixes). With
the default `'modern'` bindings:

| Input                                 | Result                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| **Arrows / PgUp / PgDn / Home / End** | Move the caret; **Shift** extends the selection.                    |
| **Ctrl+X / Ctrl+C / Ctrl+V**          | Cut / copy / paste through the shared clipboard.                    |
| **Ctrl+A**                            | Select all.                                                         |
| **Insert**                            | Toggle insert / overwrite mode.                                     |
| **Mouse click / drag**                | Place the caret / select; double-click a word, triple-click a line. |
| **Wheel**                             | Scroll the view.                                                    |

Choose `keyBindings: 'wordstar'` for the classic control-key diamond instead.

## Sizing & layout

Give it an absolute rect or a flex size. The editor scrolls its content within that box and keeps the
caret in view; bind a scroll bar to `editor.delta.x` / `editor.delta.y` to scroll it from the side.

## Best practices

- **Share one clipboard editor.** Pass the same hidden `Editor` as every editor's `clipboard` so Cut
  in one and Paste in another work — there is no implicit global clipboard.
- **Drive the UI from the signals.** Read `curPos`/`modified`/`canUndo` in an `effect` or bind them to
  a status line rather than polling the editor.
- **Modern keys are the default.** Ctrl+C is copy, not the WordStar break — a deliberate, documented
  choice. Opt into `'wordstar'` explicitly if you want the classic layout.

## Theming

Text uses the `editorNormal` / `editorSelected` roles (`Memo` overrides them to the gray-dialog
palette).

## Related

- [Edit window](/components/editor/edit-window) — an `Editor` framed with scroll bars + a `line:col` indicator.
- [Memo](/components/editor/memo) — a signal-bound editor for placing inside a dialog.
- [API reference](/api/ui/classes/Editor) — the generated `Editor` signature.
