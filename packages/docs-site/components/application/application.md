---
title: Application
description: Assemble and run a complete JSVision terminal application with chrome, commands, focus, themes, terminal services, and deterministic teardown.
---

# Application

`createApplication` is the top-level assembly API for a JSVision program. It combines an event
loop, render root, focus manager, theme, terminal capabilities, commands, optional menu/status
chrome, and either a window-managing `Desktop` or a caller-owned content view.

Use it once at the application boundary. Components should receive the narrow host services they
need instead of creating nested applications.

## Usage

```ts
import { createApplication, Window } from '@jsvision/ui';

const app = createApplication();
const window = new Window('Workspace');
window.setLayout({ rect: { x: 2, y: 1, width: 40, height: 12 } });
app.desktop.addWindow(window);
await app.run();
```

## Live example

<PlayExample id="application/application" title="Application command laboratory" blurb="Dispatch an app-wide command, toggle its enablement, and inspect how the shell owns focus and lifecycle." />

Use **Alt+R** to dispatch the Run command and **Alt+E** to enable or disable it. The lab keeps
command routing visible without replacing the stable documentation shell.

## Props and public state

`ApplicationOptions` configures `createApplication`:

| Option                      | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `caps`, `viewport`, `theme` | Terminal capabilities, initial cell grid, and active role palette.  |
| `menuBar`, `statusLine`     | Optional one-row application chrome.                                |
| `content`                   | Custom full-screen body; omit it to receive a `DesktopApplication`. |
| `keymap`                    | Additional app-wide chord-to-command bindings.                      |
| terminal/clipboard options  | Host integration used by `run()` and editing controls.              |

The returned `Application` exposes `loop`, `i18n`, `onCommand`, `setTheme`, `statusBase`,
`menuBase`, and `run`. A no-content call returns a `DesktopApplication` whose `desktop` is present;
a custom-content call returns a router-style application where `desktop` is `undefined`.

## Size and Layout

The application root is a column: optional menu row, body, optional status row, then the overlay
layer. The body receives all remaining cells. `viewport` is an initial size for headless or hosted
composition; the event loop's resize path updates layout when the terminal changes.

Windows are positioned inside `app.desktop.bounds`. A custom `content` view is sized to the body
and owns its internal layout.

## Commands and keymaps

Menus, status items, views, and keymaps all emit named commands through the same loop. Register
application behavior with `onCommand` and keep the command name stable across input methods.

```ts
import { createApplication, createKeymap } from '@jsvision/ui';

const app = createApplication({
  keymap: createKeymap({ 'ctrl+s': 'document.save' }),
});
app.onCommand('document.save', () => saveDocument());
app.loop.enableCommand('document.save', isDirty());
```

Enablement is queried before a command fires and also drives disabled menu/status styling. Avoid
duplicating business behavior inside each button or shortcut.

## Lifecycle and host integration

`run()` connects the terminal, processes events until the quit command, and restores terminal
state on normal exit or failure. Browser documentation and tests can drive the same `loop`
directly without opening a TTY.

Use the application services for modal execution, focus, theme changes, clipboard delivery, and
command registration. Dispose the loop in an embedded host when the example or panel is removed.

## Best Practices

- Create one application at the process or embedded-host boundary.
- Map every action to a named command and centralize enablement.
- Pass explicit `caps` and `viewport` in browsers and deterministic tests.
- Use custom `content` for full-screen routers; use the default desktop for windows and dialogs.
- Treat `run()` as the terminal ownership boundary and always let it perform restoration.

## Theming

The shell resolves `desktop`, `menuBar`, `statusBar`, and `dialog` roles from the active theme.
`setTheme` recomposes the current tree without rebuilding application state. Keep custom content on
semantic roles so menu, status, desktop, and centered dialog remain coherent at every color depth.

## Related

- [Desktop](/components/application/desktop) — the default window-managing body.
- [Router](/components/application/router) — a custom full-screen content body.
- [Menu Bar](/components/application/menu-bar) and [Status Line](/components/application/status-line).
- [createApplication API](/api/ui/functions/createApplication) — complete `ApplicationOptions`.
- [Application API](/api/ui/interfaces/Application) — runtime services and lifecycle.
