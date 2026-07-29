---
title: Change Directory Dialog
description: ChDirDialog — a modal directory picker with path history, reactive tree navigation, revert, and validation.
---

# Change Directory Dialog

`ChDirDialog` selects a readable directory through a path field, history dropdown, and reactive
tree. Navigation mirrors into the field; Revert restores the opening directory; OK validates before
resolving. All discovery uses an injectable filesystem.

## Usage

```ts
import { ChDirDialog } from '@jsvision/files';
import { signal } from '@jsvision/ui';

const directory = signal('/workspace');
const dialog = new ChDirDialog({ fs: virtualFs, directory });
```

## Live example

<PlayExample id="files/chdir-dialog"
  title="Change Directory Dialog Lab"
  blurb="Reroot a virtual directory tree, revert it, inspect denied-path feedback, and open the real dialog."
/>

## Props and public state

`ChDirDialog` exposes `directory`, mirrored `path`, `pathInput`, history, `DirList`, buttons, and
`result()`. `ChDirDialogOptions` accepts an injectable `FileSystem`. The `changeDir` helper owns the
common modal lifecycle and uses an internal directory signal, which is usually the safer choice
when cancellation should leave caller state untouched.

## Configuration

| `ChDirDialogOptions` field | Type                             | Default                            | Purpose                                                      |
| -------------------------- | -------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `fs`                       | `FileSystem`                     | `nodeFileSystem`                   | Supplies tree scans, path resolution, and final stat checks. |
| `directory`                | `Signal<string>`                 | resolved current working directory | Drives the tree and is mutated during navigation.            |
| `title`                    | `string`                         | localized `Change Directory`       | Labels the frame.                                            |
| `i18n`                     | `I18n`                           | isolated English catalog           | Localizes labels and validation feedback.                    |
| `historyId`                | `number`                         | change-directory history ID        | Keeps recent paths separate from FileDialog.                 |
| `showError`                | `(message: string) => void`      | none                               | Presents missing, file, or unreadable-directory errors.      |
| `onResolve`                | `(path: string \| null) => void` | none                               | Observes a directory accepted by OK.                         |

`directory` is live browsing state; `path` is the editable value validated by OK; `result()` is
`null` until OK accepts a directory. `chdir()` uses the focused tree node and `revert()` restores the
directory captured at construction.

## Directory navigation

Activating a tree node reroots the directory and mirrors its absolute path. Chdir descends to the
focused node; Revert returns to the constructor-time directory without closing.

## Validation and results

OK accepts only a readable directory. Denied, missing, or file paths call `showError` and keep the
dialog open. Cancel and Escape leave `result()` as `null`. They do **not** roll back changes already
published through a caller-supplied `directory` signal.

```ts
import { ChDirDialog } from '@jsvision/files';
import { signal } from '@jsvision/ui';

const browsing = signal('/workspace');
const dialog = new ChDirDialog({ fs: virtualFs, directory: browsing });
// If the user navigates to /workspace/src and cancels:
dialog.result(); // null
browsing(); // '/workspace/src' — navigation was live
```

## Sizing and layout

The translated minimum is at least 48×18. The dialog may grow; its flex tree gives remaining space
to `DirList` while preserving the path row and action column.

## Best practices

- Pass a shared directory signal when surrounding UI must reflect navigation.
- Keep file and directory history IDs distinct.
- Use the opener unless direct access to tree or buttons is required.

## Theming

The modal frame uses `dialog`; tree rows use `listNormal`, `listFocused`, and `listSelected`.

## Related

- [File Dialog](/components/files/file-dialog) — selects files with wildcard filtering.
- [Directory List](/components/files/dir-list) — the reactive tree inside this dialog.
- [API reference](/api/files/classes/ChDirDialog) — generated signatures.
