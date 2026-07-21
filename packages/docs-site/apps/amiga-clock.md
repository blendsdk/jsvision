---
title: Amiga clock
description: A desktop of live animated clocks — analog, digital, and the bouncing Amiga boing ball — a runnable JSVision example in the browser.
---

# Amiga clock

A little desktop of clocks, all live: an analog Workbench-style face, a big block-glyph digital
readout with a blinking colon, the bouncing Amiga **boing** ball with the time overlaid, and a fourth
window that nests all three in a draggable split grid. Every window moves, resizes, zooms, and closes
like any other — the standard windowing shell, running unchanged in the browser.

A single ~12 fps timer drives two signals — a frame counter for the spin and bounce, and the current
time — and the reactive views bound to them repaint themselves; nothing redraws by hand. Drag a title
bar to move a window, drag a corner to resize, **F2** to zoom, **F4** / **F5** to tile / cascade,
**F6** for the next window, and **Tab** to cycle focus.

<PlayExample id="apps/amiga-clock" title="Amiga clock" blurb="A desktop of live clocks — analog, digital, and the bouncing Amiga boing ball — each in its own window." />
