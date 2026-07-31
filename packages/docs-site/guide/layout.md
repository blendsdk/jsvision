---
title: Layout
description: A beginner-to-advanced course on composing responsive terminal-cell JSVision interfaces with rows, columns, sizing, spacing, alignment, overlays, and exact placement.
---

# Layout

Layout turns a tree of views into rectangles on the terminal screen. JSVision gives you a
cell-native flex layout for the everyday work and a small set of overlay and absolute-placement
tools for the places where normal flow is not enough.

This guide starts with a two-pane screen and builds toward nested responsive workspaces, precise
overlays, resize-safe composition, and the failure modes that cause views to collapse or clip. The
examples use the declarative helpers exported from `@jsvision/ui`; they build ordinary `Group` and
`View` objects, so there is no second layout runtime to learn.

## Who this course is for

This course is for developers who have completed [Install & packages](/guide/install-and-packages)
and can already create a Node 22+ ESM project. No previous terminal-layout experience is required.

By the end, you should be able to:

- build a responsive screen from nested rows and columns;
- explain how auto, fixed, fractional, spacing, and alignment rules become cell rectangles;
- diagnose collapsed, clipped, overlapping, and translation-sensitive layouts; and
- verify flow and overlay behavior at compact, resized, maximized, and restored geometries.

## Mental model

A JSVision interface is a retained tree:

1. A parent receives a rectangle from its own parent.
2. The parent removes its padding to produce a **content box**.
3. Its in-flow children negotiate space along the **main axis**.
4. The parent aligns each child on the **cross axis**.
5. Every child repeats the same process for its descendants.

A `row` has a horizontal main axis: child sizes mean columns, and cross-axis alignment controls
height. A `col` has a vertical main axis: child sizes mean rows, and cross-axis alignment controls
width.

| Container  | Main axis    | `fixed(view, n)` means | Cross axis |
| ---------- | ------------ | ---------------------- | ---------- |
| `row(...)` | left → right | exactly `n` columns    | height     |
| `col(...)` | top → bottom | exactly `n` rows       | width      |

All geometry is expressed in integer terminal cells. Child bounds are parent-relative, not screen
coordinates. The renderer combines ancestor positions when it paints and clips every view to the
intersection of its own rectangle and its ancestors.

::: tip Start with flow
Use nested `row` and `col` containers first. They adapt when the terminal changes size. Reach for
`stack`, `at`, `cover`, or `center` only when views truly need to overlap or occupy exact cells.
:::

## Your first layout

`row` puts children side by side. `col` stacks them from top to bottom. Tag a child with `fixed` when
one part has a known extent and `grow` when it should consume the remaining space:

```ts
import { Text, col, fixed, grow, row } from '@jsvision/ui';

const sidebar = new Text('Navigation');
const workspace = new Text('Document');

const screen = col(
  fixed(new Text('Project editor'), 1),
  grow(row(fixed(sidebar, 18), grow(workspace))),
  fixed(new Text('F1 Help'), 1),
);
```

Read the expression from the outside inward:

- the root is a vertical column;
- the title and status line are each one row high;
- the middle row grows to take every row left between them;
- inside that row, the sidebar is 18 columns wide;
- the workspace receives every remaining column.

`fixed` and `grow` mutate the view's main-axis size token and return that same view. That is why they
compose inline. The equivalent low-level form is
`view.setLayout({ size: { kind: 'fixed', cells: 18 } })`, but the helper is easier to scan.

### Add spacing at the container

Put spacing rules on the parent that owns the relationship:

```ts
import { col, fixed, grow, row } from '@jsvision/ui';

const screen = col(
  { padding: 1, gap: 1 },
  fixed(header, 1),
  grow(row({ gap: 1 }, fixed(sidebar, 18), grow(workspace))),
  fixed(status, 1),
);
```

`padding` insets the content box. `gap` inserts cells only between adjacent in-flow children—never
before the first or after the last.

## Live flow workshop

The workspace below is built from the same nested `row`, `col`, `fixed`, and `grow` calls shown
above. Change one layout rule at a time, then maximize or resize the dialog. Watch the fixed regions
keep their authored cell counts while the weighted regions share the changing remainder.

<PlayExample id="guides/layout-flow"
  title="Layout Flow Workshop"
  blurb="Use Alt+B, Alt+S, and Alt+P to change flex weights, the fixed sidebar width, and parent padding. Maximize or resize the centered Classic-theme dialog to see the nested workspace reflow."
/>

## How size negotiation works

Every in-flow child has one main-axis size. If you do not specify one, it is `auto`.

| Size                    | Declarative form                     | Behavior                                                                                 |
| ----------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `auto`                  | no tag, or `size: { kind: 'auto' }`  | Uses the view's measured natural size, or derives a container's size from its children.  |
| `fixed`                 | `fixed(view, 12)` or `{ fixed: 12 }` | Reserves exactly 12 cells on the parent's main axis.                                     |
| fractional              | `grow(view)` or `{ grow: 1 }`        | Takes a weighted share of the space left after fixed, auto, gaps, and padding.           |
| fractional with a floor | `grow(view, 1, { min: 12 })`         | Takes a weighted share but does not solve below 12 cells while a feasible track remains. |

### Auto size follows content

Leaf views such as `Text` and `Button` implement `measure()`. An auto-sized leaf uses that natural
size on the main axis. An auto-sized container without its own measurement derives its natural size
from its in-flow children, including gaps and padding.

```ts
import { Button, row } from '@jsvision/ui';

// Both Buttons remain at their measured caption widths.
const actions = row({ gap: 2 }, new Button('~O~K'), new Button('~C~ancel'));
```

An auto leaf that does not implement `measure()` has a natural size of zero. Custom views therefore
need a meaningful `measure()` whenever they are expected to size themselves.

### Fixed space is removed first

The layout engine subtracts padding, gaps, fixed tracks, and measured auto tracks from the available
main-axis extent. Only the remainder is divided among fractional children:

```ts
import { fixed, grow, row } from '@jsvision/ui';

// In 60 columns: navigation gets 12; editor and preview divide the remaining 48 as 2:1.
const body = row(fixed(navigation, 12), grow(editor, 2), grow(preview, 1));
```

Fractional sizing is integer-exact. If equal shares do not divide evenly, the earliest tracks receive
the leftover cells. Three equal children across 80 cells therefore solve to 27, 27, and 26—not to
fractional coordinates and not to a layout with a one-cell hole.

### Minimums protect usable panes

Use a fractional minimum when a flexible pane becomes unusable below a real cell threshold:

```ts
import { grow, row } from '@jsvision/ui';

const body = row(grow(navigation, 1, { min: 16 }), grow(editor, 3, { min: 30 }));
```

A fractional minimum is a floor while all requested floors fit. When the available track becomes
smaller than their combined minimums, the solver proportionally compresses those flexible panes
below their floors and still assigns every available cell. For example, panes with minimums 16 and
30 resolve to 7 and 13 cells in a 20-cell track.

Reserve minimums for controls or workspaces with defensible usable geometry. They cannot prevent
every kind of clipping: fixed and measured auto tracks are removed before fractional space is
solved, and an oversized fixed track or absolute rectangle can extend past its parent.

### Container size shorthand

`row` and `col` accept layout props as their first argument. `fixed`, `grow`, and `fill` on that
object size the **container itself** within its parent:

```ts
import { col, row } from '@jsvision/ui';

const navigation = col({ fixed: 18, padding: 1 }, navItems);
const workspace = col({ grow: 1 }, editor);
const body = row({ gap: 1 }, navigation, workspace);
```

Here `navigation` is the 18-column child; `padding: 1` controls its own content. `fill: true` is only
shorthand for a flow size of `grow: 1`. It is not the same operation as the `cover(view)` overlay
helper.

## Spacing and alignment

Padding and gap change the available track. Justification and alignment decide where children sit
when they do not already consume all of it.

### Padding

A number applies the same inset to every side. Use an object for asymmetric padding:

```ts
import { col } from '@jsvision/ui';

const panel = col(
  {
    padding: { top: 1, right: 2, bottom: 1, left: 2 },
  },
  title,
  body,
);
```

Padding belongs to the container's content box. It also offsets absolute and fill overlays inside
that container. If opposite padding sides consume the complete width or height, the content box
collapses to zero rather than becoming negative.

### Main-axis justification

`justify` only has visible work when fixed and auto children leave free main-axis space. A growing
child normally absorbs that space first.

| `justify`         | Result                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `'start'`         | Packs the run at the top or left. This is the default.                                           |
| `'center'`        | Centers the complete run, rounding toward the near edge.                                         |
| `'end'`           | Packs the run at the bottom or right.                                                            |
| `'space-between'` | Keeps the first and last children at opposite edges and distributes free cells between siblings. |

```ts
import { fixed, row } from '@jsvision/ui';

const toolbar = row({ justify: 'space-between' }, fixed(backButton, 10), fixed(saveButton, 10));
```

### Cross-axis alignment

`align` controls every in-flow child on the cross axis:

| `align`     | Result                                                             |
| ----------- | ------------------------------------------------------------------ |
| `'stretch'` | Fills the parent's cross-axis content extent. This is the default. |
| `'start'`   | Uses the child's measured cross size at the top or left.           |
| `'center'`  | Uses the measured cross size and centers it.                       |
| `'end'`     | Uses the measured cross size at the bottom or right.               |

```ts
import { row } from '@jsvision/ui';

// Buttons keep their natural height and sit vertically centered in the toolbar.
const toolbar = row({ align: 'center', gap: 2 }, backButton, saveButton);
```

Non-stretch alignment depends on natural measurement. A custom child with no meaningful
`measure()` has a zero natural cross size and can appear to vanish.

### Flexible and fixed spacers

Use `gap` for uniform sibling separation. Use `spacer()` when one empty track should take part in
size negotiation:

```ts
import { row, spacer } from '@jsvision/ui';

const actions = row(
  helpButton,
  spacer(), // absorbs all remaining space
  cancelButton,
  spacer({ fixed: 2 }), // always two cells
  saveButton,
);
```

A numeric `spacer(2)` is a fractional spacer with weight 2. It is not a two-cell spacer; use
`spacer({ fixed: 2 })` for that.

## Build responsive layouts

Responsive JSVision layouts do not use pixel breakpoints. They express which regions are fixed,
which are content-sized, and which may grow. The render root re-solves the same tree whenever the
viewport changes.

### Nest one relationship at a time

Each container should describe one relationship. A typical application workspace is a column of
horizontal bands, with a row inside its growing body:

```ts
import { col, fixed, grow, row } from '@jsvision/ui';

const workspace = col(
  fixed(menu, 1),
  grow(row(fixed(projectTree, 22), grow(editor, 3, { min: 30 }), grow(inspector, 1, { min: 16 }))),
  fixed(status, 1),
);
```

This reads like the visual hierarchy and keeps sizing local. The outer column knows about vertical
bands; only the inner row knows about horizontal panes.

### Change layout through `setLayout`

`setLayout` merges the supplied fields into the existing layout and requests reflow when the view is
mounted. Helpers such as `grow`, `fixed`, `at`, and `cover` use the same merge-preserving operation:

```ts
// Change only the size. Existing direction, padding, and placement remain intact.
workspace.setLayout({ size: { kind: 'fr', weight: 2 } });

// Clear a field explicitly when you want its default again.
workspace.setLayout({ padding: undefined });
```

Do not mutate `view.layout.rect.x` or another nested field in place. Layout is exposed read-only so
changes go through `setLayout` and schedule a reflow.

### Conditional children

`row`, `col`, and `stack` skip `false`, `null`, and `undefined` children. This makes simple
conditional composition readable:

```ts
import { col, fixed, grow } from '@jsvision/ui';

const page = col(fixed(header, 1), grow(content), message !== null && fixed(messageView, 1));
```

For a mounted view, visibility is plain state. Change it and request layout invalidation so the
parent recomposes immediately and in-flow siblings reclaim the released space:

```ts
messageView.state.visible = false;
messageView.invalidateLayout();
```

When changing several siblings together, update all their visibility fields first and invalidate
their shared layout container once.

### Measure translated controls before fixing a viewport

Do not guess widths for translated dialog actions. A `Button` measures its natural caption in
terminal display cells, so wide glyphs, combining characters, and accelerator markup are handled
consistently. Use `measureButtonGroup()` to negotiate the viewport minimum for the complete action
set, then pass the same unattached Buttons and options to `buttonGroup()`:

```ts
import { Button, at, buttonGroup, measureButtonGroup } from '@jsvision/ui';

const actions = [
  new Button('~S~peichern', { command: 'save', default: true }),
  new Button('~A~bbrechen', { command: 'cancel' }),
  new Button('Als ~E~ntwurf speichern', { command: 'save-draft' }),
];
const options = { minimumButtonWidth: 10, gap: 2, maxColumns: 2 } as const;
const metrics = measureButtonGroup(actions, options);
const actionGroup = buttonGroup(actions, options);

// metrics.width/height are preferred content-area minima for the parent.
dialog.add(at(actionGroup, 0, 0, metrics.width, metrics.height));
```

Group measurement uses the widest sibling for equal button widths. `maxColumns` preserves row-major
ordering while wrapping equal-width buttons across multiple rows; use `buttonColumn()` for a
vertical action set. Accelerator markup is excluded from measured width. Wide glyphs and combining
characters are measured by terminal display cells rather than JavaScript string length.

The Buttons must be unattached because one live view can have only a single parent. When the
preferred size does not fit, negotiate a larger viewport or dialog first, then wrap. The terminal
edge remains an absolute hard bound: content clips when no feasible size exists.

## Overlays and exact placement

Flow answers “what space does each sibling own?” Overlays answer “what should paint over that
space?” An out-of-flow child reserves no main-axis space, so normal siblings behave as if it were
absent. Later children paint in front of earlier children.

### Stack related layers

`stack` gives several layers one shared box. An untagged layer fills it. Placement helpers size and
anchor front layers:

```ts
import { centered, stack, topRight } from '@jsvision/ui';

const scene = stack(
  canvas, // fills the complete stack
  centered(propertiesCard, 36, 8),
  topRight(newBadge, 7, 1),
);
```

| Helper                             | Use                                                                   |
| ---------------------------------- | --------------------------------------------------------------------- |
| `centered(view, width, height)`    | Fixed-size layer centered on both axes.                               |
| `topLeft(view, width, height)`     | Fixed-size layer pinned to the top-left.                              |
| `topRight(view, width, height)`    | Fixed-size layer pinned to the top-right.                             |
| `bottomRight(view, width, height)` | Fixed-size layer pinned to the bottom-right.                          |
| `place(view, placement)`           | Per-axis start, center, end, or fill placement with optional offsets. |

The placement taggers only take effect when the tagged view is passed to `stack`. For a standalone
child, use `center`, `cover`, or `at` instead.

<PlayExample id="guides/layout-overlays"
  title="Layout Overlay Workshop"
  blurb="Use Alt+C and Alt+N to hide the centered card and corner badge independently. The base keeps its full rectangle because stack layers overlap instead of consuming flow space."
/>

### Place one child at exact cells

`at(view, x, y, width, height)` sets a parent-content-relative rectangle and returns the same view.
It does **not** add the view to a parent:

```ts
import { Group, Text, at } from '@jsvision/ui';

const canvas = new Group();
const toast = new Text('Saved');

canvas.add(at(toast, 2, 1, 20, 1));
```

An `at()` child is out of flow. It can overlap siblings, and its rectangle stays fixed when the
parent grows. Use it for cell-exact canvases and carefully measured dialog content, not as the
default way to build a screen.

### Cover or center without a stack

`cover` fills the parent's content box as an out-of-flow overlay. `center` centers a fixed rectangle
and re-centers it after resize:

```ts
import { center, cover } from '@jsvision/ui';

parent.add(cover(dimmer));
parent.add(center(confirmCard, 40, 10));
```

`cover(view)` is different from `{ fill: true }`: `cover` leaves flow and overlaps siblings;
`fill: true` gives a container a normal fractional share of its parent's flow.

### Clipping still applies

Absolute rectangles may extend beyond their parent, but drawing is clipped by the ancestor chain.
An oversized overlay does not enlarge the terminal or escape a dialog. This makes overlays safe,
but it also means an incorrect rectangle can silently hide text at the edge.

## Use the pure layout engine

Most applications should compose views with the declarative helpers. Advanced tooling can call the
pure `layout()` function directly with a `LayoutBox` tree:

```ts
import { layout, type LayoutBox } from '@jsvision/ui';

const sidebar: LayoutBox = {
  props: { size: { kind: 'fixed', cells: 20 } },
  children: [],
};
const main: LayoutBox = {
  props: { size: { kind: 'fr', weight: 1 } },
  children: [],
};
const root: LayoutBox = {
  props: { direction: 'row', gap: 1 },
  children: [sidebar, main],
};

const rects = layout(root, { width: 80, height: 24 });
rects.get(main); // { x: 21, y: 0, width: 59, height: 24 }
```

The pass is pure and returns parent-relative rectangles. Each box instance must appear once in an
acyclic tree; reusing one box at multiple positions would collide in the result map.

## Composition and integration

Layout decides geometry; it does not own application state or interaction. Keep those
responsibilities at their natural seams:

- compose `Group` and `View` instances with `row`, `col`, or `stack`, then add the resulting root to
  the application, window, dialog, or component that owns it;
- use [Reactive state](/guide/reactive-state) to change size tokens, visibility, or children from
  signals instead of rebuilding unrelated parts of the tree;
- use [Views & focus](/guide/views-and-focus) to establish keyboard order after the visual hierarchy
  is stable—painting position does not automatically define focus order; and
- let specialist components such as grids and editors own their internal geometry while the
  surrounding Guide-level layout gives their principal pane flexible space.

When a child has a minimum usable size, keep that knowledge with the child or the immediate parent
that owns the relationship. A distant application shell should not guess the internal widths of a
translated button group, editor gutter, or grid header.

## Common failure modes

Use the symptom to choose one likely cause, apply the smallest correction, and verify the resulting
geometry instead of changing several layout rules at once.

| Symptom                          | Likely cause                                                                  | Correction                                                                            | Evidence to verify                                                    |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A view has zero width or height  | Auto measurement or the cross-axis natural size is zero                       | Implement `measure()`, choose a justified track, or restore available content space   | Inspect the solved bounds; both dimensions are positive               |
| A growing pane disappears        | Fixed, auto, gap, padding, and minimum tracks consume the available main axis | Reduce fixed geometry or negotiate a larger parent before adding a defensible minimum | Resize through the supported range; the principal pane remains usable |
| An overlay moves normal siblings | The view is still in flow, often through `{ fill: true }`                     | Use `stack`, `cover`, `center`, or `at` for deliberate overlap                        | Toggle the overlay; in-flow sibling bounds remain unchanged           |
| Translated text clips            | A fixed rectangle was guessed from JavaScript string length                   | Measure terminal display cells and negotiate the parent minimum                       | Render long and wide-glyph labels at 80×24, maximize, and restore     |

### “My view collapsed to zero”

- An auto leaf has no useful `measure()` result. Implement `measure()` or give it a fixed/fractional
  track.
- A non-stretch child relies on its natural cross size, but its measurement is zero.
- Padding consumes the complete content extent.
- An absolute view has no rectangle. `position: 'absolute'` without `rect` resolves to a zero
  rectangle.

### “My growing pane disappeared”

Fixed and auto tracks are allocated before the fractional remainder. If they and the gaps already
consume the container, an unfloored `grow` child receives zero. Reduce fixed geometry, wrap content,
or add a justified minimum only when the surrounding viewport can honor it.

### “Justify does nothing”

A fractional child has already absorbed the free main-axis space. `justify` distributes only
leftover space. Use fixed/auto children when the run itself should be centered or spread apart.

### “My overlay changed the normal layout”

Confirm that it is actually out of flow. `{ fill: true }` means a normal `grow: 1` child. Use
`cover(view)`, an untagged `stack` layer, or `at(view, ...)` for an overlay.

### “My exact-position view never appeared”

`at`, `cover`, and `center` configure a view but do not attach it. Add the returned view to its
parent. Likewise, `centered`, `topRight`, and the other placement tags must be consumed by `stack`.

### “My text clips after translation or resize”

Do not derive width from `string.length` and do not guess translated button widths. Measure display
cells, negotiate the parent minimum, test the standard 80×24 viewport, and verify maximize and
restore. A fixed absolute rectangle is a hard clipping boundary.

### “Changing one layout option reset another”

`setLayout` merges. Omitted fields are retained, not reset. Pass `undefined` for a property you
intend to clear, and keep the layout responsibility at one parent seam so unrelated code is not
retagging the same view.

## Best practices

- **Model the visual hierarchy with nested containers.** One row or column per relationship keeps
  main-axis reasoning local and makes resize behavior predictable.
- **Use fixed cells only for genuinely fixed terminal geometry.** Menu/status rows and measured
  control faces are good candidates; workspaces normally grow.
- **Let `auto` follow measured content.** It is the right default for labels and buttons, but custom
  views must implement an honest `measure()`.
- **Put padding and gaps on the owning container.** Scattered empty views obscure which relationship
  creates the space; reserve `spacer()` for space that must flex or push.
- **Use minimums sparingly.** A floor protects usability only while the containing viewport can
  satisfy the complete set of constraints.
- **Prefer flow over coordinates.** Exact rectangles do not adapt by themselves. Use them for
  canvases, overlays, and already-measured dialog regions.
- **Keep overlays explicit.** `stack` communicates z-order. Add base layers first and transient
  layers last.
- **Test more than startup.** Verify the compact 80×24 state, resize or maximize, and restore. Check
  long translated text and the smallest supported viewport for clipping.

## Practice

1. Build a header/body/status column whose body contains a fixed navigation pane and two weighted
   work panes. Drag-resize the window, maximize it, and restore it; record which cell counts remain
   fixed and which tracks absorb the difference.
2. Replace one short action label with a longer translation and one wide-glyph label. Measure the
   controls, negotiate a usable minimum, and verify the screen at 80×24 without using
   `string.length`.
3. Add a centered card and a top-right badge to a `stack`. Toggle each overlay independently and
   prove that the base layer keeps the same bounds while the overlays re-anchor after resize.
4. Break one layout deliberately—remove a custom leaf's `measure()`, oversubscribe fixed tracks, or
   forget to attach an `at()` view. Write down the symptom, cause, correction, and evidence that
   confirms the repair.

## API reference

- [`row`](/api/ui/functions/row), [`col`](/api/ui/functions/col), [`grow`](/api/ui/functions/grow),
  [`fixed`](/api/ui/functions/fixed), and [`spacer`](/api/ui/functions/spacer) — declarative flow
  composition.
- [`Flex`](/api/ui/type-aliases/Flex) and [`LayoutProps`](/api/ui/interfaces/LayoutProps) — container
  configuration and low-level size tokens.
- [`stack`](/api/ui/functions/stack), [`place`](/api/ui/functions/place), and
  [`Placement`](/api/ui/interfaces/Placement) — shared-box overlay composition.
- [`at`](/api/ui/functions/at), [`cover`](/api/ui/functions/cover), and
  [`center`](/api/ui/functions/center) — standalone out-of-flow placement.
- [`layout`](/api/ui/functions/layout) and [`LayoutBox`](/api/ui/interfaces/LayoutBox) — pure layout
  engine.

Continue with [Reactive state](/guide/reactive-state) to drive these layouts from application state,
or [Views & focus](/guide/views-and-focus) to learn how the retained view tree handles interaction.
