# Layout

Every view has a `layout` (`LayoutProps`) that tells the engine how to size and place it. There are
two placement modes: **absolute** (you give a rect) and **flow** (the parent arranges children).

## Absolute placement

Give a view an explicit rect relative to its parent's interior:

```ts
view.layout = { position: 'absolute', rect: { x: 2, y: 1, width: 40, height: 10 } };
// windows accept the shorthand:
win.layout.rect = { x: 2, y: 1, width: 40, height: 10 };
```

Rects are **parent-interior-relative** — a child's `{ x: 0, y: 0 }` is its parent's top-left content
cell, not the screen origin.

## Flow placement (the size model)

A view in a flow container is sized by its `layout.size`:

- **`{ kind: 'fixed', cells: N }`** — exactly N cells on the main axis.
- **`{ kind: 'fr', weight: W }`** — a fraction of the leftover space (like CSS `fr`).
- **`auto`** (the default) — the view's intrinsic size from `measure()`.

A `Group` arranges its flow children with `direction: 'row' | 'col'`, plus `gap`, `padding`,
`justify`, and `align`. Compose screens as nested rows/columns:

```ts
const root = new Group();
root.layout = { direction: 'col', gap: 1, padding: 1 };
header.layout = { size: { kind: 'fixed', cells: 1 } };
body.layout = { size: { kind: 'fr', weight: 1 } }; // fills the rest
root.add(header);
root.add(body);
```

## `measure()` discipline

An `auto`-sized leaf **must** implement `measure(available): { width, height }` returning a non-zero
size, or it collapses to `{0,0}` and paints nothing. Built-in widgets already do this; your custom
`View`s must too (see `widget-authoring.md`). A view given an explicit fixed `size` or an absolute
`rect` does not need `measure()`.

## Window / Dialog padding

`Window` and `Dialog` default to `padding: 1` (the border inset). An absolute-positioned child's
rect is measured **inside** that padding — so a child at `{ x: 1, y: 1 }` sits one cell in from the
frame. If child positions look doubly inset, that padding is why; account for it, or set the
container's `padding: 0` and position children yourself.

## Centering caveat

A `Dialog` created with a `width`/`height` (and no `rect`) auto-centers on every reflow — convenient,
but it re-centers on resize, so you cannot then drag it freely. Give an explicit `rect` when you want
a fixed, movable position.
