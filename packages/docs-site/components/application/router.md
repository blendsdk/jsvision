---
title: Router
description: Build a typed full-screen JSVision navigation stack with params, back/replace/reset operations, focus restoration, keep-alive screens, and per-screen chrome.
---

# Router

`createRouter` builds a typed stack of full-screen views. Each route declares its parameter type
and a screen builder; `push`, `back`, `replace`, and `reset` update the visible screen while the
router coordinates disposal, optional keep-alive state, focus restoration, and menu/status chrome.

Pass the resulting `Router` as `createApplication({ content: router })`. It replaces the desktop
window manager rather than living inside one of its windows.

## Usage

```ts
import { createApplication, createRouter, Group } from '@jsvision/ui';

type Routes = { home: void; detail: { id: number } };
const router = createRouter<Routes>({
  initial: { name: 'home' },
  routes: {
    home: { build: () => ({ view: new Group() }) },
    detail: { build: ({ params }) => ({ view: new DetailScreen(params.id) }) },
  },
});
const app = createApplication({ content: router });
```

## Live example

<PlayExample id="application/router" title="Router stack laboratory" blurb="Push, go back, replace, and reset a real typed screen stack while location and back availability update live." />

Use **Alt+N** to push Detail, **Alt+B** to go back, **Alt+P** to replace with Settings, and
**Alt+R** to reset to Home.

## Props and public state

`createRouter` accepts `RouterOptions<R>`, containing an `initial` typed location, a complete
`routes: RouteMap<R>`, and an
optional logger. Each `Route<P>` provides `build(ctx)`, with optional `keepAlive`, `focusKey`,
`serialize`, and `parse`.

The returned `Router<R>` exposes:

| Member                   | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `push(name, params?)`    | Add and activate a screen.                                  |
| `back()`                 | Pop one screen; returns `false` at the root.                |
| `replace(name, params?)` | Replace the top without changing stack depth.               |
| `reset(name, params?)`   | Dispose the stack and establish one new root.               |
| `location()`             | Reactive current route name and params.                     |
| `canGoBack()`            | Reactive indication that the stack has more than one frame. |

## Size and Layout

`Router` extends `Group` and fills the application's custom-content body. It gives each built screen
fractional size so the active view fills the available area. Kept-alive screens stay mounted but
hidden and do not consume layout space.

Route builders return the root screen view, not an application or desktop window. Put the screen's
own rows, columns, scrolling, and dialogs beneath that root.

## Navigation stack

`push` saves the current focus, builds the next screen, and disposes the old view unless its route
is kept alive. `back` either reveals the warm instance or rebuilds a disposed screen. `replace`
keeps the depth; `reset` collapses every frame, including warm ones.

```ts
import type { Router } from '@jsvision/ui';

function openRecord(router: Router<Routes>, id: number): void {
  router.push('detail', { id });
}
```

If a route builder throws, the router logs the failure and leaves the current stack unchanged.

## Focus and chrome

When used as application content, the router receives focus and chrome seams automatically. It
restores a warm screen's exact focused view; rebuilt screens use `focusKey`, structural position,
then the first focusable view as fallbacks.

A `ScreenBundle` may provide `menu` or `status` items. Present values replace the live bar for that
screen; omission restores the application's base chrome. Use `withBase` when screen actions should
be composed with global items.

## Best Practices

- Model route params in the `Routes` type so invalid navigation fails at compile time.
- Keep screens alive only when preserving expensive state outweighs retained resources.
- Use `reset` after authentication or workspace changes that invalidate navigation history.
- Provide stable focus keys when rebuilt screens can reorder their controls.
- Keep route builders deterministic and handle data-loading state inside the screen.

## Theming

The router itself has no visible chrome role. Its active screen selects normal control roles, while
the shell continues to paint `menuBar`, `statusBar`, and the centered lab's `dialog` surface.
The lab's actions use `button` and its focused variants, while route readouts use `staticText`.
Screen-specific chrome must preserve the same contrast and accelerator treatment as the base bars.

## Related

- [Application](/components/application/application) — wires router content and its host seams.
- [View](/components/foundations/view) and [Group](/components/foundations/group) — screen roots.
- [Menu Bar](/components/application/menu-bar) and [Status Line](/components/application/status-line).
- [createRouter API](/api/ui/functions/createRouter) and [Router API](/api/ui/interfaces/Router).
