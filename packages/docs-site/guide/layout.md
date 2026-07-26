---
title: Layout
description: Placing views on screen with the flex layout engine — col/row, sizing, the at() escape hatch, and the collapse footguns.
---

# Layout

Placing views on screen with the flex layout engine — `col`/`row`, sizing, the `at()` escape hatch, and the collapse footguns.

::: info This guide is being written
This page is a placeholder while the guide is authored. Follow its progress — and the outline of
what it will cover — in [issue #146](https://github.com/blendsdk/jsvision/issues/146).
:::

## Translated action groups

Do not guess widths for translated dialog actions. A `Button` measures its natural caption in
terminal display cells, so wide glyphs, combining characters, and accelerator markup are handled
consistently. Use `measureButtonGroup()` to negotiate the viewport minimum for the complete action
set, then pass the same unattached Buttons and options to `buttonGroup()`.

Group measurement uses the widest sibling for equal button widths. `maxColumns` preserves
row-major ordering while wrapping equal-width buttons across multiple rows; use `buttonColumn()`
for a vertical action set. When the preferred width does not fit, first expand the dialog or reduce
`maxColumns`. An absolute rectangle remains a hard clipping bound at the terminal edge.

See [Button sizing and layout](/components/controls/button#sizing-layout) for a copyable example and
the single-parent ownership rule.
