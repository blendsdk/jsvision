---
title: Data grid
description: A sortable multi-column table — a live, in-browser JSVision example.
---

# Data grid

A sortable, multi-column table over typed rows. Columns mix sizing modes (an auto-width **Name**
capped at 16, fixed **Age** / **Role**, a `1fr` **City**), the Age column **sorts numerically** when
its header is clicked (▲/▼), rows zebra-stripe under a sticky header, and the grid scrolls
horizontally when the columns overflow.

<PlayExample id="table/data-grid" title="Data grid" blurb="A sortable multi-column table: click a header to sort (▲/▼), zebra striping, sticky header, H-scroll." />

## Source

The code below is the exact module the live example above runs — shown code is running code.

<<< @/examples/table/data-grid.ts
