<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/files — file dialogs & editor

File/dir dialogs, the file-system seam, and the openers.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## ChDirDialog

The modal change-directory dialog.

```ts
new ChDirDialog(opts: ChDirDialogOptions)   // extends Dialog
// methods & signals:
fs: FileSystem
directory: Signal<string>
path: Signal<string>
pathInput: Input
history: History
dirList: DirList
buttons: Button[]
buttonLabels: string[]
result(): string | null
chdir(): void
revert(): void
valid(command: string): boolean
```

## ChDirDialogOptions

Construction options for ChDirDialog.

```ts
interface ChDirDialogOptions {
  fs?: FileSystem;   // The filesystem to read through (default nodeFileSystem).
  directory?: Signal<string>;   // The current directory (default the filesystem's cwd). Shared with the tree.
  title?: string;   // The dialog title (default `'Change Directory'`).
  historyId?: number;   // The id keying this dialog's recent-path history (default a chdir id distinct from the file dialog).
  showError?: (message: string) => void;   // Called to show an error (unreadable directory). Wire it to errorBox in an app.
  onResolve?: (path: string | null) => void;   // Called when the dialog resolves — with the chosen absolute directory, or `null` on cancel.
}
```

## ChangeDirOptions

Options for changeDir.

```ts
interface ChangeDirOptions {
  fs?: FileSystem;   // The filesystem to read through (default nodeFileSystem).
  directory?: string;   // The starting directory (default the filesystem's cwd).
  title?: string;   // The dialog title.
}
```

## DirEntry

A single directory entry: its basename plus the metadata the listing and info pane display.

```ts
interface DirEntry {
  name: string;   // The basename (e.g. `'readme.txt'` or `'src'`), stored raw; the draw boundary sanitizes it.
  kind: 'file' | 'dir' | 'symlink';   // The entry's own type. A symlink keeps `kind:'symlink'` as its display tag, but its `size`/`mtime` reflect the resolved target, and the directory scan treats it as file- or directory-like by following the link.
  size: number;   // File size in bytes (the target's size for a resolved symlink; `0` for a directory or broken link).
  mtime: Date;   // Last-modified time (the target's time for a resolved symlink).
  hidden: boolean;   // Whether the entry is hidden — a dotfile on POSIX, the hidden attribute on Windows.
  broken?: boolean;   // Set when a symlink's target cannot be resolved; `kind` still reads `'symlink'`.
}
```

## DirList

The directory-tree list, driven reactively by the current directory.

```ts
new DirList(opts: DirListOptions)   // extends ListView<DirNode>
// methods & signals:
directory: Signal<string>
nodes: Signal<DirNode[]>
focusedNode: () => DirNode | undefined
```

## DirListOptions

Construction options for DirList.

```ts
interface DirListOptions {
  fs: FileSystem;   // The filesystem to read through.
  directory: Signal<string>;   // The current directory; the tree re-roots whenever it changes.
  focused?: Signal<number>;   // The focused display index (default an internal signal at 0).
  selected?: Signal<number>;   // The selected display index (default an internal signal at -1).
  onChangeDir?: (path: string) => void;   // Fired on Enter/double-click with the activated node's absolute path.
  command?: string;   // A command name emitted on activation, handled elsewhere (like Button ).
}
```

## DirNode

One row of the directory tree: what to draw, where it points, and how deep it sits.

```ts
interface DirNode {
  label: string;   // The directory basename (the root node shows the root path itself, e.g. `/` or `C:\`).
  path: string;   // The absolute path this node navigates to when activated.
  depth: number;   // Depth from the root (the root is `0`).
  connector: string;   // The connector prefix (indent spaces + box glyphs); the drawn row is `connector + label`.
  isCurrent: boolean;   // `true` for the current directory (the deepest node in the ancestor chain).
}
```

## ExecHost

The minimal host a modal needs: an event loop that can run a view modally and a desktop to mount it into.

```ts
interface ExecHost {
  loop: Pick<EventLoop, 'execView'>;   // Runs a view modally, resolving to the command that closed it.
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow'>;   // The desktop the modal is mounted into (added before, removed after).
}
```

## FileCommands

The command names for the file operations, for wiring a menu or status bar to a file editor.

```ts
const FileCommands: { readonly save: "save"; readonly saveAs: "saveAs"; readonly open: "open"; readonly new: "new"; }
```

## FileDialog

The modal open/save file dialog.

```ts
new FileDialog(opts: FileDialogOptions)   // extends Dialog
// methods & signals:
fs: FileSystem
directory: Signal<string>
wildcard: Signal<string>
filename: Signal<string>
fileList: FileList
fileInput: FileInput
history: History
fileInfoPane: FileInfoPane
listBar: ScrollBar
buttons: Button[]
buttonLabels: string[]
result(): string | null
replace(): void
clear(): void
valid(command: string): boolean
```

## FileDialogOptions

Construction options for FileDialog.

```ts
interface FileDialogOptions {
  fs?: FileSystem;   // The filesystem to read and write through (default nodeFileSystem).
  directory?: Signal<string>;   // The current directory (default the filesystem's cwd). Shared with the listing and info pane.
  wildcard?: Signal<string>;   // The file wildcard (default `'*.*'`).
  filename?: Signal<string>;   // The filename field value (default an internal empty signal).
  save?: boolean;   // Save mode — shows the OK/Replace/Clear/Cancel/Help strip instead of Open/Cancel/Help.
  inputName?: string;   // The filename label text (default `'~N~ame'`; wrap the hotkey letter in tildes).
  title?: string;   // The dialog title (default `'Open a File'`, or `'Save File As'` in save mode).
  filter?: (entry: DirEntry) => boolean;   // An extra predicate AND-ed with the wildcard when listing files.
  historyId?: number;   // The id keying this dialog's recent-path history (default a file-dialog id distinct from chdir).
  showError?: (message: string) => void;   // Called to show an error (bad filename / directory). Wire it to errorBox in an app.
  onResolve?: (path: string | null) => void;   // Called when the dialog resolves — with the chosen absolute path, or `null` on cancel.
}
```

## FileEditor

The file-bound editor (load/save/saveAs, `.bak` backups, modified-close prompts).

```ts
new FileEditor(options: FileEditorOptions)   // extends Editor
// methods & signals:
fileName: Signal<string | undefined>
loadFile(): void
save(): Promise<boolean>
saveAs(): Promise<boolean>
saveFile(): boolean
valid(_command: 'close' | 'quit'): Promise<boolean>
```

## FileEditorOptions

Construction options for FileEditor.

```ts
interface FileEditorOptions {
  fs: FileSystem;   // The filesystem to read and write through (the only path to disk).
  fileName?: string;   // The bound file path; omit for an untitled buffer.
  backupFiles?: boolean;   // Keep a `.bak` of the previous content on each save (default `true`).
  promptOnReplace?: boolean;   // Prompt before overwriting during the editor's replace flow (default `true`).
}
```

## FileInfoPane

The file-info read-out pane (search path + focused-entry name/size/date/time).

```ts
new FileInfoPane(opts: FileInfoPaneOptions)   // extends View
```

## FileInfoPaneOptions

Construction options for FileInfoPane.

```ts
interface FileInfoPaneOptions {
  fs: FileSystem;   // The filesystem to read through (used to expand the search path).
  directory: () => string;   // The current directory shown, with the wildcard, on row 0.
  wildcard: () => string;   // The active wildcard, appended to the row-0 search path.
  focusedEntry: () => DirEntry | undefined;   // The focused entry shown on row 1, or `undefined` when the list is empty.
}
```

## FileInput

The filename input that mirrors the focused directory entry unless it is itself focused.

```ts
new FileInput(opts: FileInputOptions)   // extends Input
```

## FileInputOptions

Construction options for FileInput.

```ts
interface FileInputOptions {
  value: Signal<string>;   // The two-way filename value (reflects the field, receives the typed name).
  focusedEntry: () => DirEntry | undefined;   // The currently-focused list entry to mirror.
  wildcard: () => string;   // The active wildcard, appended after the separator when mirroring a directory.
  sep: string;   // The path separator to insert between a directory name and the wildcard.
  maxLength?: number;   // Maximum length of the stored value.
  validator?: Validator;   // An optional keystroke validator (standard Input behaviour).
}
```

## FileList

The two-column file listing, driven reactively by a directory scan.

```ts
new FileList(opts: FileListOptions)   // extends ListView<DirEntry>
// methods & signals:
directory: Signal<string>
wildcard: Signal<string>
showHidden: Signal<boolean>
entries: Signal<DirEntry[]>
focusedEntry: () => DirEntry | undefined
```

## FileListOptions

Construction options for FileList.

```ts
interface FileListOptions {
  fs: FileSystem;   // The filesystem to read through.
  directory: Signal<string>;   // The current directory; the list re-scans whenever it changes.
  wildcard?: Signal<string>;   // The file wildcard (default an internal `'*'` signal). Applies to files only.
  showHidden?: Signal<boolean>;   // Whether hidden (dot) files are shown (default an internal `false` signal).
  filter?: (entry: DirEntry) => boolean;   // An extra predicate AND-ed with the wildcard; off by default.
  focused?: Signal<number>;   // The focused display index (default an internal signal at 0).
  selected?: Signal<number>;   // The selected display index (default an internal signal at -1).
  bar?: ScrollBar;   // A scroll bar to drive; when omitted the list owns its own vertical bar.
  onOpenEntry?: (entry: DirEntry) => void;   // Fired on Enter/double-click with the activated entry (enter a directory / resolve a file).
  command?: string;   // A command name emitted on activation, handled elsewhere (like Button ).
}
```

## FileStat

A single stat result.

```ts
interface FileStat {
  kind: 'file' | 'dir' | 'symlink';
  size: number;
  mtime: Date;
}
```

## FileSystem

The injectable filesystem the dialogs read and write through.

```ts
interface FileSystem {
  readDir(path: string): DirEntry[];   // List one directory. Each entry is tagged by its own type (a symlink stays a symlink, with its target's `size`/`mtime` and a `broken` flag). A permission error on a *single* entry skips just that entry; a failure to open the directory itself throws (the dialog turns that into an error box).
  stat(path: string): FileStat;   // Describe a path, following symlinks to their target. Throws if the target is missing or unreadable.
  lstat(path: string): FileStat;   // Describe a path *without* following symlinks, so a link is reported as a link.
  resolve(...segments: string[]): string;   // Absolutize and normalize the joined segments (like `node:path.resolve`).
  isAbsolute(path: string): boolean;   // Whether the path is absolute (like `node:path.isAbsolute`).
  join(...segments: string[]): string;   // Join path segments (like `node:path.join`).
  dirname(path: string): string;   // The parent directory of a path (like `node:path.dirname`).
  basename(path: string): string;   // The final segment of a path (like `node:path.basename`).
  sep: string;   // The platform path separator (`'/'` on POSIX, `'\\'` on Windows).
  homedir(): string;   // The user's home directory (like `os.homedir()`).
  roots(): string[];   // The filesystem roots — `['/']` on POSIX; the available drive letters on Windows.
  readFile(path: string): string;   // Read a file as UTF-8 text. Throws if the file is missing or unreadable.
  writeFile(path: string, text: string): void;   // Write UTF-8 text to a file, creating or replacing it.
  rename(from: string, to: string): void;   // Rename or move a file. Throws if the source is missing.
  unlink(path: string): void;   // Delete a file. Throws if it is missing (the editor swallows this on a first-time `.bak`).
}
```

## OpenFileInEditorOptions

Options for openFileInEditor — every FileEditorOptions field, plus an initial rect.

```ts
interface OpenFileInEditorOptions {
  rect?: Rect;   // The window's initial rectangle, applied before it is mounted.
}
```

## OpenFileOptions

Options for openFile.

```ts
interface OpenFileOptions {
  fs?: FileSystem;   // The filesystem to read through (default nodeFileSystem).
  directory?: string;   // The starting directory (default the filesystem's cwd).
  wildcard?: string;   // The starting wildcard (default `'*.*'`).
  save?: boolean;   // Show save mode — the OK/Replace/Clear button set — instead of open mode.
  title?: string;   // The dialog title.
  inputName?: string;   // The filename input label (default `'~N~ame'`; wrap the hotkey letter in tildes).
  filter?: (entry: DirEntry) => boolean;   // An extra predicate AND-ed with the wildcard when listing files.
}
```

## ScanOptions

Options for scanDirectory.

```ts
interface ScanOptions {
  wildcard?: string;   // The file wildcard (default `'*'`). Applied to files only; directories are always listed.
  showHidden?: boolean;   // Include hidden (dot) entries (default `false`).
  filter?: (entry: DirEntry) => boolean;   // An extra predicate AND-ed with the wildcard; never applied to `..`. Off by default.
}
```

## buildDirTree

Build the directory-tree rows for a current path: the ancestor chain from the root down to it, followed by its immediate subdirectories.

```ts
buildDirTree(fs: FileSystem, currentPath: string): DirNode[]
```

## changeDir

Show a modal change-directory dialog and resolve to the chosen absolute directory, or `null` if the user cancels.

```ts
changeDir(host: ExecHost, opts: ChangeDirOptions = {}): Promise<string | null>
```

## compareEntries

The listing sort order, as a comparator over two entries: files A–Z, then directories A–Z, then `..` last, comparing names case-sensitively.

```ts
compareEntries(a: DirEntry, b: DirEntry): number
```

## errorBox

Show a modal error box with a message and an OK button; resolves once the user closes it (OK or Esc).

```ts
errorBox(host: ExecHost, message: string): Promise<void>
```

## isWild

Whether a pattern actually contains a wildcard (`*` or `?`), i.e. is not a plain literal name.

```ts
isWild(pattern: string): boolean
```

## nodeFileSystem

The default filesystem — Node's `fs`/`path`/`os` only.

```ts
const nodeFileSystem: FileSystem
```

## openFile

Show a modal file dialog and resolve to the chosen absolute path, or `null` if the user cancels.

```ts
openFile(host: ExecHost, opts: OpenFileOptions = {}): Promise<string | null>
```

## openFileInEditor

Open (or create) a file in a new editor window on the desktop.

```ts
openFileInEditor(host: { desktop: Pick<Desktop, 'addWindow'> }, opts: OpenFileInEditorOptions): { window: EditWindow; editor: FileEditor }
```

## scanDirectory

Scan one directory through a filesystem and return the sorted, filtered listing model.

```ts
scanDirectory(fs: FileSystem, dirPath: string, opts: ScanOptions = {}): DirEntry[]
```

## wildcardMatch

Match a whole `name` against a `*`/`?` `pattern`, case-sensitively (`"*.*"` behaves as `"*"`).

```ts
wildcardMatch(pattern: string, name: string): boolean
```
