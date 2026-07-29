---
title: Form Dialog
description: formDialog — a schema-backed modal form with synchronous and asynchronous validation, coercion, and guarded submission.
---

# Form Dialog

`formDialog` runs a `createForm` store inside a modal JSVision dialog. It owns validation,
submission, cancellation, cleanup, and the difficult async period where every closing path must be
sealed. Your `body` callback only composes controls bound to fields.

## Usage

```ts
import { formDialog } from '@jsvision/forms';
import { Group, Input, at } from '@jsvision/ui';
const result = await formDialog(app, {
  schema: profileSchema,
  initial: { name: '' },
  width: 40,
  height: 9,
  body: (form) => at(new Input({ value: form.field('name').value }), 2, 1, 30, 1),
});
```

## Live example

<PlayExample id="controls/form-dialog"
  title="Form Dialog Lab"
  blurb="Validate and coerce a profile, then launch the same fields through the real modal formDialog helper."
/>

## Props and public state

`formDialog(host, options)` creates a `Form` through `createForm`, gives it to `body`, and resolves
to the schema's coerced output or `null`. The raw `initial` type may intentionally differ from the
resolved type—for example, a text field can start as `'42'` and resolve through `z.coerce.number()`
as `42`. `FormDialogOptions` is the complete construction contract.

## Configuration

| `FormDialogOptions` field | Type                    | Default          | Purpose                                                      |
| ------------------------- | ----------------------- | ---------------- | ------------------------------------------------------------ |
| `schema`                  | `z.ZodObject`           | required         | Defines synchronous validation and the resolved output type. |
| `initial`                 | raw field record        | required         | Supplies editable values before schema parsing or coercion.  |
| `body`                    | `(form: Form) => View`  | required         | Builds controls bound to `form.field(name).value`.           |
| `width`, `height`         | `number`                | required         | Set the requested cell size; the desktop may clamp it.       |
| `asyncValidators`         | per-field validator map | none             | Adds asynchronous field checks that OK force-runs.           |
| `asyncDebounceMs`         | `number`                | `300`            | Delays validation caused by ordinary field changes.          |
| `onSubmit`                | coerced-value callback  | none             | Performs persistence inside the sealed submit gate.          |
| `title`                   | `string`                | untitled frame   | Labels the modal frame.                                      |
| `okText`                  | `string`                | localized `~O~K` | Replaces the default OK button text and accelerator.         |

The returned promise is the public result channel. Inside `body`, the `Form` exposes each field's
raw value, touched/error state, asynchronous error state, and the aggregate `submitting()` state.

## Validation and submission

OK touches every field, force-runs async validation, then calls `onSubmit` with coerced values.
Invalid fields keep the modal open. A rejected submit also keeps it open so the body can present a
durable failure message.

```ts
import { formDialog } from '@jsvision/forms';
import { Input } from '@jsvision/ui';

const result = await formDialog(app, {
  schema: profileSchema, // age uses z.coerce.number()
  initial: { age: '' }, // raw editing value
  asyncValidators: { age: async (value) => (value === '13' ? 'Choose another value' : null) },
  onSubmit: async (values) => saveProfile(values), // values.age is a number
  width: 42,
  height: 9,
  body: (form) => new Input({ value: form.field('age').value }),
});
```

## Modal lifecycle

While asynchronous submission is active, OK, Cancel, Escape, close, and application quit are sealed
against races. The dialog always removes its window and disposes the form, including body-builder
and submit failure paths.

`onSubmit` rejection is intentionally not converted into a generic alert. Keep an application-owned
error signal in the body, report the rejection there, and let the user retry or cancel after the
seal lifts.

## Sizing and layout

Width and height are required because the helper cannot infer an opaque body. The helper clamps to
the desktop and wraps the standard action group when necessary. Position body controls inside the
covered content area.

## Best practices

- Bind controls directly to `form.field(name).value`; keep a single source of truth.
- Put persistence in `onSubmit` so the dialog cannot close before the save settles.
- Surface rejected submit errors inside the body; the helper deliberately invents no error UI.

## Theming

The frame uses `dialog`; hosted controls retain their normal Input, Label, Button, and selection
roles from the active theme.

## Related

- [Dialog](/components/containers/dialog) — the modal container and close gate.
- [Input](/components/controls/input) — a common field binding.
- [API reference](/api/forms/functions/formDialog) — generated helper signature.
