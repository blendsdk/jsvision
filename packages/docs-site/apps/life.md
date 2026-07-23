---
title: Game of Life
description: Conway's Game of Life as a live JSVision desktop app — evolve, draw, and step the board in the browser.
---

# Game of Life

Conway's Game of Life, evolving one generation per frame. **Space** plays and pauses, **S** steps a
single generation while paused, **R** reseeds the board at random, and **C** clears it. **Click or
drag on the board** to draw your own cells — sketch a glider and watch it walk.

The board runs on a toroidal grid (patterns that leave one edge reappear on the opposite one), and
each cell is tinted by age — bright when freshly born, cooling as it survives — so oscillators and
gliders are easy to follow. Under the hood it is one custom `View`: typed-array state, a per-frame
step gated by a `playing` signal, and mouse handling for the drawing.

<PlayExample id="apps/life" title="Game of Life" blurb="Conway's Game of Life — Space plays/pauses, S steps, R reseeds, C clears; click the board to draw." />
