---
title: The application shell
description: Build a complete JSVision application with menu and status chrome, a Desktop or custom body, commands, quit, and safe lifecycle cleanup.
---

# The application shell

## Who this course is for

This course is for developers building an editor, dashboard, workspace, or other terminal
application that needs a consistent menu, status line, content region, and quit path. It assumes you
are already comfortable with event routing, commands, and keymaps from
[Events, commands & keymaps](/guide/events-commands-and-keymaps).

By the end you can build a complete application, explain who owns each shell region, diagnose
missing chrome and unhandled window commands, and verify quit and restoration behavior in headless,
terminal, and embedded hosts.

## Mental model

`createApplication()` mounts and owns one event loop and one retained shell view tree:

```text
application root
├─ menu bar       optional, one cell high
├─ body           remaining rows (`fr: 1`)
├─ status line    optional, one cell high
└─ popup overlay  full shell, normally hidden
```

The menu bar, body, status line, and overlay are siblings in paint order. The body is either the
default `Desktop` window manager or the single custom `content` view supplied by the caller. The
application owns the mounted event loop and shell view tree; your code owns the views and command
handlers it adds.

## Your first complete application

Create the chrome, add a window to the default Desktop, and await the application:

```ts
import { Commands, Text, Window, createApplication, statusItem, statusLine } from '@jsvision/ui';

const app = createApplication({
  statusLine: statusLine([statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X')]),
});
const window = new Window('Workspace');
window.add(new Text('Ready'));
app.desktop.addWindow(window);
const exitCode = await app.run();
```

`Commands.quit` supplies the intent and the status item supplies a reachable input path.
`app.run()` resolves with the exit code after the quit command is accepted.

<PlayExample id="guides/application-chrome" title="Application Chrome Laboratory" blurb="Exercise menu, status, content, and a host-safe quit request while the embedded lesson remains alive." />

Try Alt+M, Alt+Q, and both buttons. The quit action is intentionally a visible quit request: an
embedded browser lesson must remain alive and open so you can continue experimenting.

## Shell anatomy

The shell controls body geometry. Menu and status chrome each consume one cell row. The body fills
the remaining space, so a 24-row viewport with both rows gives the body 22 rows. The popup overlay
covers the shell only while a menu or dropdown is open.

Pass an explicit viewport and capabilities in tests:

```ts
import { createApplication } from '@jsvision/ui';

declare const caps: Parameters<typeof createApplication>[0]['caps'];
const app = createApplication({
  caps,
  viewport: { width: 80, height: 24 },
});
```

Do not pre-position the body. `createApplication()` clears caller body layout and gives it the
remaining fractional space so resize stays coherent.

## Menu and status chrome

Menus, status items, buttons, and keymaps should emit the same command vocabulary:

```ts
import { Commands, item, menuBar, statusItem, statusLine, subMenu } from '@jsvision/ui';

const menu = menuBar([subMenu('~F~ile', [item('E~x~it', Commands.quit, 'Alt+X')])]);
const status = statusLine([statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X')]);
```

For a screen-aware body, `menuBase()` returns a shallow copy of plain menu data.
`statusBase()` reconstructs fresh new **command-item views only** on every call because a view can
have only one parent. Passive spacers and custom widget segments are deliberately excluded; compose
those explicitly for each screen. `menuBase()` shallow-copies top-level plain menu data. Compose
screen-specific extras without re-parenting the live base:

```ts
import { createApplication, statusItem, withBase } from '@jsvision/ui';

declare const app: ReturnType<typeof createApplication>;
const screenStatus = withBase(app.statusBase(), [statusItem('~H~elp', 'screen.help', 'F1')]);
const screenMenu = app.menuBase();
```

The [MenuBar](/components/application/menu-bar) and
[StatusLine](/components/application/status-line) pages own their detailed interaction APIs.

## The Desktop body

Omit `content` to receive a `DesktopApplication`; `app.desktop` is a real
[Desktop](/components/application/desktop) with overlapping windows, z-order, active-window state,
dragging, resizing, zoom, cascade, and tile:

```ts
import { Text, Window, createApplication } from '@jsvision/ui';

const app = createApplication();
const log = new Window('Log');
log.add(new Text('Connected'));
app.desktop.addWindow(log);
```

Use the Desktop body for multi-window tools where users compare or arrange independent workspaces.
The [Window](/components/application/window) page owns window chrome and geometry details.

## Custom-content bodies

Pass `content` when the application has one full-screen body:

```ts
import { Group, createApplication } from '@jsvision/ui';

const content = new Group();
const app = createApplication({ content: content });
console.log(app.desktop); // undefined
```

This returns the custom-content `RouterApplication` shape: `desktop` is `undefined` and no window
manager is mounted. A [Router](/components/application/router) is one suitable body, but
[Screens & routing](/guide/screens-and-routing) owns typed routes, navigation history, parameters,
and screen retention. This course stops at choosing and hosting the body.

<PlayExample id="guides/application-bodies" title="Application Bodies Laboratory" blurb="Compare Desktop and custom content ownership, window-command availability, and lifecycle boundaries." />

Use Alt+B or **Switch body**. The lab constructs both real application shapes but presents only the
ownership decision; routing depth belongs to the later course.

## Window commands

A Desktop body registers and handles the built-in window vocabulary:

| Command            | Desktop effect                        |
| ------------------ | ------------------------------------- |
| `Commands.close`   | Close the active window               |
| `Commands.zoom`    | Maximize or restore the active window |
| `Commands.next`    | Activate the next window              |
| `Commands.prev`    | Activate the previous window          |
| `Commands.cascade` | Arrange windows in an offset stack    |
| `Commands.tile`    | Partition the Desktop among windows   |

```ts
import { Commands, createKeymap } from '@jsvision/ui';

const keymap = createKeymap({
  f5: Commands.zoom,
  f6: Commands.next,
  'alt+t': Commands.tile,
});
```

These are Desktop-only commands. A custom-content or Router body does not register window commands;
if emitted, they remain available for that body to handle as application intents. Do not show Tile
or Cascade as enabled shell actions when there is no Desktop.

## Composition and integration

Shell composition connects earlier concepts:

- Layout gives chrome fixed rows and the body remaining space.
- Reactive state drives command availability and visible status.
- Focus selects the active window or custom-body control.
- Commands unify menu, status, button, and keymap actions.
- Dialogs add modal scope above the body.
- Theme changes repaint the complete mounted shell.

Register application command handlers with their owner and dispose them together:

```ts
import type { Application, View } from '@jsvision/ui';

declare const app: Application;
declare const owner: View;
owner.onMount(() => {
  const stop = app.onCommand('workspace.refresh', () => {
    // Refresh the workspace owned by this view.
  });
  owner.onCleanup(stop);
});
```

## Advanced lifecycle behavior

### Quit and terminal restoration

`Commands.quit` is the default termination intent. `app.run()` returns a `Promise<number>` and
resolves with the command's exit code. A modal may veto quit; the request cascades through the
modal stack before reaching the application.

The runtime always restores raw mode and the alternate screen in a `finally` path—after normal quit,
a thrown error, or a host signal. Await `run()` instead of abandoning its promise:

```ts
import { createApplication } from '@jsvision/ui';

const app = createApplication();
try {
  const code = await app.run();
  process.exitCode = code;
} finally {
  // Application-owned resources can be released here.
}
```

In a browser, the host mounts the same application through `@jsvision/web`. In the docs Play host,
the ordinary `Commands.quit` path closes the embedded Play surface. The two persistent laboratories
in this course deliberately bind a separate demonstration-only **quit request** command so the
showcase stays alive and open. Do not generalize that teaching command into a browser-host contract:
a production embed decides explicitly whether quit closes, hides, or delegates its surface.

`run()` stops input and restores terminal modes, but it does not unmount the retained view tree or
fire every view cleanup callback. A native process normally ends after `run()` resolves. A reusable
browser host instead calls its mounted handle's `dispose()`, which disposes the loop, unmounts the
tree, and releases view-owned resources. In tests or long-lived hosts, call `app.loop.dispose()` when
the application object itself is finished.

### Theme and capability changes

`app.setTheme(theme)` repaints every mounted region. The shell uses these exact theme roles:

| Region or state          | Theme role                    |
| ------------------------ | ----------------------------- |
| Desktop backdrop         | `desktop`                     |
| Menu normal / active     | `menuBar`, `menuSelected`     |
| Status normal / pressed  | `statusBar`, `statusSelected` |
| Active / inactive window | `window`, `windowInactive`    |

Chrome actions must remain keyboard reachable, with visible focus and discoverable hotkeys or
accelerators. Provide ASCII-safe or monochrome labels and non-colour cues such as “enabled,”
“unavailable,” “yes,” and “no”; colour cannot be the only state marker.

## Failure modes and diagnosis

| Symptom                                                           | Cause                                                                          | Correction                                                                | Evidence                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Menu or status is missing or clipped                              | Chrome was added inside the body or body layout bypassed `createApplication()` | Pass chrome through `createApplication` and let shell layout own its rows | Menu/body/status bounds occupy distinct rows         |
| Tile, Cascade, or another window command is disabled or unhandled | The application uses custom content rather than a Desktop                      | Hide Desktop affordances or choose the Desktop body                       | `app.desktop` is `undefined` for custom content      |
| A menu and status action disagree                                 | They emit different command names or owners                                    | Use one stable command intent on every surface                            | One handler count changes for every input path       |
| `run()` appears to hang                                           | No reachable control emits `Commands.quit`, or the result is not awaited       | Add a quit affordance and await the returned promise                      | Quit resolves one exit code                          |
| Terminal is not restored or remains in raw mode                   | Host lifecycle was bypassed or a custom runner omitted `finally` cleanup       | Use `app.run()` and keep acquisition with restoration                     | Normal, thrown, and signalled exits restore the host |
| Screen chrome disappears after navigation                         | Live status views were re-parented instead of copied                           | Use `statusBase()` and `withBase()`                                       | Each status-base call returns fresh views            |

## Best practices

- Choose Desktop versus custom content before designing workflows; changing ownership later affects
  every window command and focus assumption.
- Let `createApplication()` own shell geometry. Manual chrome placement clips during resize.
- Keep one command vocabulary across menu, status, buttons, and keys.
- Put a visible quit path in every terminal application, but convert it to a request in an embedded
  host that must keep the lesson alive.
- Await `run()` and acquire/release external resources in the same lifetime.
- Hide unavailable Desktop commands rather than presenting controls that cannot act.
- Use fresh status views and copied menu data when composing per-screen chrome.
- Test compact cells, keyboard-only access, monochrome cues, resize, and cleanup.

## Practice and next steps

1. Add a menu and status action for the same command. Verify that mouse and keyboard paths increment
   one counter and that removing either visual surface does not remove the command owner.
2. Build the same small workspace once with a Desktop window and once as custom content. Explain why
   only the Desktop version owns window commands.
3. Add a quit status item, emit a non-zero exit code in a headless test, and verify that the run
   promise resolves and cleanup happens once.

Related material:

- [Application](/components/application/application) for the shell factory surface;
- [MenuBar](/components/application/menu-bar) and
  [StatusLine](/components/application/status-line) for chrome details;
- [Desktop](/components/application/desktop) and [Window](/components/application/window) for
  window-manager behavior;
- [Router](/components/application/router) and
  [Screens & routing](/guide/screens-and-routing) for full-screen navigation;
- [`createApplication`](/api/ui/functions/createApplication); and
- [`Commands`](/api/ui/variables/Commands).
