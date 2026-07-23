---
title: Scroller
description: Scroller — a focusable viewport that clips and pans an oversized content view, with auto-owned scroll bar(s) in the reserved edges.
---

# Scroller

`Scroller` is a scrolling viewport over an oversized content view: a `Group` that clips a larger child
to its own bounds and pans it, with one auto-owned [`ScrollBar`](/components/containers/scroll-bar) per
requested axis drawn in the reserved edge cells (vertical → rightmost column, horizontal → bottom row).
It is **focusable** and scrolls from the keyboard and wheel; the owned bars can also be dragged or
clicked directly, sharing the same scroll-offset signals.

## Usage

```ts
import { Scroller, Group, Text, signal } from '@jsvision/ui';

const content = new Group();
for (let i = 0; i < 40; i += 1) {
  const line = new Text(`Line ${i + 1}`);
  line.setLayout({ position: 'absolute', rect: { x: 0, y: i, width: 30, height: 1 } });
  content.add(line);
}
// The content is laid out to its FULL extent (40 rows), not the 8-row viewport — otherwise there
// is nothing to scroll.
const scroller = new Scroller({ content, extent: { width: 30, height: 40 }, scrollbars: 'vertical' });
scroller.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 8 } });
// loop.focusView(scroller) — then PgDn / ↓ reveal the lower lines.
```

## Live example

<PlayComingSoon title="Scroller" />

## Props

`new Scroller(options)`.

| Prop         | Type                                             | Default      | Description                                                                |
| ------------ | ------------------------------------------------ | ------------ | -------------------------------------------------------------------------- |
| `content`    | `View`                                           | —            | The oversized content view (clipped to the viewport, offset `-delta`).     |
| `extent`     | `Size2D \| (() => Size2D)`                       | —            | The content's natural size = the scroll limit; a thunk re-reads each draw. |
| `scrollbars` | `'vertical' \| 'horizontal' \| 'both' \| 'none'` | `'vertical'` | Which owned bars to create (reserving an edge each).                       |

## Keyboard & mouse

| Input                  | Result                                                     |
| ---------------------- | ---------------------------------------------------------- |
| **↑ / ↓**              | Scroll the y axis by ±1.                                   |
| **← / →**              | Scroll the x axis by ±1.                                   |
| **PgUp / PgDn**        | Scroll the y axis by ±(viewport height − 1).               |
| **Home / End**         | Jump to the top / bottom of the y axis.                    |
| **Wheel**              | Scroll by ±3 (up/down, or left/right).                     |
| **Drag / click** a bar | Move that axis directly (the owned bars share the offset). |

## Sizing & layout

The content view **must be laid out to its full `extent`** (it is drawn shifted by `-delta` and
clipped to the viewport), not to the viewport. Give the `Scroller` its own bounds via an absolute
`rect` or a flex slot; each requested bar reserves an edge (the vertical bar the rightmost column, the
horizontal bar the bottom row), so the usable viewport is the bounds minus those edges. The offset is
clamped to `[0, extent − viewport]` per axis, so it never over-scrolls.

## Best practices

- **Size the content to the extent, not the viewport.** This is the one footgun: lay the content out
  to its full `extent` (a 40-row list is 40 rows tall) or there is nothing to pan.
- **Use a thunk for dynamic content.** Pass `extent: () => currentSize()` when the content grows or
  shrinks — it is re-read on every draw, so the bars re-range and the clamp stays correct.
- **Reach for a purpose-built viewer when one fits.** A list of rows is better served by
  [`List box`](/components/containers/list-box), an outline by [`Tree`](/components/containers/tree);
  `Scroller` is for arbitrary oversized content.

## Theming

`Scroller` adds no roles of its own — it paints through its owned bars:

| Role                | Applies to                                           |
| ------------------- | ---------------------------------------------------- |
| `scrollBarControls` | The arrows and thumbs of the owned bars              |
| `scrollBarPage`     | The bar page tracks and the bottom-right corner cell |

## Related

- [Scroll bar](/components/containers/scroll-bar) — the passive bar a Scroller owns.
- [List box](/components/containers/list-box) — a virtual-scroll list of rows.
- [Tree](/components/containers/tree) — a scrolling, expandable outline.
- [API reference](/api/ui/classes/Scroller) — the generated `Scroller` signature.
