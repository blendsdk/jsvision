---
title: Group
description: Compose JSVision views in deterministic paint order with shared layout, background, focus, and reactive child ownership.
---

# Group

`Group` is JSVision's retained container. It owns an ordered `children` array, gives each child a
nested lifecycle scope, participates in layout, and paints later children over earlier ones. It is
the foundation beneath rows, columns, dialogs, windows, and most composite controls.

Use a `Group` when several views should move, resize, dispose, or receive focus as one subtree.

## Usage

```ts
import { Group, Text, at } from '@jsvision/ui';

const panel = new Group();
panel.background = 'dialog';
panel.add(at(new Text('First layer'), 1, 1, 20, 1));
panel.add(at(new Text('Painted second'), 1, 2, 20, 1));
```

## Live example

<PlayExample id="foundations/group" title="Group composition laboratory" blurb="Add a dynamic overlay and inspect how child order, background fill, layout, and disposal work together." />

Press **Alt+A** to add or remove the overlay. The status readout exposes the exact retained child
order, while the miniature stage makes the front-most layer obvious.

## Props and public state

`Group` extends `View` without constructor options and adds this retained-container surface:

| Member                       | Purpose                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| `children: View[]`           | Ordered retained children, back-to-front for painting.                   |
| `background?: ThemeRoleName` | Optional role used to clear the full group before children paint.        |
| `current: View \| null`      | Focus-manager pointer to the focused child in this subtree.              |
| `add(view)`                  | Append and, when live, mount a child immediately.                        |
| `remove(view)`               | Unmount, dispose, detach, and re-home focus when necessary.              |
| `addDynamic(builder)`        | Reconcile children produced by `Show` or `For` inside the group's scope. |

`remove` is safe for a non-child and repeated removal. A removed subtree is not merely hidden: its
reactive effects and cleanup callbacks are disposed.

## Size and Layout

A plain `Group` uses the same layout properties as every `View`. Set `direction`, `gap`, `padding`,
and child sizes for flow layout, or add children with `at(...)` for an explicit stage. The parent
solves the group's bounds; the group then solves its children inside that space.

Background fill covers the complete solved rectangle. Set one for overlapping or conditionally
removed content so cells from a previous frame cannot leak through.

## Children and paint order

Children paint in array order. The first child is the back layer; every later child can cover it.
`add` therefore both retains a view and places it at the front of the group's local z-order.

```ts
import { Group } from '@jsvision/ui';

const group = new Group();
group.add(background);
group.add(content);
group.add(overlay); // front-most
```

For application windows, use [`Desktop`](/components/application/desktop), whose `raise` operation
manages window z-order and active state. Directly mutating `children` bypasses mount, focus, and
invalidation bookkeeping.

## Dynamic composition

`addDynamic` accepts a factory that creates a reactive `Show` or `For` producer. Constructing the
producer inside that factory is important: it places reconciliation under the group's owner, so
unmounting the group also stops future child updates.

```ts
import { Show } from '@jsvision/ui';

group.addDynamic(() =>
  Show(
    () => detailsOpen(),
    () => new DetailsPanel(),
  ),
);
```

When a produced view disappears, it is unmounted and disposed. Use visibility only when identity
and internal state should survive; use dynamic composition when absence should release resources.

## Best Practices

- Add and remove through the public methods; never splice `children` yourself.
- Set a background on regions whose children overlap or appear conditionally.
- Keep paint order intentional and document non-obvious overlays near their construction.
- Build `Show` and `For` inside the `addDynamic` callback so ownership is correct.
- Prefer small, purpose-named groups over one container that owns an entire screen's behavior.

## Theming

`Group` only paints when `background` is set; children choose their own roles. The lab uses
`dialog` for its stable surface, `staticText` for base/detail layers, and `warningText` for the
front overlay. Ensure a group's background agrees with the surface its children expect, especially
when embedding controls designed for dialogs inside windows.

## Related

- [View](/components/foundations/view) — the lifecycle and drawing base inherited by `Group`.
- [Desktop](/components/application/desktop) — specialized window composition and z-order.
- [Dialog](/components/containers/dialog) — a framed, focus-scoped group.
- [Group API](/api/ui/classes/Group) — child ownership and dynamic composition methods.
