---
title: Editor & clipboard
description: A pared-back text editor beside the shared clipboard, shown live — a runnable JSVision example in the browser.
---

# Editor & clipboard

A text editor with the clipboard made visible: type and select in the top window, and whatever you
cut or copy appears in the **Clipboard** window below. That second window is not a preview — it hosts
the clipboard, which in JSVision is itself an editor, so you can select inside it and paste exactly
what you selected.

Pared back to the clipboard story on purpose: there is no file handling and no find/replace, so
nothing here needs a file system.

Try **Shift**+arrows or a mouse drag to select, then **Ctrl+C** / **Ctrl+X** / **Ctrl+V** — or the
classic **Ctrl+Ins** / **Shift+Ins** / **Shift+Del**. **Ctrl+Z** undoes, **Ctrl+Y** redoes.

<PlayExample id="apps/editor" title="Editor & clipboard" blurb="A cut-down text editor beside the shared clipboard, shown live as you cut, copy, and paste." />
