# FileEditor (`@jsvision/files`) + the `FileSystem` additions

> **Document**: 03-06-file-editor.md
> **Parent**: [Index](00-index.md)
> **Files**: `packages/files/src/editor/{file-editor.ts,commands.ts,index.ts}`; additive edits to
> `packages/files/src/fs/{types.ts,node-fs.ts}` + the in-memory test fs

## Overview

The file binding (AR-249/AR-258): `FileEditor extends Editor` over the RD-09 `FileSystem` seam —
load/save/saveAs, `.bak` backups, and the modified-close prompts. `@jsvision/ui` stays fs-free.

## TV decode (GATE 1)

`TFileEditor : TEditor` (`editors.h:424-474`, `tfiledtr.cpp:48-319`):

- **`loadFile`** (`tfiledtr.cpp:104-…`): reads raw bytes straight to the buffer end (gap at
  front); a **missing file ⇒ empty buffer, still valid** (no error); content stored verbatim
  (PF-008).
- **`saveFile` + backup** (`tfiledtr.cpp:180-219`; backup logic `:186-193` — anchors per PF-009):
  when `efBackupFiles` — remove the stale `.bak`, rename the current file to `.bak`
  (`backupExt = ".bak"`, `tvtext1.cpp:126`), then write the buffer's two gap halves fresh.
  Transcribes to the PA-6 seam 1:1:
  `unlink(bak)` (ignore-missing) → `rename(file, bak)` → `writeFile(file, text)`.
- **`save`/`saveAs`** (`tfiledtr.cpp:147-167`): untitled routes `edSaveAs` through the seam;
  a successful saveAs broadcasts `cmUpdateTitle` — ours writes the `Window.title` signal (PF-013).
- **`valid(close/quit)`** (`tfiledtr.cpp:264-291`): modified ⇒ `edSaveModify` (named) or
  `edSaveUntitled` → **Yes** save (then close), **No** drop, **Cancel** abort the close.
- **`updateCommands`** (`tfiledtr.cpp:257-262`): base + `cmSave`/`cmSaveAs` always enabled (active).
- Defaults (AR-258, `editstat.cpp:18-24`): `efBackupFiles` **ON**, `efPromptOnReplace` **ON**,
  both toggleable.

## Implementation Details

### `FileSystem` additions (PA-6 — additive, `fs/types.ts` + `node-fs.ts` + `memory-fs`)

```ts
readFile(path: string): string;              // utf-8 text
writeFile(path: string, text: string): void;
rename(from: string, to: string): void;
unlink(path: string): void;
```

`nodeFileSystem` maps to `node:fs` sync calls; the in-memory test fs mirrors them (all AC-13 runs
disk-free). Errors surface as thrown exceptions the `FileEditor` catches and routes to the seam
(`readError`/`writeError`/`createError`).

### `file-editor.ts` — `class FileEditor extends Editor`

```ts
export interface FileEditorOptions extends EditorOptions {
  fs: FileSystem;
  fileName?: string;                          // undefined ⇒ untitled
  backupFiles?: boolean;                      // default true  (AR-258)
  promptOnReplace?: boolean;                  // default true  (AR-258)
}
export class FileEditor extends Editor {
  readonly fileName: Signal<string | undefined>;
  loadFile(): void;                           // missing ⇒ empty + valid (decode)
  save(): Promise<boolean>;                   // untitled → saveAs; false on cancel/error
  saveAs(): Promise<boolean>;                 // edSaveAs via the seam; updates fileName + window title
  saveFile(): boolean;                        // the backup sequence + write (decode)
  valid(command: 'close' | 'quit'): Promise<boolean>; // the prompt state machine (decode)
}
```

`.bak` path = same directory via the seam's path helpers (`dirname`/`join` — RD §Security);
`unlink` of a missing `.bak` is swallowed (first-save case). `save`/`valid` are async because the
seam is (PA-17); the `EditWindow`/`Dialog` close paths await them.

### `openFileInEditor` — the files-side hosting factory (PF-001)

```ts
export interface OpenFileInEditorOptions extends FileEditorOptions {} // clipboard/editorDialog ride EditorOptions
export function openFileInEditor(
  host: { desktop: Pick<Desktop, 'addWindow'> },     // the createApplication handle satisfies this
  opts: OpenFileInEditorOptions,
): { window: EditWindow; editor: FileEditor };
```

Constructs the `FileEditor` (+ `loadFile()`), news `EditWindow({ editor })` (the PF-001
caller-supplied seam, 03-04), binds `editor.fileName → window.title` with `?? 'Untitled'`
(reactive — saveAs retitles, PF-013), adds the window to `host.desktop`, and returns both. This is
how file editing composes without a ui→files dependency: ui never sees `FileSystem`/`FileEditor`.

### `commands.ts`

```ts
export const FileCommands = { save: 'save', saveAs: 'saveAs', open: 'open', new: 'new' } as const;
```

Registry-level (PA-15); the tvedit clone binds its File menu to them; greying per the
`updateCommands` decode (PA-4). **Ownership (PF-004, an amendment to PA-15):** `FileCommands`
(files) owns `save`/`saveAs` — the TV decode places both in `TFileEditor`
(`tfiledtr.cpp:257-262`), and the fs-free ui `Editor` has no save behavior to bind; ui's
`EditorCommands` = `find`/`replace`/`searchAgain`/`clear` only (PF-005 added `clear`).

## Integration Points

`EditWindow` (03-04) hosts the `FileEditor` as its caller-supplied `editor` — composed by
`openFileInEditor` (PF-001); `demo:tvedit` (03-07) answers `edSaveAs` with the RD-09 `FileDialog`
(`wireEditorDialogs`'s `saveAs` hook); the RD-04 quit path runs `valid('quit')` across open
editors.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Missing file on load | Empty valid buffer (decode) | AC-13 |
| Read/write/create failure | Caught → seam `readError`/`writeError`/`createError` → info box; operation reports false | PA-17 / AC-13 |
| Untitled save | `edSaveAs` via the seam; cancel ⇒ save returns false | AC-13 |
| Stale `.bak` unlink fails (missing) | Ignored; rename+write proceed | PA-6 |
| Close with modified buffer | Yes/No/Cancel state machine (decode) | AC-13 |
| Hostile file content | Stored verbatim; sanitize applies at draw, never at load (round-trip integrity) | AC-15/AC-17 |

## Testing Requirements

- Spec: ST-30…ST-31 (`file-editor.spec` over the in-memory fs; `fs-content.spec` for the 4 new
  seam methods).
- Impl: backup-of-backup cycles, saveAs-to-existing-path, rename failure mid-sequence, EOL
  round-trip through a real save.
