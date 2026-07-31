---
title: File Info Pane
description: FileInfoPane — a passive two-row search-path and focused-entry metadata projection.
---

# File Info Pane

`FileInfoPane` is the passive readout under a file listing. Row one expands directory plus wildcard;
row two shows the focused name and, when space and metadata allow, size, date, and localized
12-hour time.

## Usage

```ts
import { FileInfoPane } from '@jsvision/files';

const info = new FileInfoPane({
  fs: virtualFs,
  directory: () => directory(),
  wildcard: () => wildcard(),
  focusedEntry: () => list.focusedEntry(),
});
```

## Live example

<PlayExample id="files/file-info-pane"
  title="File Info Pane Lab"
  blurb="Project the current search path plus deterministic entry metadata, including a broken symlink."
/>

## Props and public state

`FileInfoPane` owns no selection or commands. It subscribes to its three accessors on mount and
repaints when any of them changes.
Construction is described by `FileInfoPaneOptions`, which combines a `FileSystem` with a focused
`DirEntry` accessor.

## Configuration

| `FileInfoPaneOptions` field | Type                          | Default                  | Purpose                                         |
| --------------------------- | ----------------------------- | ------------------------ | ----------------------------------------------- |
| `fs`                        | `FileSystem`                  | required                 | Resolves the displayed directory/wildcard path. |
| `directory`                 | `() => string`                | required                 | Supplies the current directory.                 |
| `wildcard`                  | `() => string`                | required                 | Supplies the current file pattern.              |
| `focusedEntry`              | `() => DirEntry \| undefined` | required                 | Supplies name and metadata for row two.         |
| `i18n`                      | `I18n`                        | isolated English catalog | Localizes month names and AM/PM labels.         |

The accessors may read signals directly. No writable signal or result method is exposed because the
pane is deliberately a passive projection.

## Search path

The first row uses the filesystem's resolver to display the exact effective search path. This keeps
separator and normalization policy aligned with the same filesystem that produced the listing.

## Entry metadata

The second row keeps the name on the left and right-aligns size, translated month, date, and time.
Broken symlinks deliberately show only their name. Narrow panes also omit metadata rather than
painting overlapping fields.

Metadata comes from the `DirEntry` already produced by the scan; the pane performs no extra stat.
That keeps focused-row changes cheap and ensures broken-link behavior matches the listing.

## Sizing and layout

Allocate exactly two rows for the normal presentation. Widths of 39 cells or more can display the
metadata run; wider layouts better accommodate translated month and period labels.

## Best practices

- Feed the same accessors used by FileList and FileInput.
- Keep timestamps deterministic in examples and visual tests.
- Treat a name-only broken link as intentional degraded metadata.

## Theming

Both rows use `fileInfo`; the pane is passive and never paints a focus role.

## Related

- [File List](/components/files/file-list) — supplies the focused entry.
- [File Dialog](/components/files/file-dialog) — standard composition.
- [API reference](/api/files/classes/FileInfoPane) — generated signatures.
