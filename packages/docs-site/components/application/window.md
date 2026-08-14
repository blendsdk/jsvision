---
title: Window
description: Host application content in a movable, resizable, zoomable, closable JSVision frame with active/inactive state and desktop-managed focus.
---

# Window

`Window` is a titled, framed `Group` managed by a `Desktop`. It owns one-cell content padding,
active/inactive frame state, optional close and zoom boxes, resize grips, movement constraints, a
window number, and a saved restore rectangle.

Use windows for independent work surfaces that users arrange. Use a
[`Dialog`](/components/containers/dialog) for a focused task or decision.

## Usage

```ts
import { createApplication, Text, Window, at } from '@jsvision/ui';

const app = createApplication();
const window = new Window('Output');
window.setLayout({ rect: { x: 3, y: 2, width: 40, height: 10 } });
window.resizeMode = 'outline'; // defer expensive content reflow until mouse release
window.add(at(new Text('Build complete'), 0, 0, 30, 1));
app.desktop.addWindow(window);
```

## Live example

<PlayExample id="application/window" title="Window state laboratory" blurb="Zoom and restore a real nested Window, compare frame policies, and verify that a protected teaching surface cannot disappear." />

Press **Alt+Z** to zoom or restore the specimen and **Alt+C** to test its protected close policy.

## Props and public state

`Window` extends `Group` and exposes these frame and manager-facing members:

| Member                                         | Purpose                                                  |
| ---------------------------------------------- | -------------------------------------------------------- |
| `title: Signal<string>`                        | Reactive centered frame title.                           |
| `active`, `dragging`, `resizing`               | Reactive activation and gesture state.                   |
| `number`                                       | Optional 1–9 accelerator displayed in the frame.         |
| `movable`, `resizable`, `zoomable`, `closable` | Enable individual frame affordances.                     |
| `minWidth`, `minHeight`                        | Gesture-enforced resize floor.                           |
| `resizeMode`                                   | Inherit Desktop resize behavior or select a local mode.  |
| `zoom()` / `isZoomed()`                        | Toggle and inspect maximized state.                      |
| `close()`                                      | Ask the owning `Desktop` to remove this closable window. |

`Desktop` owns activation and manager attachment. A standalone window can render, but it cannot
move, resize, close itself from a manager, or participate in z-order.

## Size and Layout

`Window` is absolutely positioned and includes `padding: 1`; child coordinates begin inside its
frame. Set a complete rectangle before adding it to a desktop. Flow-laid children reflow with the
interior; subclasses with absolute children can override `onResized` to re-pin them.

The default resize minimum is 10×3 cells. Raise it when content requires a larger usable interior.

## Activation and window state

The active window uses the front-most frame role and receives focus into its first suitable child.
Clicking any part of an inactive window raises it before the click reaches content. The first click
on inactive close, zoom, or resize chrome only activates; a second click performs the action.

```ts
import type { Window } from '@jsvision/ui';

function protectToolWindow(window: Window): void {
  window.closable = false;
  window.resizable = false;
}
```

`zoom()` stores the restored rectangle, fills the desktop, and later restores the exact saved
placement. Tiling and cascading clear saved zoom state before arranging.

## Moving and resizing

Title dragging moves a movable window. Corner grips resize from the right or left while respecting
minimum dimensions and pointer capture. `dragging()` is true for move and resize gestures;
`resizing()` identifies only corner resizing.

The default `live` mode updates the Window rectangle and reflows its content for every pointer
position. Use `outline` for a Kanban, Data Grid, editor, or another expensive responsive workspace:
an empty Window shell follows the pointer with its size centered in the interior, while the hosted
child subtree stays out of layout and paint until it reflows once on release.

```ts
window.resizeMode = 'outline';
```

An unset Window mode inherits `app.desktop.resizeMode`. Capture loss restores the original Window
rectangle and content without publishing the shell candidate as a completed resize.

Viewport resizing keeps zoomed windows maximized and clamps their restore target back on-screen.
Non-zoomed windows retain their authored rectangle even if it overflows.

## Best Practices

- Add and remove windows through `Desktop` so manager, active state, and focus remain consistent.
- Give every window useful focusable content and a concise, reactive title.
- Set minimum dimensions from actual content needs, not frame size alone.
- Prefer `outline` when live content reflow cannot keep pace with terminal mouse reports but users
  still need the Window frame to track the pointer.
- Disable close only when another discoverable route cannot reopen the surface.
- Use dialogs for modal validation and short-lived decisions.

## Theming

Active frame and interior use `window`; inactive frames use `windowInactive`. A nested teaching
dialog uses `dialog`, which intentionally has a different surface. Both window roles define border,
title, and icon colors; preserve a visible state distinction in monochrome and low-color themes.

## Related

- [Desktop](/components/application/desktop) — ownership, activation, gestures, and arrangement.
- [Dialog](/components/containers/dialog) — modal/modeless task surface derived from Window.
- [Group](/components/foundations/group) — retained child composition inherited by Window.
- [Window API](/api/ui/classes/Window) — frame flags, state, and lifecycle methods.
