---
title: Scroller
description: Clip oversized content into a keyboard- and wheel-driven Scroller viewport with owned vertical, horizontal, or dual scroll bars.
---

# Scroller

`Scroller` turns one oversized view into a bounded viewport. It owns the content offset, clips
painting and hit-testing to the visible rectangle, and can compose vertical, horizontal, both, or
no scroll bars. Use it when content has a known two-dimensional extent but does not already own its
own virtual navigation model.

## Usage

```ts
import { Group, Scroller, Text, at } from '@jsvision/ui';

const content = new Group();
for (let row = 0; row < 40; row += 1) {
  content.add(at(new Text(`Row ${row + 1}`), 0, row, 50, 1));
}
const scroller = new Scroller({
  content,
  extent: { width: 50, height: 40 },
  scrollbars: 'both',
});
```

## Live example

<PlayExample id="containers/scroller" title="Two-axis viewport laboratory" blurb="Page through an oversized document, jump to the vertical end, and reveal its far-right columns while the live delta shows both clamped axes." />

The content includes coordinate labels so clipping and movement are observable in the viewport, not
only in the status readout.

## Props and public state

`Scroller` accepts `ScrollerOptions`:

| Prop         | Type                       | Default      | Purpose                                              |
| ------------ | -------------------------- | ------------ | ---------------------------------------------------- |
| `content`    | `View`                     | —            | Oversized child to clip and offset.                  |
| `extent`     | `Size2D \| (() => Size2D)` | —            | Natural content size and scroll limit.               |
| `scrollbars` | `ScrollbarsMode`           | `'vertical'` | `'vertical'`, `'horizontal'`, `'both'`, or `'none'`. |

The read-only `delta` getter exposes the current `{ x, y }` offset. The scroller itself is focusable
and owns navigation; its bars are passive mouse chrome.

## Size and Layout

The scroller’s assigned bounds are the viewport. A vertical bar reserves the rightmost column; a
horizontal bar reserves the bottom row; dual bars also reserve and paint the bottom-right corner.
The remaining cells determine the maximum offsets:

`maxX = extent.width - viewport.width` and `maxY = extent.height - viewport.height`, clamped at zero.

An extent thunk is re-read during drawing, so content can grow or shrink without rebuilding the
container. Keep the returned dimensions finite and consistent with the child’s natural layout.

## Viewport and extent

The content is positioned at `-delta` and clipped by the scroller. Each draw recalculates live
viewport dimensions, clamps offsets, and updates owned bar ranges. Shrinking content below the
viewport disables the corresponding bar instead of allowing stale over-scroll.

```ts
import { Scroller, signal } from '@jsvision/ui';

const extent = signal({ width: 80, height: 200 });
const scroller = new Scroller({
  content,
  extent: () => extent(),
  scrollbars: 'both',
});
```

## Keyboard and wheel scrolling

Arrow keys move one cell on the matching axis. Page Up/Down moves by the visible height minus one,
Home goes to the vertical start, and End goes to the vertical end. Wheel input moves three cells on
the wheel’s axis. Every path clamps to the current extent.

The bars accept pointer input directly and write the same internal offset signals. This keeps
keyboard, wheel, track clicks, and thumb drags synchronized.

## Best Practices

- Use `Scroller` for one bounded oversized canvas; use `ListView`, `Tree`, or Data Grid for
  collection virtualization.
- Provide an extent that describes actual content, not the viewport.
- Focus the scroller when keyboard navigation should take precedence.
- Show positional context inside large content so users know what moved.
- Test both content growth and shrinkage when `extent` is dynamic.

## Theming

The content keeps its own roles. Owned bars use `scrollBarControls` for arrows/thumb and
`scrollBarPage` for tracks and the dual-bar corner. The surrounding `dialog` role in the example
shows why the content background should be explicit rather than relying on whatever lies behind the
viewport.

## Related

- [Scroll Bar](/components/containers/scroll-bar) — standalone passive range control.
- [List View](/components/containers/list-view) — virtual rows with semantic selection.
- [Surface View](/components/surface/surface-view) — surface-backed rendering.
- [Scroller API](/api/ui/classes/Scroller) — generated `ScrollerOptions` and `delta`.
