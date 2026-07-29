---
title: Scroll Bar
description: Bind a passive vertical or horizontal ScrollBar to a numeric signal with clamped arrows, track paging, thumb dragging, and disabled ranges.
---

# Scroll Bar

`ScrollBar` is passive navigation chrome bound two-way to a `Signal<number>`. It paints end arrows,
a page track, and a proportional thumb; mouse and wheel gestures write the signal, while an owning
viewer can drive that same signal from the keyboard.

The bar is intentionally not focusable. Standalone use is appropriate when another component owns
navigation semantics or when a signal already represents a scroll position.

## Usage

```ts
import { ScrollBar, signal } from '@jsvision/ui';

const position = signal(0);
const bar = new ScrollBar({
  value: position,
  min: 0,
  max: 100,
  pageStep: 10,
  orientation: 'vertical',
});
```

## Live example

<PlayExample id="containers/scroll-bar" title="Bound range laboratory" blurb="Compare vertical and horizontal bars sharing one value, move that value externally, and collapse the range into its disabled visual state." />

Both orientations bind to the same source, proving that the signal—not either painted thumb—is the
source of truth.

## Props and public state

`ScrollBar` accepts `ScrollBarOptions`:

| Prop          | Type                         | Default               | Purpose                                                 |
| ------------- | ---------------------------- | --------------------- | ------------------------------------------------------- |
| `value`       | `Signal<number>`             | —                     | Two-way position source.                                |
| `min`         | `number`                     | `0`                   | Inclusive range start.                                  |
| `max`         | `number`                     | `0`                   | Inclusive range end; equal endpoints disable the track. |
| `pageStep`    | `number`                     | axis length minus one | Track-click step.                                       |
| `arrowStep`   | `number`                     | `1`                   | Arrow step; wheel uses three times this value.          |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'`          | Long axis and glyph direction.                          |

`setRange(min, max, pageStep?, arrowStep?)` updates a live range. `pageStep()` and `arrowStep()`
expose the effective increments.

## Size and Layout

A vertical bar needs width `1` and a useful height; a horizontal bar needs height `1` and a useful
width. At least three long-axis cells are needed for two arrows and one track/thumb cell. Longer
tracks represent more distinct positions.

The bar does not calculate a content extent. Its owner must derive and update `max`, usually as
`extent - viewport`. `setRange` repaints only when range values actually change, so it is safe to
call during an owner’s draw pass.

## Range and binding

Every read clamps the external signal into `[min, max]`, preventing a stray caller value from
placing the thumb outside the track. Range collapse paints a disabled track without forcing a
write back into the signal.

```ts
import { ScrollBar, signal } from '@jsvision/ui';

bar.setRange(0, Math.max(0, itemCount - visibleRows), visibleRows - 1);
position.set(12); // both owner and bar observe the same new position
```

This division lets `Scroller` and `ListView` own keyboard behavior while the bar owns pointer
behavior.

## Mouse interaction

Clicking an end arrow moves by `arrowStep`. Clicking either page region moves by `pageStep`, while
pressing the thumb captures the pointer and maps drag movement proportionally into the range.
Wheel input moves by three arrow steps on the matching orientation.

The thumb, page track, and arrows all use the current live range. A disabled bar consumes no
meaningful movement and remains visually stable.

## Best Practices

- Keep navigation keys in the semantic owner rather than making the bar a competing tab stop.
- Derive range limits from live content and viewport measurements.
- Share one signal between the bar and owner; avoid mirroring values in callbacks.
- Use a sufficiently long track when users need precise pointer placement.
- Show a disabled range clearly instead of hiding it when stable layout is important.

## Theming

`scrollBarControls` paints arrows and the `█` thumb. `scrollBarPage` paints the `▒` page track and
the `▓` disabled track. Ensure the thumb contrasts with both enabled and disabled page glyphs in
color and monochrome themes.

## Related

- [Scroller](/components/containers/scroller) — owns bars and two-axis offsets.
- [List View](/components/containers/list-view) — virtual rows with an owned bar.
- [Slider](/components/controls/slider) — focusable value input rather than passive navigation.
- [ScrollBar API](/api/ui/classes/ScrollBar) — generated options and range methods.
