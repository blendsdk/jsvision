---
title: Split View
description: Arrange resizable row or column panes with SplitView weights, minimum cell constraints, keyboard and captured-pointer resizing, and commit callbacks.
---

# Split View

`SplitView` arranges two or more panes along a row or column and inserts a one-cell `Splitter`
between each pair. A caller-owned `Signal<number[]>` supplies proportional weights; interaction
rewrites it with resolved cell sizes, making persistence and restoration explicit.

Use nested split views to compose editor-style grids without coupling pane content to resize logic.

## Usage

```ts
import { Group, SplitView, signal } from '@jsvision/ui';

const sizes = signal([1, 3]);
const split = new SplitView({
  direction: 'row',
  children: [new Group(), new Group()],
  sizes,
  minSize: [12, 18],
  onResizeEnd: (cells) => saveLayout(cells),
});
```

## Live example

<PlayExample id="containers/split-view" title="Constrained pane laboratory" blurb="Resize a focused divider by keyboard, observe one commit per discrete step, and toggle the live grab mark without rebuilding the panes." />

The two pane faces show their resolved widths, while the external sizes signal shows the values
that can be persisted.

## Props and public state

`SplitView` accepts `SplitViewOptions`:

| Prop          | Type                 | Default | Purpose                                            |
| ------------- | -------------------- | ------- | -------------------------------------------------- |
| `direction`   | `'row' \| 'col'`     | —       | Side-by-side or stacked axis.                      |
| `children`    | `View[]`             | —       | Pane views in order.                               |
| `sizes`       | `Signal<number[]>`   | —       | Caller-owned proportional weights/live cell sizes. |
| `minSize`     | `number \| number[]` | `0`     | Per-pane minimum cell constraints.                 |
| `grabMark`    | `boolean`            | `true`  | Initial midpoint `▓` visibility.                   |
| `onResize`    | `(sizes) => void`    | —       | Every changed drag move or keyboard step.          |
| `onResizeEnd` | `(sizes) => void`    | —       | Once per pointer commit or discrete key step.      |

Public `splitters` exposes the focusable divider views. Public `grabMark` is a live signal that can
show or hide every divider’s midpoint marker. `resizeBy(index, delta)` performs a discrete resize.

## Size and Layout

The assigned rectangle is divided among pane flex weights after reserving one cell per splitter.
Minimums are honored when space permits. If the whole container becomes smaller than the sum of
minimums, panes squeeze proportionally rather than overflow; while squeezed, a divider may have no
space to trade and remains stationary.

Do not pre-position pane children: SplitView owns their main-axis placement and size. Pane interiors
may freely use their own row, column, padding, and child layout.

## Pane sizing and constraints

Initial values are weights, so `[1, 3]` allocates roughly one quarter and three quarters of
available pane space. After interaction, the signal receives resolved cell counts. Writing those
counts into a differently sized view preserves the ratio.

Wrong-length arrays are padded or truncated safely to the pane count. Non-negative minimums clamp
each adjacent resize pair without changing the total available space.

## Resize lifecycle

Focus a divider and use the axis arrows to move it one cell. Pointer down captures the SplitView;
dragging recomputes from the gesture’s starting geometry, and pointer up releases capture.
`onResize` is suitable for live mirrors, while `onResizeEnd` is the persistence boundary.

```ts
import { SplitView } from '@jsvision/ui';

split.resizeBy(0, 1);
split.grabMark.set(false);
```

No-op moves at a constraint fire neither callback, avoiding redundant persistence work.

## Best Practices

- Persist in `onResizeEnd`, not every `onResize` callback.
- Choose minimums from the pane content’s usable lower bound.
- Keep the caller-owned sizes signal near the layout preference it represents.
- Nest split views for grids instead of teaching one instance unrelated two-axis behavior.
- Provide keyboard access to each divider and a visible grab mark in dense layouts.

## Theming

`splitter` paints an idle divider and `splitterDragging` paints captured interaction. Pane content
retains its own roles; the example uses `dialog` surfaces to make the divider boundary clear.
Ensure both splitter states contrast against every adjacent pane theme.

## Related

- [Tabs](/components/containers/tabs) — one visible persistent page at a time.
- [Group](/components/foundations/group) — general child composition.
- [Desktop](/components/application/desktop) — independently managed windows.
- [SplitView API](/api/ui/classes/SplitView) — generated options, callbacks, and methods.
