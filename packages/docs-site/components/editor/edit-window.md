---
title: Edit window
description: EditWindow — a blue movable/resizable window framing an Editor with scroll bars and a line:col indicator.
---

# Edit window

`EditWindow` is a blue editor window: an [`Editor`](/components/editor/editor) framed by a
movable/resizable [`Window`](/components/containers/dialog), with a vertical and horizontal
[`ScrollBar`](/components/containers/scroll-bar) and a `line:col`
[`Indicator`](/components/editor/edit-window) wired in. It enforces a minimum size of 24×6 and
repositions its scroll bars and indicator whenever it is resized or zoomed. The scroll bars and
indicator show only while the window is active; an inactive window shows a plain frame. Add it to a
desktop and it behaves like any other window.

## Usage

```ts
import { createApplication, EditWindow, Editor } from '@jsvision/ui';

const app = createApplication({ caps });

// A shared clipboard editor, plus a document window that shares it.
const clipboard = new Editor();
const win = new EditWindow({
  clipboard,
  rect: { x: 2, y: 1, width: 48, height: 14 },
});
app.desktop.addWindow(win);
win.editor.setText('Hello, world!');
```

## Live example

<PlayComingSoon title="Edit window" />

## Props

`new EditWindow(options)`.

| Prop           | Type                  | Default        | Description                                                                        |
| -------------- | --------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `rect`         | `Rect`                | —              | Initial window rect. Prefer setting it here — the window pins its bars against it. |
| `editor`       | `Editor`              | a new `Editor` | The editor to host (e.g. a file-backed one). Omit for a plain `Editor`.            |
| `clipboard`    | `Editor`              | —              | Shared clipboard editor; also drives the `"Clipboard"` title when it is the host.  |
| `editorDialog` | `EditorDialogHandler` | —              | Find/replace/save handler for a default-constructed editor.                        |

The hosted editor is exposed as `win.editor`. The title reads `"Clipboard"` when the window hosts the
shared clipboard editor, otherwise `"Untitled"` (a file loader can retitle it via the reactive title
signal).

### The `Indicator` strip

`Indicator` is the passive `line:col` strip in the window's bottom border. It shows the caret's
1-based line/column and a `*` when the document has unsaved changes; it fills with a double line at
rest and a single line while the window is dragged. `EditWindow` creates and positions one for you.

## Keyboard & mouse

Inside the frame, all [`Editor`](/components/editor/editor#keyboard-mouse) input applies. The window
chrome adds the usual move (drag the title), resize (drag the corner), and zoom controls; the scroll
bars scroll the editor with the mouse.

## Sizing & layout

Set the initial size through `rect` rather than assigning `layout.rect` after construction — the
window pins its scroll bars against the rect on the first layout, and a post-construction assignment
can leave one stale frame painted before it re-pins. The minimum size is 24×6.

## Best practices

- **Set `rect` in the constructor.** It avoids the one-frame stale-scroll-bar glitch that a later
  `layout.rect` assignment can cause.
- **Share the clipboard across windows.** Pass the same `clipboard` editor to every `EditWindow` so
  Cut/Copy/Paste works between documents.
- **Reach the editor via `win.editor`.** Load text, read `curPos`/`modified`, or run `execute` on the
  hosted editor directly.

## Theming

The blue window frame uses the window roles; the hosted editor uses the `editorNormal` /
`editorSelected` roles, and the indicator uses `indicatorNormal` / `indicatorDragging`.

## Related

- [Editor](/components/editor/editor) — the editor this window hosts.
- [Memo](/components/editor/memo) — a signal-bound editor for a dialog, without window chrome.
- [Scroll bar](/components/containers/scroll-bar) — the bars framing the editor.
