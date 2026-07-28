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

Bracketed paste is a separate direct input path. A decoded bracketed-paste event never calls a
configured native reader, and it retains the terminal decoder's truncation metadata.

## Host behavior

The clipboard model is portable across Windows, macOS, and Linux, but host synchronization depends
on the hosting environment:

- Browser mounts are outbound-only: they write raw text through the browser Clipboard API but do
  not install a native reader. Browsers may require focus, a user gesture, a secure context, or
  clipboard permission. A rejection leaves the JSVision clipboard intact.
- OSC 52 is a capability-gated outbound copy path for native terminals. Terminal emulators,
  multiplexers, and security policies may disable it; OSC 52 does not provide native reads here.
- `Application.run()` enables the operating-system text clipboard by default through a lazy
  `clipboardy` adapter. The dependency is not loaded until the first native copy or paste gesture.
- Direct event-loop hosts can inject raw reader and writer callbacks because they own their runtime
  boundary and do not use `Application.run()`.

This means `Ctrl+C`/`Ctrl+V` is the consistent application command set. Host gestures are aliases
into the same pipeline, not a second clipboard implementation. Terminals commonly own
`Ctrl+Shift+C` and `Ctrl+Shift+V`, so applications must not rely on receiving those shifted
shortcuts.

## Automatic native clipboard and custom adapters

Native terminal applications created with `createApplication()` need no clipboard configuration:

```ts
const app = createApplication();
await app.run(); // Native Ctrl+C/Ctrl+V is enabled by default.
```

Pass `systemClipboard: false` to opt out. App-local copy/paste, terminal bracketed paste, and
capability-gated OSC 52 output remain available:

```ts
const isolatedApp = createApplication({ systemClipboard: false });
```

`writeClipboardText` receives exact raw text after copy or cut commits it to the canonical
app-local clipboard. `readClipboardText` returns exact raw text for an otherwise-unhandled paste
command. Supplying custom callbacks overrides the automatic adapter. Neither callback should
normalize Unicode or line endings.

```ts
import type { CapabilityProfile } from '@jsvision/core';
import { createApplication, createEventLoop } from '@jsvision/ui';

interface HostClipboard {
  read(): Promise<string>;
  write(text: string): Promise<void>;
}

function createClipboardHosts(hostClipboard: HostClipboard, caps: CapabilityProfile) {
  const app = createApplication({
    readClipboardText: () => hostClipboard.read(),
    writeClipboardText: (text) => hostClipboard.write(text),
  });

  const loop = createEventLoop(
    { width: 80, height: 24 },
    {
      caps,
      readClipboardText: () => hostClipboard.read(),
      writeClipboardText: (text) => hostClipboard.write(text),
    },
  );

  return { app, loop };
}
```

Copy and cut are canonical-first: local state commits before host synchronization begins. A host
failure never rolls it back. Native reads start one at a time in gesture order. Gesture dispatch
does not await pending async work; with a non-blocking async adapter, pending reads do not block
input or rendering. A synchronous callback that performs blocking process or filesystem work still
blocks the JavaScript thread, so adapters must use asynchronous host I/O. A result is delivered only
while the original focus route remains continuously valid. Focus or modal changes, unmount/remount,
stop, and dispose make the result stale and discard it.

Successful native text is bounded to a 1 MiB UTF-8 byte prefix without splitting a code point; an
over-cap paste reports truncation. A successful empty read clears canonical state but is a no-op
without editing the focused widget. A read failure emits one payload-free warning and delivers the
current app-local canonical value as the ordered fallback. Clipboard payloads and host error
details are never logged.

The published UI runtime uses `clipboardy` for automatic native terminal integration:

- macOS uses the helpers selected by `clipboardy`, such as `pbcopy` and `pbpaste`.
- Windows uses its PowerShell/native helper path.
- Linux supports X11 and Wayland when the required desktop/session helpers are available.
- Headless and SSH sessions may have no system clipboard. A missing helper leaves the app usable
  through canonical fallback.
- Installations that omit optional dependencies do not include `clipboardy`; the lazy load then
  fails safely and the app continues through canonical fallback.

JSVision does not install platform helpers, alter permissions, retry, or poll. The native adapter
has no timeout; a hung host operation holds later native operations in order while input, rendering,
and application stop remain non-blocking.

## Choose clipboard chords

The application shell installs clipboard chords by default. Choose which sets are bound with
`clipboardKeys` on `createApplication` (or `createEventLoop`):

```ts
import { createApplication } from '@jsvision/ui';

// 'both' (default) = modern Ctrl+A/C/X/V + the classic Ins/Del aliases.
// Use 'modern', 'classic', or 'none' to free keys for your own bindings.
const app = createApplication({ clipboardKeys: 'both' });
```

A user-supplied `keymap` always wins over these defaults on a conflict. To grey a Cut/Copy menu or
status item when nothing is selected, bind the reactive `Input.hasSelection` signal.
