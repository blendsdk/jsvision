/**
 * `@jsvision/files` — the file-system dialog family for `@jsvision/ui`.
 *
 * What's here:
 *   - `FileDialog` / `ChDirDialog` — the modal open/save and change-directory dialogs, plus the
 *     one-call `openFile` / `changeDir` openers that prompt and resolve to a path;
 *   - `FileEditor` and `openFileInEditor` — a file-bound text editor and a factory to host it;
 *   - `FileList` / `FileInput` / `FileInfoPane` / `DirList` — the widgets the dialogs are built from,
 *     for composing your own pickers;
 *   - the injectable `FileSystem` (default `nodeFileSystem`) and pure helpers (`scanDirectory`,
 *     `buildDirTree`, `wildcardMatch`, `isWild`).
 *
 * Everything reads and writes through the {@link FileSystem}, so the whole family runs against a
 * virtual tree in tests or a demo, not just real disk.
 */

// —— fs/ seam + pure cores ——
export type { FileSystem, DirEntry, FileStat } from './fs/types.js';
export { nodeFileSystem } from './fs/node-fs.js';
export { isWild, wildcardMatch } from './fs/wildcard.js';
export { scanDirectory, compareEntries } from './fs/scan.js';
export type { ScanOptions } from './fs/scan.js';
export { buildDirTree } from './fs/tree.js';
export type { DirNode } from './fs/tree.js';

// —— list / input / tree views ——
export { FileList } from './list/file-list.js';
export type { FileListOptions } from './list/file-list.js';
export { FileInfoPane } from './list/file-info-pane.js';
export type { FileInfoPaneOptions } from './list/file-info-pane.js';
export { DirList } from './list/dir-list.js';
export type { DirListOptions } from './list/dir-list.js';
export { FileInput } from './input/file-input.js';
export type { FileInputOptions } from './input/file-input.js';

// —— dialogs ——
export { FileDialog } from './dialog/file-dialog.js';
export type { FileDialogOptions } from './dialog/file-dialog.js';
export { ChDirDialog } from './dialog/chdir-dialog.js';
export type { ChDirDialogOptions } from './dialog/chdir-dialog.js';
export { errorBox } from './dialog/error-dialog.js';
export type { ExecHost } from './dialog/error-dialog.js';

// —— convenience openers ——
export { openFile, changeDir } from './openers.js';
export type { OpenFileOptions, ChangeDirOptions } from './openers.js';

// The editor family: the file-bound editor, the factory that opens a file in a window, and the
// command names for wiring a File menu (save/save-as behaviour lives here, not in the base editor).
export { FileEditor, openFileInEditor, FileCommands } from './editor/index.js';
export type { FileEditorOptions, OpenFileInEditorOptions } from './editor/index.js';
