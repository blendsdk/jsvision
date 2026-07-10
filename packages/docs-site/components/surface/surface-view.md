---
title: Surface view
description: SurfaceView — a passive scrollable window onto an offscreen Surface buffer; pan it by writing its delta signal.
---

# Surface view

`SurfaceView` is a passive viewport that shows a scrollable window onto a **`Surface`** — an offscreen
cell buffer you draw into once. Use it when the content is bigger than the space you can give it: a
wide canvas, a diagram, a zoomable map. The view takes **no input of its own**; you scroll it by
writing its `delta` signal (for example, bind a [`ScrollBar`](/components/containers/scroll-bar)'s
`value` to it, or call `scrollTo`/`panBy`). It paints the visible slice of the surface plus the empty
bands around it, and repaints automatically when the surface is panned, swapped, or its content
changes.

## Usage

```ts
import { Group, Surface, SurfaceView, signal } from '@jsvision/ui';

// A canvas larger than the viewport that will display it.
const surface = new Surface({ size: { x: 96, y: 36 } });
const ctx = surface.getDrawContext();
ctx.text(2, 1, 'Hello from the offscreen canvas', { fg: 'brightCyan', bg: 'default' });

// Show a scrollable window onto it; write `delta` to pan.
const delta = signal({ x: 0, y: 0 });
const view = new SurfaceView({ surface, delta });
view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 12 } };

const group = new Group();
group.add(view);
view.panBy(8, 0); // scroll right, clamped to keep the surface in view
```

## Live example

<PlayComingSoon title="Surface view" />

## Props

`new SurfaceView(options)`.

| Prop       | Type                     | Default         | Description                                                                    |
| ---------- | ------------------------ | --------------- | ------------------------------------------------------------------------------ |
| `surface`  | `SurfaceSource`          | —               | The bound surface: a `Surface`, `null`, or a `() => Surface \| null` accessor. |
| `delta`    | `Signal<Point>`          | `signal({x,y})` | Two-way scroll offset `{x, y}`; the caller drives it.                          |
| `onScroll` | `(delta: Point) => void` | —               | Fired when `delta` changes (skips the initial value + same-coordinate writes). |

`SurfaceSource = Surface | null | (() => Surface | null)` — pass an accessor to swap the surface live.

### The backing `Surface`

`new Surface({ size, theme?, caps?, fill? })` is the offscreen buffer the view displays.

| Member                     | Description                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `getDrawContext(over?)`    | The primary paint facade — the same `DrawContext` a `View.draw` receives.          |
| `set(x, y, char, style)`   | Write one glyph (out-of-bounds is a no-op; control bytes are sanitized).           |
| `at(x, y)`                 | Read a cell as a **read-only frozen copy**, or `undefined` out of bounds.          |
| `resize(size)` / `grow(d)` | Resize, **preserving the overlapping region** and blanking the newly-exposed area. |
| `clear(style?)`            | Blank every cell to a space.                                                       |
| `Surface.from(rows)`       | Build a surface sized to fit an array of text rows.                                |
| `buffer`                   | The raw core `ScreenBuffer` escape hatch — poke it, then call `invalidate()`.      |

Every write bumps an internal version counter, so a bound `SurfaceView` repaints on its own.

## Keyboard & mouse

`SurfaceView` is passive — `focusable` is `false` and it handles no keyboard or mouse input. Drive it
from the outside:

| Method                 | Result                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| `scrollTo(target)`     | Scroll so `target` becomes the top-left, **clamped** to keep the surface in view. |
| `panBy(dx, dy)`        | Pan by a delta from the current offset (clamped).                                 |
| Write `delta` directly | Scroll without the clamp — lets you scroll past the surface edge.                 |

## Sizing & layout

Give the view an absolute rect (or a flex size); it shows exactly that window onto the surface. When
the surface is smaller than the view, or scrolled partly off, the uncovered area is filled with
spaces in the inactive-window colour. A wide glyph that would be split by a viewport edge is dropped
whole rather than leaving a half cell.

## Best practices

- **Draw the surface once, pan cheaply.** The whole point is to author a large buffer a single time
  and move a small window over it — panning never redraws the content, it re-slices it.
- **Clamp with the helpers.** `scrollTo`/`panBy` keep the surface in view; only write `delta`
  directly when you deliberately want to over-scroll past the edge.
- **Swap surfaces with an accessor.** Pass `surface: () => current()` so changing the accessor's
  signal swaps the displayed buffer and repaints in one coalesced frame.

## Theming

The empty bands around the surface use the `windowInactive` role; the surface cells keep whatever
colors you drew into them.

## Related

- [Scroll bar](/components/containers/scroll-bar) — bind its `value` to the view's `delta` to scroll.
- [Scroller](/components/containers/scroller) — scrolls a live child view, rather than an offscreen buffer.
