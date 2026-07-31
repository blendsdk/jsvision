---
title: File Input
description: FileInput — a filename field that mirrors list focus until the user takes ownership by editing.
---

# File Input

`FileInput` extends `Input` with picker-aware mirroring. A focused file copies its name; a focused
directory previews `directory + separator + wildcard`. Once the field itself has focus, list
movement cannot overwrite what the user is typing.

## Usage

```ts
import { FileInput } from '@jsvision/files';
import { signal } from '@jsvision/ui';

const value = signal('');
const input = new FileInput({
  value,
  focusedEntry: () => list.focusedEntry(),
  wildcard: () => '*.ts',
  sep: '/',
});
```

## Live example

<PlayExample id="files/file-input"
  title="File Input Lab"
  blurb="Mirror focused file and directory entries until the user focuses the field and begins editing."
/>

## Props and public state

`FileInput` inherits editing, selection, validation, and focus behavior from `Input`. The supplied
`value` signal remains the public two-way value channel.
Construction is described by `FileInputOptions`, which combines a `Signal<string>` with a focused
`DirEntry` accessor.

## Configuration

| `FileInputOptions` field | Type                          | Default                 | Purpose                                           |
| ------------------------ | ----------------------------- | ----------------------- | ------------------------------------------------- |
| `value`                  | `Signal<string>`              | required                | Receives mirrored names and user edits.           |
| `focusedEntry`           | `() => DirEntry \| undefined` | required                | Supplies the list row to mirror.                  |
| `wildcard`               | `() => string`                | required                | Completes a directory preview such as `src/*.ts`. |
| `sep`                    | `string`                      | required                | Uses the active filesystem's path separator.      |
| `maxLength`              | `number`                      | inherited Input default | Limits the stored filename.                       |
| `validator`              | `Validator`                   | none                    | Applies Input's keystroke validation.             |

## Entry mirroring

A file mirrors as its basename. A directory mirrors as `name + sep + wildcard`, making the next
descent visible before activation. Wildcard reads are untracked, so changing only the wildcard does
not unexpectedly rewrite the field.

An undefined focused entry leaves the current value unchanged. A later entry change mirrors again
only when the field does not own focus.

## Focused editing

Mirroring stops while the input is focused. This ownership boundary prevents keyboard navigation in
a neighboring list from clobbering a partially typed path or wildcard.

## Sizing and layout

Allocate one row and enough width for expected relative paths. Place it near the list whose focus it
mirrors, and label it with a focus-targeting `Label`.

## Best practices

- Share one value signal with the surrounding dialog.
- Use the real filesystem separator rather than hard-coding POSIX.
- Preserve focus while the user edits; do not force list mirroring manually.

## Theming

The field uses `inputNormal`, `inputFocused`, and `inputSelected`, including the standard cursor and
selection treatment.

## Related

- [File Dialog](/components/files/file-dialog) — wires this field to a FileList.
- [Input](/components/controls/input) — inherited editing behavior.
- [API reference](/api/files/classes/FileInput) — generated signatures.
