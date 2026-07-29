---
title: View
description: Build a custom JSVision widget with explicit drawing, layout, input, focus, and reactive lifecycle behavior.
---

# View

`View` is the abstract base of every visual object in JSVision. A view owns persistent identity,
parent-relative bounds, focus and visibility state, layout intent, a clipped drawing surface, and a
reactive scope that lasts exactly as long as the view is mounted.

Subclass `View` when the shipped controls cannot express the rendering or interaction you need. For
ordinary composition, prefer [`Group`](/components/foundations/group) and existing controls: a
custom view deliberately makes you responsible for drawing and input semantics.

## Usage

```ts
import { View, type DrawContext } from '@jsvision/ui';

class Meter extends View {
  draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('dialog'));
    ctx.text(0, 0, 'CPU 42%', ctx.color('staticText'));
  }
}
```

## Live example

<PlayExample id="foundations/view" title="Custom View laboratory" blurb="Focus and activate a hand-drawn View, then watch its signal-backed state repaint without rebuilding the tree." />

The lab exposes the view's bounds, focus state, custom paint region, and action feedback. Press
**Alt+K** or click the canvas to focus and activate it.

## Props and public state

`View` has no constructor options. Subclasses configure its public surface directly:

| Member                     | Purpose                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `bounds: Rect`             | Solved parent-relative geometry; read it during drawing and hit testing.           |
| `state`                    | Mutable `visible`, `disabled`, and `focused` flags used by rendering and dispatch. |
| `layout`                   | Read-only layout intent; update it through `setLayout(...)`.                       |
| `focusable` / `grabsFocus` | Opt into keyboard focus and choose whether mouse-down claims it.                   |
| `centered` / `castsShadow` | Optional composition behavior used by floating surfaces.                           |

The two core extension types are `DrawContext`, passed to `draw`, and `DispatchEvent`, passed to
`onEvent`. Both are exported from `@jsvision/ui`.

The lifecycle helpers `onMount`, `bind`, and `onCleanup` attach work to the view's owned reactive
scope. Removing the view disposes those effects and cleanups with its descendants.

## Size and Layout

`bounds` is an output, not a placement API. Parents solve it from `layout`; call `setLayout` to
change fixed, fractional, automatic, or absolute placement. Implement `measure(available)` when
`auto` sizing should use a natural size. Use `invalidate()` for pixel-only changes and
`invalidateLayout()` when visibility, size, or placement changed.

Drawing is clipped to the solved rectangle, so over-wide text cannot corrupt siblings. A zero-sized
view remains in the tree but paints nothing.

## Drawing and invalidation

`draw(ctx: DrawContext)` receives a view-local canvas: `(0, 0)` is the top-left of the view, and
`ctx.size` is the usable cell grid. Resolve colors through named roles such as `dialog`,
`staticText`, or `labelShortcut`; never bake terminal color numbers into a widget.

```ts
import type { DrawContext } from '@jsvision/ui';

draw(ctx: DrawContext): void {
  const role = this.state.focused ? 'labelShortcut' : 'staticText';
  ctx.fill(' ', ctx.color('dialog'));
  ctx.text(1, 1, this.readValue(), ctx.color(role));
}
```

A reactive getter does not automatically repaint an arbitrary subclass. Register
`this.bind(() => signal())` inside `onMount`, or call `invalidate()` after non-reactive state
changes.

## Input and focus

Set `focusable = true` for a keyboard target, then override `onEvent(ev: DispatchEvent)`. Inspect
`ev.event`, act only on supported keys or pointer gestures, and set `ev.handled = true` after
consuming one. Leaving an event unhandled allows parent post-processors and application commands to
see it.

```ts
import type { DispatchEvent } from '@jsvision/ui';

onEvent(ev: DispatchEvent): void {
  if (ev.event.type === 'key' && ev.event.key === 'space') {
    this.toggle();
    ev.handled = true;
  }
}
```

`focusSignal()` lets another view react to this view gaining or losing focus. `preProcess` and
`postProcess` are advanced routing hooks for scoped accelerators and container commands.

## Best Practices

- Subclass only for genuinely custom pixels or event behavior; compose shipped views for forms.
- Treat `bounds` as solved state and preserve layout intent with `setLayout`.
- Consume only events the view owns so application shortcuts keep working.
- Tie subscriptions and resources to mount scope; never create unowned effects in a constructor.
- Provide a visible focused state and an equivalent keyboard path for every mouse action.

## Theming

`View` has no private theme role. Its subclass selects roles from the active theme. The example uses
`dialog` for its surface, `staticText` for normal content, and `labelShortcut` for the active/focused
accent. Choose semantic roles that remain legible in monochrome and low-color terminals.

## Related

- [Group](/components/foundations/group) — retain and compose child views.
- [Application](/components/application/application) — mount a view tree with terminal services.
- [View API](/api/ui/classes/View) — lifecycle, layout, focus, and invalidation members.
- [DrawContext API](/api/ui/interfaces/DrawContext) — clipped cell-painting operations.
