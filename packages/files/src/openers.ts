/**
 * Convenience openers `openFile` / `changeDir` (03-05, PF-002) — the one-call façade over the modal
 * dialogs.
 *
 * Each constructs the dialog over a default `nodeFileSystem` (overridable via `fs`), wires the local
 * `errorBox` into the dialog's `showError` seam (PA-3), then runs the shipped modal lifecycle against
 * an **`execView`-capable host** (the `createApplication` handle `{ loop, desktop }` — NOT a bare
 * `ModalHost`, PF-002): **add-to-desktop → `execView` → remove-in-`finally`**. Resolves to the absolute
 * path on OK, or `null` on cancel. `.js` per NodeNext.
 */
import { signal, Commands } from '@jsvision/ui';
import { nodeFileSystem } from './fs/node-fs.js';
import { FileDialog } from './dialog/file-dialog.js';
import { ChDirDialog } from './dialog/chdir-dialog.js';
import { errorBox } from './dialog/error-dialog.js';
import type { ExecHost } from './dialog/error-dialog.js';
import type { DirEntry, FileSystem } from './fs/types.js';

/** Options for {@link openFile}. */
export interface OpenFileOptions {
  /** The filesystem seam (default `nodeFileSystem`). */
  fs?: FileSystem;
  /** The initial directory (default the seam's cwd `resolve('.')`). */
  directory?: string;
  /** The initial wildcard (default `'*.*'`). */
  wildcard?: string;
  /** Save mode — the OK/Replace/Clear button set (default open mode). */
  save?: boolean;
  /** The dialog title. */
  title?: string;
  /** The filename input label (default `'~N~ame'`). */
  inputName?: string;
  /** A caller predicate AND-ed with the wildcard (PA-10). */
  filter?: (entry: DirEntry) => boolean;
}

/** Options for {@link changeDir}. */
export interface ChangeDirOptions {
  /** The filesystem seam (default `nodeFileSystem`). */
  fs?: FileSystem;
  /** The initial directory (default the seam's cwd `resolve('.')`). */
  directory?: string;
  /** The dialog title. */
  title?: string;
}

/**
 * Open a modal file dialog and resolve to the chosen absolute path, or `null` on cancel.
 *
 * @param host The `execView`-capable app handle (`{ loop, desktop }`).
 * @param opts Filesystem seam + initial directory/wildcard + open/save mode.
 */
export async function openFile(host: ExecHost, opts: OpenFileOptions = {}): Promise<string | null> {
  const fs = opts.fs ?? nodeFileSystem;
  const dlg = new FileDialog({
    fs,
    directory: signal(opts.directory ?? fs.resolve('.')),
    wildcard: opts.wildcard !== undefined ? signal(opts.wildcard) : undefined,
    save: opts.save,
    title: opts.title,
    inputName: opts.inputName,
    filter: opts.filter,
    showError: (message) => void errorBox(host, message),
  });
  host.desktop.addWindow(dlg);
  try {
    const command = await host.loop.execView<string>(dlg);
    return command === Commands.ok ? dlg.result() : null;
  } finally {
    host.desktop.removeWindow(dlg);
  }
}

/**
 * Open a modal change-directory dialog and resolve to the chosen absolute directory, or `null` on cancel.
 *
 * @param host The `execView`-capable app handle (`{ loop, desktop }`).
 * @param opts Filesystem seam + initial directory.
 */
export async function changeDir(host: ExecHost, opts: ChangeDirOptions = {}): Promise<string | null> {
  const fs = opts.fs ?? nodeFileSystem;
  const dlg = new ChDirDialog({
    fs,
    directory: signal(opts.directory ?? fs.resolve('.')),
    title: opts.title,
    showError: (message) => void errorBox(host, message),
  });
  host.desktop.addWindow(dlg);
  try {
    const command = await host.loop.execView<string>(dlg);
    return command === Commands.ok ? dlg.result() : null;
  } finally {
    host.desktop.removeWindow(dlg);
  }
}
