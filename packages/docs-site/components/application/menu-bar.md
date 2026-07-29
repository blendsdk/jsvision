---
title: Menu Bar
description: Build accessible JSVision application menus with nested command data, keyboard and pointer navigation, enablement, dynamic replacement, and overlay-hosted popups.
---

# Menu Bar

`MenuBar` is the application's top-row command navigator. It renders top-level menu titles, opens
nested popups in the application overlay, routes commands through the event loop, and keeps
disabled items visibly inert. It sees keys before the focused content, so menu access remains
available throughout the application.

Build it with `menuBar`, `subMenu`, `item`, `separator`, and `menuSpacer`, then pass it to
`createApplication`.

## Usage

```ts
import { createApplication, item, menuBar, subMenu } from '@jsvision/ui';

const menus = menuBar([
  subMenu('~F~ile', [item('~O~pen', 'file.open', 'Ctrl+O'), item('~S~ave', 'file.save', 'Ctrl+S')]),
]);
const app = createApplication({ menuBar: menus });
```

## Live example

<PlayExample id="application/menu-bar" title="Menu Bar laboratory" blurb="Open the real File menu, activate an item accelerator, and add or remove a top-level Tools menu dynamically." />

Press **Alt+L**, then **O**, to activate Open through the real menu state machine. Use **Alt+D** to
replace the live menu data with a variant that includes Tools.

## Props and public state

`MenuBar` exposes `items: readonly MenuItem[]`, its attached `controller`, and `setItems(items)`.
The `menuBar(items)` builder constructs it from plain data:

| Builder                      | Result                                                |
| ---------------------------- | ----------------------------------------------------- |
| `subMenu(title, items)`      | Nested branch; `~X~` marks the title accelerator.     |
| `item(title, command, key?)` | Leaf that emits a named command.                      |
| `separator()`                | Non-selectable visual grouping row.                   |
| `menuSpacer(weight?)`        | Flexible top-level gap, commonly right-aligning Help. |

`setItems` closes any open popup, replaces the data, rebuilds navigation, and repaints the bar.

## Size and Layout

The bar occupies one fixed row across the application. Titles are packed left-to-right with one
cell of side padding. A `menuSpacer` absorbs remaining width; popups clamp within the overlay
viewport and can open left or upward near an edge.

Keep labels and key hints concise enough for narrow terminals. Deep nesting remains supported, but
wide or multi-level structures become hard to scan in a cell grid.

## Menus and commands

Menu nodes are plain `MenuItem` data, while command behavior lives in application handlers.
This lets a menu, status item, button, and keymap share one command and one enablement rule.

```ts
import type { Application, MenuBar } from '@jsvision/ui';

function showContextMenus(app: Application, bar: MenuBar): void {
  bar.setItems(app.menuBase());
}
```

Disabling a command through `app.loop.enableCommand(name, false)` greys its item and prevents
activation. Re-enabling restores both appearance and behavior.

## Keyboard navigation

| Input                | Result                                                                |
| -------------------- | --------------------------------------------------------------------- |
| **F10**              | Open or close the first top-level menu.                               |
| **Alt+title letter** | Open that top-level menu from anywhere.                               |
| **Up / Down**        | Move through selectable rows, skipping separators and disabled items. |
| **Left / Right**     | Switch top-level menus or enter/leave nested branches.                |
| **Enter**            | Open the highlighted submenu or emit the highlighted command.         |
| Item hotkey letter   | Activate that item while its menu is open.                            |
| **Escape**           | Close one level, then the complete menu.                              |

Mouse clicks open titles and select popup rows. An outside click closes the popup stack and restores
the previously focused view.

## Best Practices

- Keep menu behavior in named command handlers rather than builder callbacks.
- Give accelerators unique letters at each menu level.
- Group destructive or infrequent commands with separators, without over-segmenting short menus.
- Use `menuSpacer` for a conventional right-aligned Help menu.
- Test narrow viewports, disabled commands, nested escape behavior, and focus restoration.

## Theming

`menuBar` paints the normal row and accelerator accent, `menuSelected` marks the open title and
highlighted popup row, and `menuDisabled` greys unavailable commands. Ensure each role remains
distinct from the dialog below it and that selected/disabled states do not rely on hue alone.

## Related

- [Application](/components/application/application) — owns the bar, overlay, and command loop.
- [Status Line](/components/application/status-line) — compact command hints using the same registry.
- [Router](/components/application/router) — swaps per-screen menu contributions.
- [MenuBar API](/api/ui/classes/MenuBar) and [menuBar API](/api/ui/functions/menuBar).
