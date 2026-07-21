---
title: Matrix rain
description: The Matrix digital rain as a live windowing desktop — a runnable JSVision example in the browser.
---

# Matrix rain

The famous _Matrix_ "digital rain" as a windowing desktop: three windows, each its own field of
falling green code, on a green-on-black theme. Move, resize, zoom, tile, or cascade them like any
other windows.

One ~12 fps timer bumps a single shared frame counter that every rain field binds to, so one timer
animates all the windows at once — including ones you open later — a small illustration of how
reactive state drives the whole screen from one place. Press **F7** to open another rain window; drag
a title bar to move a window, drag a corner to resize, **F2** to zoom, **F4** / **F5** to tile /
cascade, **F6** for the next window, and **Tab** to cycle focus.

<PlayExample id="apps/matrix" title="Matrix rain" blurb="The Matrix digital rain as a windowing desktop — three fields of falling green code, F7 for more." />
