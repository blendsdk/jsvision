---
title: Directory List
description: DirList — a reactive ancestor-and-children directory tree with focus, activation, and safe unreadable state.
---

# Directory List

`DirList` derives a compact tree from the filesystem root to the current directory, then appends the
current directory's immediate children. Box connectors communicate hierarchy without requiring a
full recursive tree to stay mounted.

## Usage

```ts
import { DirList } from '@jsvision/files';
import { signal } from '@jsvision/ui';

const directory = signal('/workspace');
const tree = new DirList({ fs: virtualFs, directory, onChangeDir: directory.set });
```

## Live example

<PlayExample id="files/dir-list"
  title="Directory List Lab"
  blurb="Derive an ancestor-and-children tree, reroot it reactively, and inspect unreadable state."
/>

## Props and public state

`DirList` exposes its driving `directory`, reactive `nodes`, and `focusedNode()`. Inherited
`ListView` signals expose focused and selected row indexes.
Construction is described by `DirListOptions`; each `DirNode` comes from `buildDirTree`.

## Configuration

| `DirListOptions` field | Type                     | Default       | Purpose                                     |
| ---------------------- | ------------------------ | ------------- | ------------------------------------------- |
| `fs`                   | `FileSystem`             | required      | Resolves roots and scans child directories. |
| `directory`            | `Signal<string>`         | required      | Rebuilds the tree whenever it changes.      |
| `focused`              | `Signal<number>`         | internal `0`  | Shares the focus cursor.                    |
| `selected`             | `Signal<number>`         | internal `-1` | Shares the selected row.                    |
| `onChangeDir`          | `(path: string) => void` | none          | Receives an activated node's absolute path. |
| `command`              | `string`                 | none          | Emits an application command on activation. |

Each `DirNode` from `buildDirTree` carries an absolute `path`, visible `label`, and box-drawing
`connector`. The component does not mutate `directory` by itself; wire `onChangeDir` back to the
signal when activation should reroot the tree.

## Tree derivation

The model contains the ancestor chain and immediate child directories, already ordered for display.
If the whole derivation throws, `DirList` publishes an empty `nodes` array. When
`buildDirTree` can still derive the lexical ancestors but cannot read the current directory, it
keeps that ancestor chain and omits children.

## Rerooting and activation

Changing `directory` rebuilds the tree. Enter or double-click passes the node's absolute path to
`onChangeDir`; applications usually write that path back to the same directory signal.

## Sizing and layout

Use a single column wide enough for connectors plus the longest visible label. Give the list
several rows so ancestors and child choices remain simultaneously understandable.

## Best practices

- Keep the callback and directory signal connected for predictable rerooting.
- Pair empty state with a readable error message outside the list.
- Inject a virtual filesystem in browser examples and tests.

## Theming

Rows use `listNormal`, `listFocused`, and `listSelected`.

## Related

- [Change Directory Dialog](/components/files/chdir-dialog) — full modal directory selection.
- [File List](/components/files/file-list) — files and directories in two columns.
- [API reference](/api/files/classes/DirList) — generated signatures.
