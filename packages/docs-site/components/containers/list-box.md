---
title: List box
description: A virtual-scroll list with type-ahead — a live, in-browser JSVision example.
---

# List box

A virtual-scroll list with keyboard navigation and type-ahead. Arrow keys / **PgUp** / **PgDn** move
the highlight, **Enter** or a click selects a row, and typing a prefix jumps to the next match. The
owned scroll bar tracks the focused row; the echo shows the focused and selected items.

<PlayExample id="containers/list-box" title="List box" blurb="A virtual-scroll list with type-ahead: arrows / PgDn move, Enter selects, type a prefix to jump." />

## Source

The code below is the exact module the live example above runs — shown code is running code.

<<< @/examples/containers/list-box.ts
