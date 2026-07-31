---
title: File Dialog
description: FileDialog — a virtual-filesystem-aware open/save dialog with filtering, recent paths, metadata, and resolution.
---

# File Dialog

`FileDialog` is the complete open/save picker: filename history, wildcard filtering, a two-column
listing, metadata, scroll bars, and mode-specific actions. Every read goes through an injectable
`FileSystem`, so the same component works with Node storage or a confined in-memory tree.

## Usage

```ts
import { FileDialog } from '@jsvision/files';
import { signal } from '@jsvision/ui';

const dialog = new FileDialog({
  fs: virtualFs,
  directory: signal('/workspace'),
  wildcard: signal('*.ts'),
  showError: (message) => showStatus(message),
});
```

## Live example

<PlayExample id="files/file-dialog"
  title="File Dialog Lab"
  blurb="Inspect the composed picker, navigate a virtual project, and launch the real modal FileDialog."
/>

## Props and public state

`FileDialog` exposes its `directory`, `wildcard`, and `filename` signals plus the composed
`FileList`, `FileInput`, `FileInfoPane`, history control, list scroll bar, action buttons, and
`result()`. `FileDialogOptions` accepts an injectable `FileSystem`. Prefer `openFile` when you only
need a resolved path and do not need those internals.

## Configuration

| `FileDialogOptions` field | Type                             | Default                            | Purpose                                                    |
| ------------------------- | -------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `fs`                      | `FileSystem`                     | `nodeFileSystem`                   | Supplies every path, listing, and stat operation.          |
| `directory`               | `Signal<string>`                 | resolved current working directory | Drives browsing and metadata.                              |
| `wildcard`                | `Signal<string>`                 | `*.*`                              | Filters file rows; directories remain navigable.           |
| `filename`                | `Signal<string>`                 | empty signal                       | Receives list focus and typed paths or wildcards.          |
| `save`                    | `boolean`                        | `false`                            | Selects open actions or the save/replace/clear action set. |
| `filter`                  | `(entry: DirEntry) => boolean`   | none                               | Adds a file predicate after wildcard matching.             |
| `title`                   | `string`                         | localized open/save title          | Labels the modal frame.                                    |
| `inputName`               | `string`                         | localized Name label               | Changes the filename label and accelerator.                |
| `i18n`                    | `I18n`                           | isolated English catalog           | Localizes package-owned text.                              |
| `historyId`               | `number`                         | file-dialog history ID             | Isolates the recent-path list.                             |
| `showError`               | `(message: string) => void`      | none                               | Presents invalid-parent or empty-name feedback.            |
| `onResolve`               | `(path: string \| null) => void` | none                               | Observes a successful path before modal completion.        |

## Browsing and resolving

Activating a directory descends without closing. A wildcard typed into the filename field updates
the list. For an ordinary non-empty filename, the dialog validates that its parent path is a
readable directory, records the absolute result, and closes. It does **not** require the target file
to exist; that is necessary for Save As and means open workflows must validate/read the returned
path themselves. An empty name or an invalid/unreadable parent calls `showError` and remains open.

```ts
import { openFile } from '@jsvision/files';

const path = await openFile(app, {
  fs: virtualFs,
  directory: '/workspace',
  wildcard: '*.ts',
});
if (path !== null) {
  const source = virtualFs.readFile(path); // open-mode existence/readability check
  openSource(source);
}
```

## Open and save modes

Open mode presents Open, Cancel, and Help. Save mode adds Replace and Clear behavior and changes the
default title and action set. Recent-path history remains separate from Change Directory history.
`Replace` copies the focused entry into `filename`; `Clear` empties it. Neither action closes the
dialog.

## Sizing and layout

The dialog is drag-resizable but never below its translated design minimum. Its flex composition
grows the listing and keeps the filename, metadata, bar, and action column reachable.

## Best practices

- Inject a narrow `FileSystem`; never let a browser example reach host disk.
- Treat `showError` as required product feedback even though it is technically optional.
- Use `openFile` for ordinary modal ownership and direct construction for customization.

## Theming

The frame uses `dialog`; metadata uses `fileInfo`; embedded lists, inputs, history, scroll bars, and
buttons use their standard theme roles.

## Related

- [Change Directory Dialog](/components/files/chdir-dialog) — directory-only selection.
- [File List](/components/files/file-list) — the reactive listing inside the dialog.
- [API reference](/api/files/classes/FileDialog) — generated signatures.
