---
title: Dialog
description: Dialog — a movable, closable gray dialog window shown modally via execView, with a valid() close-gate over its hosted controls.
---

# Dialog

`Dialog` is a modal or modeless window painted in the gray `dialog` frame role — a title and a close
box, but no zoom box and not resizable. Host form controls in it ([`Input`](/components/controls/input),
[`Check group`](/components/controls/check-group), [buttons](/components/controls/button), …); their
bound signals hold the form data.

Show it **modally** with the event loop's `execView(dialog)`, which returns a promise that resolves to
the terminating command (`'ok'` / `'cancel'` / `'yes'` / `'no'`) once it closes. Add it to a desktop
instead (`desktop.add(dialog)`) to show it **modeless**, as an ordinary window.

## Usage

```ts
import { Dialog, Input, Label, okButton, cancelButton, signal, range } from '@jsvision/ui';

const age = signal('30');
// A width/height with no explicit rect auto-centers the dialog and casts a drop-shadow.
const dialog = new Dialog({ title: ' Person ', width: 34, height: 9 });
const input = new Input({ value: age, validator: range(0, 120) });
dialog.add(new Label('~A~ge (0–120)', input));
dialog.add(input);
dialog.add(okButton());
dialog.add(cancelButton());

// Resolves to 'ok' only once Age validates; an out-of-range Age keeps the dialog open.
const command = await loop.execView<string>(dialog);
```

## Live example

<PlayComingSoon title="Dialog" />

## Props

`new Dialog(options)`.

| Prop       | Type      | Default           | Description                                                                         |
| ---------- | --------- | ----------------- | ----------------------------------------------------------------------------------- |
| `title`    | `string`  | —                 | Centered in the top border.                                                         |
| `width`    | `number`  | —                 | Dialog width; giving `width`+`height` (no `rect`) auto-centers.                     |
| `height`   | `number`  | —                 | Dialog height; giving `width`+`height` (no `rect`) auto-centers.                    |
| `rect`     | `Rect`    | —                 | Explicit absolute placement — honored verbatim, **not** centered.                   |
| `centered` | `boolean` | `true` for a size | Center in the parent; defaults `true` with `width`/`height`, `false` with a `rect`. |

## Keyboard & mouse

| Input                         | Result                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| **Esc** (modal)               | Resolve as `cancel` (bypasses the `valid()` gate).                    |
| **Click** the frame close box | Resolve as `cancel` (modal), or close the window (modeless).          |
| **Drag** the title bar        | Move the window.                                                      |
| An **OK / Yes / No** button   | Run the `valid()` gate; close only if every hosted control validates. |
| A **Cancel** button           | Always closes (bypasses the gate).                                    |

The close-gate is the key behaviour: `cancel` always closes, while `ok` / `yes` / `no` close only if
every hosted control's own `valid()` passes — otherwise the dialog stays open and focus jumps to the
first invalid control.

## Sizing & layout

Prefer `width` + `height` — the dialog auto-centers in its parent and casts a drop-shadow. An explicit
`rect` is a manual placement, honored as given (set `centered: true` to override). The frame reserves a
1-cell border via `padding: 1`, so lay hosted controls out relative to the interior.

## Best practices

- **Size, don't place.** Pass `width`/`height` and let the dialog center itself; reach for an explicit
  `rect` only when you truly need a fixed screen position.
- **Bind the form to signals.** Each hosted control's bound signal _is_ the form's data model; read
  them after `execView` resolves to `'ok'`.
- **Use the standard button helpers.** `okButton()`, `cancelButton()`, `yesButton()`, `noButton()`
  (and the `okCancelButtons()` / `yesNoButtons()` pairs) emit the exact terminating commands the gate
  understands.
- **Trust the gate.** You do not need to pre-check fields before closing — an invalid `ok` is vetoed
  and refocuses the offending control for you.

## Theming

The gray `dialog` role colours the chrome: `border` and `title` for the frame lines and title text,
`icon` for the close-box `[×]` accent. Hosted controls use their own roles.

## Related

- [Form dialog](/components/controls/form-dialog) — a worked dialog assembling several controls.
- [File dialog](/components/files/file-dialog) — a `Dialog` subclass for picking files.
- [Button](/components/controls/button) — the OK / Cancel controls that terminate a dialog.
