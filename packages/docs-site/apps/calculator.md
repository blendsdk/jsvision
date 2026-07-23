---
title: Calculator
description: A working pocket calculator built from JSVision buttons and a reactive display — a runnable example in the browser.
---

# Calculator

A working pocket calculator: a right-aligned display driven by a grid of push buttons. Click the
keys — or **Tab** to a key and press **Space** / **Enter** — and the display updates. `C` clears, `±`
negates, `%` takes a percentage.

It is deliberately small: a `Text` bound to a `signal` for the display, a `Button` with an `onClick`
per key, and absolute `at()` placement for the grid — no windowing, no app wiring. A good look at the
everyday building blocks before you reach for anything larger.

<PlayExample id="apps/calculator" title="Calculator" blurb="A working pocket calculator — a signal-bound display driven by a grid of push buttons." />
