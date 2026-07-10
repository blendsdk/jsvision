---
title: Scroll bar
description: ScrollBar — passive mouse-driven chrome (arrows, page track, proportional thumb) bound to a number signal; a container owns the keys.
---

# Scroll bar

`ScrollBar` is passive chrome: two end arrows, a shaded page track, and a proportional thumb, driven
entirely by the **mouse**. Its position is a two-way `Signal<number>` clamped to `[min, max]` —
reading it renders the thumb, gestures write it back. It is **not** focusable and owns **no**
keyboard; a container such as [`Scroller`](/components/containers/scroller),
[`List box`](/components/containers/list-box), or [`Tree`](/components/containers/tree) owns the keys
and drives the same `value` signal. When `max === min` the bar is disabled and the whole track draws
with the disabled glyph.

## Usage

```ts
import { ScrollBar, signal } from '@jsvision/ui';

const pos = signal(0);
const bar = new ScrollBar({ value: pos, min: 0, max: 100, orientation: 'vertical' });
// Click an arrow to step, click the track to jump the thumb there, drag the thumb, or wheel to move
// by 3× the arrow step. pos.set(50) scrolls it externally — the thumb re-renders halfway down.
```

## Live example

<PlayComingSoon title="Scroll bar" />

## Props

`new ScrollBar(options)`.

| Prop          | Type                         | Default       | Description                                                     |
| ------------- | ---------------------------- | ------------- | --------------------------------------------------------------- |
| `value`       | `Signal<number>`             | —             | Two-way position; reading renders the thumb, gestures write it. |
| `min`         | `number`                     | `0`           | Range minimum.                                                  |
| `max`         | `number`                     | `0`           | Range maximum; `0` (⇒ `max === min`) disables the bar.          |
| `pageStep`    | `number`                     | axis length−1 | Track-click / page step.                                        |
| `arrowStep`   | `number`                     | `1`           | Arrow-click step; the wheel steps `3 × arrowStep`.              |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'`  | The long axis (arrows `▲▼` vs `◄►`).                            |

## Keyboard & mouse

The bar owns **no keyboard** — the focusable container that hosts it does.

| Input                    | Result                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| **Click** an end arrow   | Step by `arrowStep`.                                                 |
| **Click** the page track | Jump the thumb to that cell, then drag from there (pointer capture). |
| **Drag** the thumb       | Track the pointer continuously.                                      |
| **Wheel**                | Step by `3 × arrowStep`.                                             |

## Sizing & layout

`ScrollBar` has no `measure()` — give it bounds, either an absolute `rect` or a fixed 1-cell band in a
flex row/column (a container reserves the rightmost column for a vertical bar, the bottom row for a
horizontal one). The cross axis is 1 cell; the long axis is never shorter than 3 (an arrow at each end
plus at least one track cell). Call `setRange(min, max, pageStep?, arrowStep?)` to re-limit it at
runtime when the viewport or content extent changes.

## Best practices

- **You rarely build one directly.** `Scroller`, `ListView`/`ListBox`, and `Tree` each own a
  `ScrollBar` and wire it for you. Reach for a standalone bar only when you own a custom viewport.
- **Share one signal.** Bind the bar's `value` to the same signal that offsets your content, so a
  drag and a keyboard scroll move in lockstep.
- **Let `max === min` disable it.** A fully-visible content extent needs no scrolling; leaving `max`
  at `0` draws the greyed, inert `▓` track automatically.

## Theming

| Role                | Applies to                             |
| ------------------- | -------------------------------------- |
| `scrollBarControls` | The `▲▼`/`◄►` end arrows and the thumb |
| `scrollBarPage`     | The `▒` page track (and `▓` disabled)  |

Both default to cyan on blue.

## Related

- [Scroller](/components/containers/scroller) — a focusable viewport that owns bar(s) for you.
- [List box](/components/containers/list-box) — a virtual-scroll list with an owned bar.
- [Tree](/components/containers/tree) — an outline with an owned bar.
