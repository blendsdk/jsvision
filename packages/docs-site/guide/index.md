---
title: Guide
description: Learn JSVision — installation, core concepts, and building your first terminal application.
---

# Guide

The JSVision guide walks you from a first install to a full classic terminal-UI application.

> **Placeholder.** The Getting Started walkthrough, core concepts, and tutorials land in a later
> milestone. This page exists so the navigation skeleton has no dead links.

## A first taste

Detect what the terminal can do, then adapt — the engine is pure, so this runs the same everywhere:

```ts
import { resolveCapabilities } from '@jsvision/core';

const { profile } = resolveCapabilities();

console.log(`Colour depth: ${profile.colorDepth}`);
console.log(`Unicode:      ${profile.unicodeLevel}`);
```

Copy the snippet with the button in its top-right corner, paste it into a TypeScript project that
depends on `@jsvision/core`, and run it.

## Keyboard & clipboard

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
