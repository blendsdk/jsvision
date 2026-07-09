---
title: Turbo Vision desktop
description: A full windowing app running in the browser — the flagship live JSVision example.
---

# Turbo Vision desktop

A full Turbo Vision-style desktop application — a menu bar, a status line, a window manager, and two
framed windows — the same `@jsvision/ui` app you would write for a real terminal, running unchanged
in the browser. Press **F10** for the menu, drag a title bar to move a window, drag a corner to
resize, **F5** / **F4** to cascade / tile, **F6** for the next window, and **Tab** to cycle focus.

<PlayExample id="apps/desktop" title="Turbo Vision desktop" blurb="A full windowing app — menu bar, status line, movable/resizable windows — running in the browser." />

## Source

The code below is the exact module the live example above runs — shown code is running code.

<<< @/examples/apps/desktop.ts
