---
title: Keyboard & clipboard
description: Selection and clipboard support across every editable JSVision widget — the default chords, the shared buffer, and how to rebind them.
---

# Keyboard & clipboard

## Try it

A text editor with the clipboard made visible. Select something in the top window and copy it — it
appears in the **Clipboard** window below, because in JSVision the clipboard _is_ an editor. Select
inside that window and paste, and you get exactly what you selected there.

<PlayExample id="apps/editor" title="Editor & clipboard" blurb="A cut-down text editor beside the shared clipboard, shown live as you cut, copy, and paste." />

## The default chords

Every editable widget — `Input`, `Editor`, `Memo`, `ComboBox`, `History`, and anything built on
them — supports selection and clipboard out of the box, with no per-widget wiring:

- **`Ctrl+A`** select all · **`Ctrl+C`** copy · **`Ctrl+X`** cut · **`Ctrl+V`** paste
- The classic DOS aliases **`Ctrl+Ins`** (copy) / **`Shift+Ins`** (paste) / **`Shift+Del`** (cut)
  work too.
- **`Shift`+arrows** or a mouse drag extend a selection.

Copy and cut fill a shared in-app buffer, so text copied in one field pastes into another — or
between an `Input` and an `Editor`. When the terminal supports it, they also write the OS clipboard
(OSC-52). Paste works on every terminal via the in-app buffer; no clipboard _read_ is performed.

The application shell installs this by default. Choose which chord sets are bound with
`clipboardKeys` on `createApplication` (or `createEventLoop`):

```ts
import { createApplication } from '@jsvision/ui';

// 'both' (default) = modern Ctrl+A/C/X/V + the classic Ins/Del aliases.
// Use 'modern', 'classic', or 'none' to free keys for your own bindings — e.g. an
// editor that needs Ctrl-letter chords sets clipboardKeys: 'none'.
const app = createApplication({ clipboardKeys: 'both' });
```

A user-supplied `keymap` always wins over these defaults on a conflict. To grey a Cut/Copy menu or
status item when nothing is selected, bind the reactive `Input.hasSelection` signal.
