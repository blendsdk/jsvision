---
title: Dialog
description: Present modal or modeless work in a centered Dialog with validation-aware commands and familiar Classic window chrome.
---

# Dialog

`Dialog` is a focused task surface built on [`Window`](/components/application/window). It uses the
Classic dialog role, includes movable and closable frame chrome, and deliberately omits resize and
zoom affordances. Add controls as children, then either execute it modally or register it as a
modeless desktop window.

The important distinction is ownership: `app.loop.execView(dialog)` temporarily owns a modal dialog
and resolves its terminating command, while `app.desktop.addWindow(dialog)` leaves lifetime and
commands to the application.

## Usage

```ts
import { Dialog, Input, at, okButton, signal } from '@jsvision/ui';

const name = signal('');
const dialog = new Dialog({ title: ' Profile ', width: 38, height: 9 });
dialog.add(at(new Input({ value: name }), 1, 1, 30, 1));
dialog.add(at(okButton(), 13, 4, 10, 2));

const command = await app.loop.execView(dialog);
```

## Live example

<PlayExample id="containers/dialog" title="Dialog command laboratory" blurb="Inspect automatic centering, one-cell padding, validation-gated OK behavior, and the cancel bypass in a real Classic shell." />

The laboratory keeps its host dialog open so you can repeat every case. Its command readout calls
the same public `valid(command)` gate that a modal host uses before resolving.

## Props and public state

`Dialog` accepts `DialogOptions`:

| Prop               | Type      | Default  | Purpose                                                  |
| ------------------ | --------- | -------- | -------------------------------------------------------- |
| `title`            | `string`  | empty    | Centered frame caption.                                  |
| `width` / `height` | `number`  | —        | Size-only placement that auto-centers in the parent.     |
| `rect`             | `Rect`    | —        | Explicit position and size; treated as manual placement. |
| `centered`         | `boolean` | inferred | Explicitly opt into or out of parent centering.          |

Inherited `closable` and `movable` remain available. Dialog construction sets `resizable` and
`zoomable` to `false`, enables a shadow, and roots an accelerator scope for its child controls.
Standard `Commands` values provide the modal termination vocabulary.

## Size and Layout

A width and height without a positioned `rect` are the safest default: the parent computes the
center on every reflow, and the dialog retains visible desktop margin as the viewport changes.
Dialog layout includes one cell of internal padding; position children relative to that content
area with `at`, `row`, `col`, or the other public layout helpers.

An explicit `rect` is honored verbatim. Use it only when position itself carries meaning, because
manual coordinates can clip on smaller terminals. Content still clips at the dialog bounds, and
the frame consumes the outermost row and column on each side.

## Modality and validation

`execView` installs a modal host, mounts the dialog over the application, moves focus into it, and
returns a promise for the terminating command. `ok`, `yes`, and `no` call `valid(command)` first.
The default implementation walks descendants depth-first and calls each child control's zero-arg
`valid()` method; the first invalid child receives focus and the dialog stays open.

This makes validation compositional. An [`Input`](/components/controls/input) owns its validator,
while the dialog owns only the decision to terminate.

```ts
import { Dialog, Input, range, signal } from '@jsvision/ui';

const age = new Input({ value: signal('17'), validator: range(18, 120) });
const dialog = new Dialog({ width: 34, height: 8 });
dialog.add(age);

dialog.valid('ok'); // false: age blocks termination
dialog.valid('cancel'); // true: cancellation never traps the user
```

## Closing and commands

Standard buttons emit `Commands.ok`, `Commands.cancel`, `Commands.yes`, or `Commands.no`. A modal
dialog intercepts those commands, applies enablement and validation, then asks its modal host to
resolve. Escape and the frame close box travel through the cancel path, so they also end modality
without leaving a dangling promise.

A modeless dialog has no modal host. It behaves as an ordinary desktop window: the application
decides what button commands mean, while frame movement, activation, and closing follow `Window`
rules.

## Best Practices

- Prefer size-only construction so the dialog remains centered across terminal sizes.
- Keep validation in the controls that own the data; let the dialog aggregate their result.
- Always offer cancel or an equivalent escape path, even when the task is destructive.
- Use unique `~accelerator~` letters inside one dialog scope; duplicate accelerators are reported in
  development.
- Choose modeless behavior only when users genuinely need to interact with work behind the dialog.

## Theming

The frame and interior use the `dialog` role, including the Classic menu-bar-compatible gray
surface. An inactive modeless dialog may expose inherited `windowInactive` chrome. Child controls
retain their own roles, so verify input text, focus, error text, and buttons against the dialog
surface rather than overriding the background manually.

## Related

- [Window](/components/application/window) — movable, resizable desktop surface underlying Dialog.
- [Input](/components/controls/input) — validation-aware field used by the close gate.
- [Form Dialog](/components/controls/form-dialog) — schema-driven form composition.
- [Dialog API](/api/ui/classes/Dialog) — generated `Dialog`, `DialogOptions`, and command details.
