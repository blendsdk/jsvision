---
title: File Editor
description: FileEditor — an Editor with injectable load, save, save-as, backup, error, and modified-close behavior.
---

# File Editor

`FileEditor` adds filesystem policy to the general multiline `Editor`. It loads exact text, saves to
a bound path, optionally rotates the previous file to `.bak`, prompts for Save As, and protects
modified buffers during close.

## Usage

```ts
import { FileEditor } from '@jsvision/files';

const editor = new FileEditor({
  fs: virtualFs,
  fileName: '/workspace/notes.txt',
  backupFiles: true,
});
editor.loadFile();
```

## Live example

<PlayExample id="files/file-editor"
  title="File Editor Lab"
  blurb="Load and edit a virtual file, save it with a backup, and inspect a deterministic write failure."
/>

## Props and public state

`FileEditor` exposes reactive `fileName`, plus `loadFile()`, async `save()`, async `saveAs()`,
synchronous `saveFile()`, and async close validation. It inherits the complete `Editor` buffer,
selection, undo, command, and `modified` surface. `FileEditorOptions` requires a `FileSystem`.
`openFileInEditor` creates the standard hosted window and keeps its title synchronized with
`fileName`.

## Configuration

| `FileEditorOptions` field | Type                     | Default           | Purpose                                                   |
| ------------------------- | ------------------------ | ----------------- | --------------------------------------------------------- |
| `fs`                      | `FileSystem`             | required          | Supplies every load, rename, write, and unlink operation. |
| `fileName`                | `string`                 | untitled          | Binds the initial path; `saveAs()` may replace it.        |
| `backupFiles`             | `boolean`                | `true`            | Rotates the previous file to a sibling `.bak`.            |
| `promptOnReplace`         | `boolean`                | `true`            | Controls overwrite confirmation in editor dialog flows.   |
| `editorDialog`            | `EditorDialogHandler`    | canceling handler | Supplies Save As, error, and close prompts.               |
| `undoDepth`               | `number`                 | `1000`            | Sets inherited undo retention.                            |
| `autoIndent`              | `boolean`                | `false`           | Copies leading whitespace on newline.                     |
| `overwrite`               | `boolean`                | `false`           | Starts the inherited editor in overwrite mode.            |
| `keyBindings`             | `'modern' \| 'wordstar'` | `'modern'`        | Selects the inherited editing key set.                    |

## Loading and saving

Loading reads UTF-8 text verbatim. A missing path becomes a valid empty buffer for a new file.
Successful saves preserve exact text, clear modified state, and retitle hosts through the filename
signal after Save As.

```ts
import { FileEditor } from '@jsvision/files';

editor.setText(nextText);
if (!(await editor.save())) {
  // Cancel and filesystem errors both leave the buffer available to retry.
  showStatus('Not saved');
}
```

## Backups and close prompts

Backups are enabled by default: a stale backup is removed, the current file is renamed to `.bak`,
then new text is written. A write failure reports through the editor dialog seam and keeps the
buffer modified. Close asks whether to save, discard, or cancel.

The backup rotation is best-effort for a brand-new file: missing stale backups and missing source
files are tolerated. The final write is authoritative; if it fails, `saveFile()` returns `false`.

## Sizing and layout

It has the same multiline sizing rules as Editor. Use an EditWindow or another frame when scroll
bars, an indicator, and a filename title should surround it.

## Best practices

- Inject a virtual or application-owned filesystem; keep path policy outside the editor.
- Await `save`, `saveAs`, and `valid` before closing windows.
- Disable backups only when the storage layer already provides equivalent recovery.

## Theming

Text and selections use `editorNormal` and `editorSelected`; hosting window chrome keeps its own
roles.

## Related

- [Editor](/components/editor/editor) — inherited editing engine.
- [File Dialog](/components/files/file-dialog) — obtains paths for open/save workflows.
- [API reference](/api/files/classes/FileEditor) — generated signatures.
