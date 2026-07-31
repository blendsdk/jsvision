---
title: File List
description: FileList — a reactive two-column directory listing with filtering, hidden-file policy, focus, and activation.
---

# File List

`FileList` turns an injectable directory scan into a keyboard- and mouse-navigable two-column list.
Files appear before directories, directories carry a separator, and the parent entry stays last.
Changing its signals rescans automatically.

## Usage

```ts
import { FileList } from '@jsvision/files';
import { signal } from '@jsvision/ui';

const directory = signal('/workspace');
const list = new FileList({ fs: virtualFs, directory, wildcard: signal('*.ts') });
```

## Live example

<PlayExample id="files/file-list"
  title="File List Lab"
  blurb="Rescan a two-column virtual directory as hidden-file, wildcard, and failure inputs change."
/>

## Props and public state

`FileList` exposes `directory`, `wildcard`, `showHidden`, the reactive `entries` signal, and
`focusedEntry()`. Inherited `ListView` signals expose the focused and selected row indexes.
Construction is described by `FileListOptions`; every row is a `DirEntry`, and `scanDirectory`
defines the source ordering.

## Configuration

| `FileListOptions` field | Type                           | Default               | Purpose                                                |
| ----------------------- | ------------------------------ | --------------------- | ------------------------------------------------------ |
| `fs`                    | `FileSystem`                   | required              | Supplies the synchronous directory scan and separator. |
| `directory`             | `Signal<string>`               | required              | Rescans the list whenever it changes.                  |
| `wildcard`              | `Signal<string>`               | internal `'*'`        | Filters files while leaving directories reachable.     |
| `showHidden`            | `Signal<boolean>`              | internal `false`      | Includes dot/hidden entries when true.                 |
| `filter`                | `(entry: DirEntry) => boolean` | none                  | Adds a pure predicate to file filtering.               |
| `focused`               | `Signal<number>`               | internal `0`          | Shares the keyboard focus cursor with other UI.        |
| `selected`              | `Signal<number>`               | internal `-1`         | Shares the selected row.                               |
| `bar`                   | `ScrollBar`                    | internal vertical bar | Connects an externally laid-out scroll bar.            |
| `onOpenEntry`           | `(entry: DirEntry) => void`    | none                  | Receives Enter/double-click activation.                |
| `command`               | `string`                       | none                  | Emits an application command on activation.            |

## Scanning and filtering

Wildcard and custom predicates apply to files, while directories remain navigable. Hidden entries
are omitted by default. Any unreadable scan becomes a safe empty list rather than throwing during
render.

`scanDirectory` returns files first, then directories, with `..` last. The list preserves that
ordering by disabling inherited sorting and renders directories with the filesystem separator.

## Activation and focus

Arrow keys, type-ahead, clicks, and wheel behavior come from `ListView`. Enter or double-click
activates the focused entry and calls `onOpenEntry` or emits the configured command.

## Sizing and layout

Allocate enough width for two useful columns and multiple rows. A caller-supplied vertical bar can
share scrolling state; otherwise the list creates its own.

## Best practices

- Navigate by updating `directory`; do not replace the widget.
- Present an explicit empty/error message beside the list when a failed scan matters.
- Keep filters pure because reactive rescans may call them repeatedly.

## Theming

Rows use `listNormal`, `listFocused`, and `listSelected`, matching other list-based controls.

## Related

- [File Dialog](/components/files/file-dialog) — composes the list with input and metadata.
- [Directory List](/components/files/dir-list) — renders a directory tree instead.
- [API reference](/api/files/classes/FileList) — generated signatures.
