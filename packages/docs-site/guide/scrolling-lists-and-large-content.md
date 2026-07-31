---
title: Scrolling, lists & large content
description: Learn JSVision scrolling and list surfaces, viewport ownership, selection, and bounded rendering for large terminal content.
---

# Scrolling, lists & large content

A terminal viewport is usually smaller than the information behind it. The difficult part is not
moving text up and down; it is deciding who owns the content, the offset, focus, selection, scroll
bars, and the cost of producing rows. This course builds that decision model from a first
scrollable view to production-aware collection boundaries.

## Who this course is for

This course is for developers who already know the [Layout course](/guide/layout) and the
[Views & focus course](/guide/views-and-focus). You should be comfortable with assigned view
rectangles, nested ownership, and moving focus between views. No prior virtualization experience is
required.

By the end, you will be able to build a scrollable live view, explain which public surface fits a
flat list, string list, tree, or painted canvas, diagnose focus and offset failures, and verify that
rendering work stays bounded by the visible window. The motivating problem is a large log, catalog,
or file browser whose content must remain navigable in a small viewport without painting every row
on every frame.

The beginner boundary is a focusable `Scroller` around one oversized child. The intermediate
boundary is coordinating offsets, bars, focus, selection, expansion, and reactive data changes.
The advanced boundary is choosing resident versus windowed data, rejecting stale async windows,
and collecting evidence about bounded work.

## Mental model

Keep four quantities and three kinds of state separate:

```text
content / collection extent
          │
          ▼
  viewport rectangle ── offset (x, y) ──> visible window
          │
          ├── focus: where keyboard input goes
          ├── selection: the chosen item, if any
          └── bars: a control surface for the same offset/range
```

- The **extent** is the whole logical width and height.
- The **viewport** is the assigned rectangle available now.
- The **offset** chooses the viewport's top-left position inside the extent.
- The **visible window** is the bounded intersection that is painted.
- **Focus** identifies the view or row target that receives keys.
- **Selection** is application state and may deliberately lag behind focus.
- A **scroll bar** presents and changes a range; it does not make data virtual by itself.

For one axis, a valid offset is bounded by:

```text
0 <= offset <= max(0, extent - viewport)
```

Resizing changes the viewport, so the legal offset can change even when the content does not.
Shrinking an extent or collection has the same consequence. A correct owner re-limits or clamps
the offset after either change.

## Your first scrollable result

`Scroller` is the normal first choice when you already have one live child view whose measured
content is larger than the available rectangle. It is focusable, owns the offset, creates a
vertical scroll bar by default, and routes navigation keys to that offset.

```ts
import { Scroller, Text, at } from '@jsvision/ui';

const log = new Text(Array.from({ length: 80 }, (_, row) => `row ${row}`).join('\n'));
const scroller = new Scroller({
  content: at(log, 0, 0, 40, 80),
  extent: { width: 40, height: 80 },
});
```

Give the `Scroller` a smaller rectangle through its parent layout. Arrow keys move one cell,
Page Up and Page Down move by the vertical viewport minus one row, Home and End jump to the vertical
boundaries, and the mouse wheel moves three rows. Every path is clamped.

<PlayExample id="guides/viewport-strategies" title="Viewport Strategies Laboratory" blurb="Compare a focusable Scroller that owns its vertical bar with a passive SurfaceView whose caller pans and clamps the offset; try Page Down, Alt+P, the buttons, resize, and maximize." />

The laboratory's objective is to make ownership visible. Focus the `Scroller` and press
**Page Down**; then use **Alt+P** or **Pan surface**. Both results move a visible window, but only
the `Scroller` owns keyboard navigation and its bar.

## Choosing a viewport strategy

Choose from the data and interaction model, not from the visual resemblance:

| Surface         | Owns                                              | Focus model                           | Rendering/data boundary                    | Choose it when                                    |
| --------------- | ------------------------------------------------- | ------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `Scroller`      | One live child, offset, optional bars             | Scroller is focusable                 | Child remains a normal live view           | One composed view is larger than its rectangle    |
| `SurfaceView`   | Projection over an offscreen `Surface`            | Passive; caller owns commands         | Copies only the visible surface cells      | Content is already painted or canvas-like         |
| `ListView<T>`   | Resident typed items and virtual rows             | Inner `rows` view is the focus target | Draws visible rows from the resident array | A flat typed collection fits in memory            |
| `ListBox`       | Resident strings and virtual rows                 | Inner `rows` view is the focus target | `ListView<string>` convenience             | Rows are already display strings                  |
| `Tree<T>`       | Resident nodes, expansion, flattened visible rows | Inner `rows` view is the focus target | Draws the visible flattened hierarchy      | Identity and expansion define navigation          |
| Windowed source | Requested slices and cache policy                 | Specialist surface owns navigation    | Loads only bounded ranges                  | Data is remote, unbounded, or too large to retain |

`Scroller` creates and owns its scroll bars. `SurfaceView` is passive and expects external commands
or scroll bars to update its supplied delta. `ListView`, `ListBox`, and `Tree` virtualize row
painting, but their input arrays or node graphs are still resident. That last distinction prevents
a common mistake: visible-row rendering is not the same as windowed data acquisition.

## Viewport offsets and scroll bars

### Let the owning method clamp

`Scroller.delta` is readonly state. Navigate through its keys, wheel path, or the owning public
behavior instead of assigning to it. If extent can change, provide a getter; the Scroller reads it
during drawing and clamps the composed child position to the new visible range. This visual clamp
does not rewrite `delta`: immediately after a shrink, `delta` can still report the old value. The
next owning navigation write—such as Home, End, an arrow, or a wheel step—re-limits the signal
against the new range.

```ts
import { Scroller, Text, signal } from '@jsvision/ui';

const rowCount = signal(200);
const scroller = new Scroller({
  content: new Text('bounded teaching content'),
  extent: () => ({ width: 48, height: rowCount() }),
  scrollbars: 'both',
});

rowCount.set(12);
scroller.invalidate(); // projection clamps; delta may still report its prior value
```

If application logic must observe a bounded offset immediately when extent changes, use a surface
whose offset your application owns, or arrange an explicit Scroller navigation command after the
new geometry has rendered. Do not treat `delta` as newly normalized merely because the frame is
visually within bounds.

Bars reserve space: a vertical bar uses the right column, a horizontal bar uses the bottom row, and
the `both` mode reserves their corner. The actual content viewport is therefore smaller than the
outer `Scroller` rectangle. Compute layout from the assigned viewport, not from an assumed bar-free
rectangle.

### Coordinate a passive surface explicitly

A `SurfaceView` projects an offscreen `Surface`. Its `scrollTo()` and `panBy()` methods clamp to the
surface and current viewport. Directly writing the supplied delta signal is intentionally possible
but can overscroll, so application commands should use the methods.

```ts
import { Surface, SurfaceView, signal } from '@jsvision/ui';

const surface = Surface.from(['ABCDEFGHIJ', '0123456789', 'abcdefghij']);
const delta = signal({ x: 0, y: 0 });
const viewport = new SurfaceView({ surface, delta });

viewport.panBy(3, 1);
viewport.scrollTo({ x: 999, y: 999 }); // clamped to the current viewport
```

`SurfaceView` does not create a bar and is not focusable. Put panning commands on a focusable
ancestor or application keymap. If you add a `ScrollBar`, the owner must keep its range and the
surface delta synchronized.

```ts
import { ScrollBar, signal } from '@jsvision/ui';

const extentRows = 120;
const viewportRows = 18;
const maxOffset = Math.max(0, extentRows - viewportRows);
const pageStep = Math.max(1, viewportRows - 1);
const top = signal(0);
const bar = new ScrollBar({ value: top, min: 0, max: maxOffset, pageStep });

const nextMax = Math.max(0, 24 - viewportRows);
bar.setRange(0, nextMax, pageStep);
top.set(Math.min(top(), nextMax)); // setRange does not rewrite the bound signal
```

`ScrollBar` is passive. Its default orientation is vertical; an arrow changes the value by one,
page movement uses the axis length minus one, and a wheel step changes it by three. The owning
surface remains responsible for applying the resulting value. `setRange()` changes the bar's live
range and clamps how it reads and paints the value, but the owner must explicitly re-limit a bound
signal when extent shrinks.

## Lists, focus, and selection

`ListView<T>` accepts a reactive resident array and a `getText` projection. Its outer `Group` is
passive; `list.rows` is the focus target. The default focused index is `0`, while the default
selected index is `-1`, meaning “nothing selected.”

```ts
import { ListView, signal } from '@jsvision/ui';

const items = signal([
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
]);
const focused = signal(0);
const selected = signal(-1);

const list = new ListView({
  items,
  focused,
  selected,
  getText: (item) => item.name,
});
```

Moving with arrow keys changes focus without selecting. Enter or Space activates the focused row
and updates selection. A single mouse click both focuses and selects the clicked row. That
distinction supports preview navigation, confirmation workflows, and multi-step commands.

When items shrink, `ListView` clamps focus into the remaining range. An empty list paints
`<empty>`. After any shrink, verify that focus clamped before reading the current row. Keep commands
safe when `selected()` is `-1`, and derive the selected item only after checking the current array
boundary.

Use `ListBox` when strings already are the row model:

```ts
import { ListBox, signal } from '@jsvision/ui';

const list = new ListBox({
  items: signal(['Development', 'Staging', 'Production']),
});
```

This is a `ListView<string>` convenience, not a separate data architecture.

### Multiple columns

`numCols` lays visible items out in column-major order: fill down the first column, then the next.
It does not turn rows into a data grid with independent column schemas, sorting, or remote windows.

```ts
import { ListView, signal } from '@jsvision/ui';

const commands = new ListView({
  items: signal(['Build', 'Test', 'Deploy', 'Logs', 'Rollback', 'Help']),
  getText: (command) => command,
  numCols: 2,
});
```

Use the [Data Grid specialist course](/components/data-grid/) when columns carry typed fields,
sorting, editing, or windowed data semantics.

<PlayExample id="guides/virtual-collections" title="Virtual Collections Laboratory" blurb="Compare ListView, ListBox, and Tree focus, selection, expansion, bounded visible-row work, and empty or shrinking resident data; try arrows, Enter, Alt+T, Alt+S, and Alt+E." />

The laboratory's objective is to separate virtual row drawing from resident data. Navigate the
typed list, select with Enter, expand the tree, then shrink and empty the fixtures. The status keeps
the focused row, selected row, expansion state, fixture state, and bounded work visible without
depending on color.

## Trees and visible rows

`Tree<T>` stores expansion in the view, keyed by node identity. It flattens only expanded branches
into a visible row sequence and virtualizes drawing over that sequence. As with lists, `tree.rows`
is the focus target and focus is distinct from selection.

```ts
import { Tree, signal } from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';

const src: TreeNode<string> = {
  value: 'src',
  children: [{ value: 'main.ts', children: [] }],
};
const roots = signal([src]);
const tree = new Tree({ roots, getText: (value) => value });

tree.expand(src);
```

Expansion belongs to that `Tree` instance. A second tree over the same node objects has independent
expansion state. Preserve object identity when you want expansion to survive a reactive roots
update; recreating every node also creates a new expansion identity.

The default `markerStyle: 'tv'` uses a bare `+` for a collapsed branch and `─` for an expanded branch
or leaf. Choose `'brackets'` explicitly for ASCII `[+]` and `[-]` markers. Choose `'triangle'`
explicitly for Unicode `▸` and `▾`; that opt-in style falls back to brackets when UTF-8 is
unavailable. Do not rely on marker shape or color alone—row text, indentation, and an explicit
expanded/collapsed label can carry the same meaning.

## Composition and integration

### Layout owns the viewport

The parent assigns the rectangle; the scrolling surface interprets it as a viewport. Preserve
instructions and action rows while allowing the principal scroller, list, tree, or surface to grow.
After resize, recalculate bar ranges and re-limit any externally owned offset.

### Reactivity owns data changes

`items`, `roots`, and dynamic `extent` getters may read signals. Change them through their signals,
then let the owning view clamp focus or offset during its documented update path. Avoid keeping a
second unsynchronized “current row” variable.

```ts
import { ListView, createRoot, signal } from '@jsvision/ui';

const cleanup = createRoot((dispose) => {
  const items = signal(['one', 'two', 'three']);
  const list = new ListView({ items, getText: (item) => item });
  items.set(['one']); // focus is clamped by the list
  return { list, dispose };
});

cleanup.dispose();
```

Acquire and dispose the reactive owner with the screen, dialog, or application that owns the
collection. A disposed view must not retain timers, subscriptions, pending work, or a live focus
path.

### Commands own passive navigation

A focusable `Scroller` can handle its own navigation. A passive `SurfaceView` or `ScrollBar`
requires a focusable owner and reachable commands. Make every important mouse action available by
keyboard and expose visible feedback for both action sources.

## Advanced behavior

### Bounded rendering is evidence, not a label

For the default unsorted `ListView`, row painting calls `getText` only for the visible window.
`Tree` also calls `getText` for painted visible rows after it has built the flattened expanded
hierarchy. Verify this paint behavior with per-render counters and compare each surface with its
viewport height. Do not turn one exact call count into a production guarantee; it is bounded
evidence for the tested options, geometry, and version.

Other resident operations have different costs. `sorted: true` calls `getText` across the resident
array while deriving its sorted display list. Type-ahead performs a linear `getText` search.
`Tree` flattens the whole currently expanded resident hierarchy before it paints the visible slice.
Measure or avoid those operations when their resident input is large; visible-row painting does not
make sorting, searching, or flattening viewport-bounded.

`SurfaceView` similarly copies the visible intersection. When a width-2 glyph would straddle the
right viewport edge, it drops the whole glyph instead of drawing half. Regions outside the surface
paint with `windowInactive`, making an oversize viewport or invalid direct delta visible as blank
bands.

### Resident is not windowed

A thousand resident unsorted items can paint smoothly because visible-row drawing is bounded, but
the array still occupies memory and was still acquired up front. Sorting and type-ahead can still
scan it. For remote, unbounded, or async data, use the owning
[Data Grid specialist course](/components/data-grid/) and its windowed source contracts. For large
editable documents, use the
[Code Editor specialist course](/components/code-editor/) and its viewport/document model.

When a specialist source makes an async window request, attach a generation or request identity.
Cancel work when possible and discard every stale or out-of-order result after the viewport has
moved. Never let an older response replace a newer visible range.

In short: reject a stale async window request result when its generation is no longer current.

### Safe row text

Treat untrusted or user-supplied labels as display text, not raw terminal output. Sanitize or escape
control sequences at the documented boundary before they reach list, tree, log, or diagnostic
fixtures. Bound diagnostic length and redact sensitive values.

### Theme roles

Use the exact semantic roles rather than hard-coded colors:

| Region or state                       | Theme role                                           |
| ------------------------------------- | ---------------------------------------------------- |
| Scroll-bar arrows/thumb               | `scrollBarControls`                                  |
| Scroll-bar page track                 | `scrollBarPage`                                      |
| Normal/focused/selected list row      | `listNormal`, `listFocused`, `listSelected`          |
| Multi-column divider                  | `listDivider`                                        |
| Normal/focused/selected tree row      | `outlineNormal`, `outlineFocused`, `outlineSelected` |
| Collapsed tree marker                 | `outlineNotExpanded`                                 |
| SurfaceView bands outside the surface | `windowInactive`                                     |

Keep focused, selected, expanded, empty, and bounded states readable through text or markers as well
as color. Test monochrome and ASCII-safe profiles; contrast changes must not erase the only cue.

## Failure modes and diagnosis

| Symptom                                                       | Likely cause                                                   | Correction                                                             | Distinguishing evidence                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Content disappears or clips before the expected end           | Extent, child layout, or bar-reserved viewport is wrong        | Measure the child and derive extent from the same geometry             | Print extent, outer bounds, actual viewport, and offset    |
| Page Down does nothing                                        | Focus is not on the Scroller or collection `rows` target       | Focus the owning target and keep disabled/hidden views out of the path | Inspect current focus and dispatch the same key headlessly |
| Focus lost, wrong row selected, or command opens another item | Focus and selection were treated as one index                  | Read `focused()` for navigation and `selected()` only after activation | Log both indices before and after Down, Enter, and shrink  |
| Blank band or over-scroll appears                             | External offset bypassed a clamping method or a range is stale | Use `scrollTo()`/`panBy()` and refresh the bar range                   | Compare offset with `max(0, extent - viewport)`            |
| Empty data crashes a command                                  | Code indexed `-1` or assumed a focused item exists             | Guard empty arrays and the selected `-1` sentinel                      | Render `<empty>` and exercise every action                 |
| Tree expansion resets after refresh                           | Nodes were recreated, changing identity                        | Preserve node identity or deliberately restore expansion               | Compare object identity and `isExpanded(node)`             |
| Large collection still stalls                                 | Acquisition/formatting scans the whole resident data set       | Instrument visible work or move to a windowed specialist source        | Compare formatter calls and memory with viewport height    |
| Old rows replace the current async window                     | A stale response was accepted                                  | Cancel or discard results whose generation is no longer current        | Record request generation and visible range together       |

Similar visual failures need different evidence. A blank lower band may mean a valid viewport larger
than its surface, an overscrolled direct delta, or an extent smaller than expected. Inspect
geometry and range before changing paint code.

## Best practices

- **Choose from ownership first.** A widget that looks like a list may actually be a painted
  surface or a remote grid. The wrong owner produces duplicated offsets and confused focus.
- **Keep focus and selection separate.** Selecting on every navigation key removes preview and
  confirmation workflows and makes accidental actions more likely.
- **Use the public clamping path.** Direct offset writes can create blank bands and stale bars.
- **Measure bounded work.** “Virtual” without viewport-relative evidence can hide a full scan.
- **Distinguish resident and windowed data.** Virtual rows reduce paint work, not acquisition or
  memory for the backing array.
- **Acquire and clean up together.** Reactive owners, timers, requests, and focus paths should end
  with the screen or application that created them.
- **Preserve keyboard and non-color cues.** Mouse-only scrolling and color-only selection exclude
  valid terminal and accessibility profiles.
- **Sanitize at ingestion.** A row renderer is too late to decide whether raw control text was
  trusted.

## Practice and next steps

Try these experiments in order:

1. Change the first laboratory's extent and resize the dialog. Predict the new maximum offset
   before pressing Page Down or panning.
2. In the collection laboratory, move focus without selection, activate a row, then shrink and
   empty the data. Record which state clamps and which becomes `-1`.
3. Increase a bounded resident fixture to ten thousand items and assert formatter work remains
   related to viewport height. Then explain why its memory is still not windowed.
4. Add a monochrome theme and an ASCII-safe capability profile. Verify that focus, selection, and
   tree expansion remain understandable without color or triangles.
5. Sketch a generation check for a remote window request, then compare it with the specialist
   source owned by Data Grid or Code Editor.

Continue with [Reactive state](/guide/reactive-state) when collection changes need deeper ownership
and cleanup reasoning. Use the component pages for
[`Scroller`](/components/containers/scroller),
[`ListView`](/components/containers/list-view),
[`ListBox`](/components/containers/list-box),
[`Tree`](/components/containers/tree), and
[`SurfaceView`](/components/surface/surface-view) when you need widget-specific configuration.

Generated API references:

- [`Scroller`](/api/ui/classes/Scroller)
- [`SurfaceView`](/api/ui/classes/SurfaceView)
- [`ListView`](/api/ui/classes/ListView)
- [`Tree`](/api/ui/classes/Tree)
- [`ScrollBar`](/api/ui/classes/ScrollBar)
