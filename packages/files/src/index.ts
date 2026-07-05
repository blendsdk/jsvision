/**
 * `@jsvision/files` — the Turbo Vision file-system dialog family on `@jsvision/ui`.
 *
 * Public API (explicit named re-exports; `export type` for type-only symbols per the ESM
 * `verbatimModuleSyntax` convention shared with `@jsvision/ui`):
 *   • the `FileSystem` seam + `node:fs` default + pure cores (`fs/`);
 *   • the listing trio `FileList`/`FileInput`/`FileInfoPane` + the `DirList` tree;
 *   • the `FileDialog`/`ChDirDialog` modals + the local `errorBox`.
 *
 * `.js` specifiers per NodeNext ESM resolution.
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
