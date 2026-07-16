# Layout

**Compose every screen with the layout DSL.** jsvision ships a small, expression-oriented DSL —
nested `col`/`row` (and `stack`) builders — that the engine sizes and reflows for you. It is the
default and near-universal way to place views. **Reach for absolute rects only for the handful of
cases the flow model genuinely cannot express** — they are listed at the end, and you should be able
to name which one applies before you write a `rect`.

Everything below imports from `@jsvision/ui`.

## The DSL: `col` and `row`

`col(...)` stacks children top-to-bottom; `row(...)` places them left-to-right. Both take an optional
props object first, then the child views. Nest them to build any screen:

```ts
import { col, row, fixed, grow } from '@jsvision/ui';

// A fixed-height header over a body that splits into a sidebar and a growing main pane.
const screen = col({ gap: 1 }, fixed(header, 1), grow(row({ gap: 1 }, fixed(sidebar, 20), grow(main))));
win.add(screen);
```

The result is an ordinary `Group` tree — it reflows and resizes exactly like a hand-built one, with
no separate runtime. You never call `.add()` or set `.layout` by hand for flowed content.

## Sizing children: `grow` / `fixed` / `fill` (and `spacer`)

Each child needs a **main-axis** size (height in a `col`, width in a `row`). Wrap it:

- **`fixed(view, n)`** — exactly `n` cells.
- **`grow(view, n?)`** — a flex share of the leftover space (default weight `1`); two `grow` siblings
  split evenly, `grow(v, 2)` takes twice a `grow(v, 1)` sibling.
- **`fill: true`** (a container prop) — shorthand for the container itself taking `grow` weight `1`,
  so a bare `col({ fill: true }, …)` fills its parent.
- **`spacer()`** — an invisible flexible gap that pushes later children to the far edge;
  `spacer({ fixed: n })` is an exact `n`-cell gap.

```ts
import { row, fixed, spacer } from '@jsvision/ui';

// Push `help` to the right edge; keep a hard 2-cell gap before `cancel`.
const bar = row(fixed(ok, 10), spacer({ fixed: 2 }), fixed(cancel, 12), spacer(), fixed(help, 8));
```

The **cross axis** defaults to `align: 'stretch'`, so a child fills the container's other dimension
without any size of its own — a `Label`/`Input`/`Button` in a sized row gets the row's height for
free. That is why most flowed children never need a `measure()`.

## `measure()` discipline

A child left at the default **`auto`** size derives its extent from `measure(available)`. A custom
leaf `View` with no `measure()` in an `auto` slot collapses to `{0,0}` and paints nothing (gotcha 1).
Two ways to be safe:

- Give the child an explicit `fixed`/`grow` size (the common case) — no `measure()` needed.
- Or implement `measure()` on a custom leaf so `auto` works (see `widget-authoring.md`).

Built-in leaves are not uniform here — several (e.g. `Text`, `Button`, `Input`) have no `measure()`,
so **size them with `fixed`/`grow`** rather than relying on `auto`. `ProgressBar` and container
widgets measure themselves.

## Container props

The optional first argument to `col`/`row`/`stack` sets how the container arranges its children:

- **`gap`** — cells between children.
- **`padding`** — inset (a number for all sides, or `{ top, right, bottom, left }`).
- **`justify`** — main-axis distribution: `'start'` (default) · `'center'` · `'end'` ·
  `'space-between'`.
- **`align`** — cross-axis: `'stretch'` (default) · `'start'` · `'center'` · `'end'`.
- **`background`** — a theme role filled behind the children (e.g. `'desktop'`).

```ts
import { row, fixed } from '@jsvision/ui';
// A centered button pair.
const buttons = row({ gap: 2, justify: 'center' }, fixed(okButton(), 10), fixed(cancelButton(), 12));
```

## Overlays: `stack` (instead of absolute rects)

For layered UI — a centered dialog over a canvas, a badge in a corner — use `stack`, **not** absolute
rects. Layers share one box and paint back-to-front; placement helpers tag each layer, and the engine
keeps them positioned (and re-centered on resize) for you:

```ts
import { stack, centered, topRight, bottomRight, topLeft, place } from '@jsvision/ui';

const screen = stack(
  { background: 'desktop' },
  canvas, // untagged → fills the whole box
  centered(dialog, 40, 12), // fixed size, centered, re-centers on resize
  topRight(badge, 5, 1), // pinned to a corner
);
```

`centered` / `topRight` / `bottomRight` / `topLeft` take `(view, width, height)`; `place(view, { h,
v, width, height })` is the general form. These cover almost every "I need to position this exactly"
case without a single hand-computed rect.

## Absolute placement — the sanctioned exceptions

Set `view.layout = { position: 'absolute', rect: { x, y, width, height } }` **only** when one of
these genuinely applies:

1. **A `Window`/`Dialog`'s own placement on the desktop.** The desktop is a free-form window
   manager, not a flow container, so a window is placed by rect (`win.layout.rect = { x, y, width,
height }`) — or arranged with `app.desktop.tile()` / `cascade()`. This is about the window frame,
   never its interior: compose the interior with the DSL.
2. **Framework-positioned overlays** — menus, dropdowns, and popups the framework itself anchors.
   For app-authored overlays, prefer `stack` (above).
3. **A true overlap/pin the flow model cannot express** — rare. Try `stack` + `place` first; only
   drop to a raw rect if that genuinely cannot express it.

If you find yourself writing a rect for ordinary content — a form, a toolbar, a list beside a detail
pane — that is the smell in gotcha 3: use `col`/`row`/`stack` instead.

When you do place absolutely, three things bite:

- **Rects are parent-interior-relative.** A child's `{ x: 0, y: 0 }` is its parent's top-left content
  cell, not the screen origin.
- **`Window`/`Dialog` default to `padding: 1`** (the border inset), and an absolute child's rect is
  measured **inside** that padding — so a child at `{ x: 1, y: 1 }` sits one cell in from the frame.
  Set the container's `padding: 0` to position from the frame yourself.
- **A `Dialog` created with `width`/`height` (no `rect`) auto-centers on every reflow** — convenient,
  but it re-centers on resize, so you cannot then drag it. Give an explicit `rect` for a fixed,
  movable position.
