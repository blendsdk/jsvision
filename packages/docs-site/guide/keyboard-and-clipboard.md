---
title: Keyboard & clipboard
description: Selection and clipboard support across editable JSVision controls, including portable shortcuts and browser or terminal host integration.
---

# Keyboard & clipboard

## Try it

A text editor with the clipboard made visible. Select something in the top window and copy it — it
appears in the **Clipboard** window below. The application event loop owns the canonical plain-text
value; this example projects that value into an editor so you can inspect it. To make edited
projection text canonical, select and copy it normally.

<PlayExample id="apps/editor" title="Editor & clipboard" blurb="A cut-down text editor beside the shared clipboard, shown live as you cut, copy, and paste." />

## The default chords

Editable controls — including `Input`, `Editor`, `Memo`, and `CodeEditor` — use the same clipboard
commands:

- **`Ctrl+A`** select all · **`Ctrl+C`** copy · **`Ctrl+X`** cut · **`Ctrl+V`** paste
- The classic DOS aliases **`Ctrl+Ins`** (copy) / **`Shift+Ins`** (paste) / **`Shift+Del`** (cut)
  work too.
- **`Shift`+arrows** or a mouse drag extend a selection.

Copy and cut first update JSVision's canonical clipboard with the exact selected text, including
Unicode and line endings. JSVision then offers that same raw text to the host. A missing or denied
host clipboard never breaks copying and pasting inside the application.

Host paste gestures, such as browser or terminal **`Ctrl+Shift+V`** and menu paste, deliver text to
JSVision as an external paste event. The event updates the canonical value before the focused
control inserts it, so a later `Ctrl+V` repeats the same text. **`Ctrl+Shift+C`** is a copy alias
when the host delivers it to JSVision; the browser mount routes it deliberately because terminal
frontends commonly reserve that chord for terminal selection.

## Host behavior

The clipboard model is portable across Windows, macOS, and Linux, but host synchronization depends
on the hosting environment:

- Browser mounts write raw text through the browser Clipboard API. Browsers may require focus,
  a user gesture, a secure context, or clipboard permission. A rejection leaves the JSVision
  clipboard intact.
- Native terminal applications write an OSC 52 sequence only when terminal capabilities advertise
  support. Terminal emulators, multiplexers, and security policies may disable it.
- JSVision does not run platform-specific clipboard executables and does not read the native
  operating-system clipboard directly. Native host paste arrives through the terminal's paste
  event.

This means `Ctrl+C`/`Ctrl+V` is the consistent application command set. Host gestures are aliases
into the same pipeline, not a second clipboard implementation.

The application shell installs this by default. Choose which chord sets are bound with
`clipboardKeys` on `createApplication` (or `createEventLoop`):

```ts
import { createApplication } from '@jsvision/ui';

// 'both' (default) = modern Ctrl+A/C/X/V + the classic Ins/Del aliases.
// Use 'modern', 'classic', or 'none' to free keys for your own bindings — e.g. an
// control that needs Ctrl-letter chords sets clipboardKeys: 'none'.
const app = createApplication({ clipboardKeys: 'both' });
```

A user-supplied `keymap` always wins over these defaults on a conflict. To grey a Cut/Copy menu or
status item when nothing is selected, bind the reactive `Input.hasSelection` signal.
