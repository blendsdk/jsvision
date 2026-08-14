---
title: Desktop
description: Manage JSVision windows with activation, z-order, moving, resizing, zooming, tiling, cascading, and keyboard switching.
---

# Desktop

`Desktop` is JSVision's interactive window manager. It fills the application body with the
`desktop` pattern, retains `Window` children in back-to-front order, tracks one active window, and
coordinates focus, dragging, resizing, zooming, arranging, and keyboard switching.

Most applications obtain it as `app.desktop` from `createApplication()` rather than constructing
one directly.

## Usage

```ts
import { createApplication, Window } from '@jsvision/ui';

const app = createApplication();
const editor = new Window('Editor');
editor.number = 1;
editor.setLayout({ rect: { x: 2, y: 1, width: 36, height: 12 } });
app.desktop.addWindow(editor);
```

## Live example

<PlayExample id="application/desktop" title="Desktop window-manager laboratory" blurb="Switch the active miniature window, inspect front-to-back order, and toggle tiled versus overlapping arrangement." />

The centered lab models a two-window workspace inside the stable shell. **Alt+N** switches the
active/front window; **Alt+T** toggles the arrangement.

## Props and public state

| Member                                       | Purpose                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| `shadow`                                     | Apply drop shadows to current and future windows.     |
| `resizeMode`                                 | Default `live` or `outline` mouse resize behavior.    |
| `activeWindow()`                             | Return the currently active/front window or `null`.   |
| `addWindow(window)` / `removeWindow(window)` | Manage ownership, active state, focus, and repaint.   |
| `raise(window)`                              | Bring an owned window to the front and focus into it. |
| `cascade()` / `tile()`                       | Reposition every managed window.                      |
| `focusNextWindow()` / `focusPrevWindow()`    | Cycle activation through z-order.                     |
| `focusWindowNumber(n)`                       | Activate a numbered window, used by **Alt+1…9**.      |

`Desktop` extends `Group`, but its window methods preserve manager seams and activation invariants;
do not add or splice `Window` children through the base container API.

## Size and Layout

The desktop normally receives every body cell between menu and status rows. Window rectangles are
desktop-local. Tiling divides the available grid; cascading offsets windows while clamping useful
content on-screen. A viewport resize re-maximizes zoomed windows and clamps their saved restore
rectangles.

Windows may overlap or extend beyond an edge. Choose minimum dimensions that leave frame controls
and content usable.

Set `app.desktop.resizeMode = 'outline'` when most windows host expensive responsive content. The
Window frame then follows the pointer as an empty shell with centered dimensions; its child subtree
reflows and paints once on release. An individual Window can override that default with its own
`resizeMode`; an unset Window inherits it.

## Activation and z-order

The `children` order is z-order: last is front-most. Adding or raising a window deactivates the
previous active window, updates both frames, and focuses into the new active subtree. Clicking a
window's frame or content raises it before delivering the click.

```ts
import type { Desktop } from '@jsvision/ui';

function showInspector(desktop: Desktop, inspector: Window): void {
  desktop.raise(inspector);
}
```

Only windows owned by that desktop can be raised. Removing the active window activates and focuses
the next window down.

## Window arrangement

`tile()` lays all windows out in a grid; `cascade()` restores an overlapping stepped workspace.
The standard desktop commands also cover next, previous, zoom, close, tile, and cascade after the
focused child has had a chance to handle the event.

Use `number` for discoverable direct switching. Reserve global arrangement commands for desktop
applications; a custom-content application has no desktop manager.

## Best Practices

- Add and remove windows through `Desktop`, not inherited `Group` methods.
- Assign stable window numbers only when direct switching is useful.
- Put a focusable control inside each window so activation has a meaningful focus target.
- Keep restored rectangles within practical terminal sizes and test resize behavior.
- Use one `Desktop` per application body; use groups for nested visual layers.

## Theming

`desktop` supplies the repeating background. Active windows use `window`; inactive frames use
`windowInactive`. Their difference should remain visible without relying only on hue, while title,
border, icon, and content contrast must survive low-color terminals.

## Related

- [Window](/components/application/window) — the managed framed container.
- [Application](/components/application/application) — owns and wires the default desktop.
- [Group](/components/foundations/group) — the retained-container behavior Desktop specializes.
- [Desktop API](/api/ui/classes/Desktop) — arrangement, focus, and ownership methods.
