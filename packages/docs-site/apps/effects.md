---
title: Starfield, plasma & fire
description: A full-screen truecolor effects canvas — flying starfield, plasma, and fire — a runnable JSVision example in the browser.
---

# Starfield, plasma & fire

A full-screen canvas running one of three animated effects, each drawn cell by cell in truecolor: a
flying **starfield**, a sinusoidal **plasma** field, and a bottom-up **fire**. Press **1**, **2**, or
**3** to pick one, or **Space** to cycle.

There is no image and no shader here — every cell's colour is computed per frame and handed to the
engine as a `#rrggbb` value, which then downsamples it to whatever the terminal actually supports
(256 colours, 16, or monochrome). So this doubles as a live stress test of two things at once: the
colour engine, and the damage-diff renderer that repaints only the cells that changed.

<PlayExample id="apps/effects" title="Starfield, plasma & fire" blurb="A full-screen truecolor effects canvas — flying starfield, plasma, and fire; 1/2/3 to pick, Space to cycle." />
