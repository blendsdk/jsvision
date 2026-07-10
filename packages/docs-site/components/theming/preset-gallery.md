---
title: Theme gallery
description: Themed widgets that repaint on a live theme or depth switch — a live, in-browser JSVision example.
---

# Theme gallery

A small panel of themed widgets — buttons in every state, a text input, a checkbox group, and a
radio group — all drawn in the application's theme roles. Switch the **Theme** (13 presets) or the
colour **Depth** from the **View** menu and every widget repaints live: theme swaps are one
recompose, a depth change re-mounts to downsample the palette (truecolor → 256 → 16 → mono).

<PlayExample id="theming/preset-gallery" title="Theme gallery" blurb="A panel of themed widgets — switch Theme or Depth from the View menu to watch them repaint." />

## Source

The composition running above — the exact `build()` from the module:

<<< @/examples/theming/preset-gallery.ts#example{ts}

::: details Full module (imports, JSDoc, data)

<<< @/examples/theming/preset-gallery.ts

:::
