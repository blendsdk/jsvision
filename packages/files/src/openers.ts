/**
 * One-call wrappers over the modal file dialogs. Each builds the dialog (over {@link nodeFileSystem}
 * unless you inject a filesystem), shows it modally on the given host, and resolves to the chosen
 * absolute path — or `null` if the user cancels. Errors during browsing surface in a built-in error
 * box. This is the easiest way to ask the user for a file or directory.
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
  /** The filesystem to read through (default {@link nodeFileSystem}). */
  fs?: FileSystem;
  /** The starting directory (default the filesystem's cwd). */
  directory?: string;
  /** The starting wildcard (default `'*.*'`). */
  wildcard?: string;
  /** Show save mode — the OK/Replace/Clear button set — instead of open mode. */
  save?: boolean;
  /** The dialog title. */
  title?: string;
  /** The filename input label (default `'~N~ame'`; wrap the hotkey letter in tildes). */
  inputName?: string;
  /** An extra predicate AND-ed with the wildcard when listing files. */
  filter?: (entry: DirEntry) => boolean;
}

/** Options for {@link changeDir}. */
export interface ChangeDirOptions {
  /** The filesystem to read through (default {@link nodeFileSystem}). */
  fs?: FileSystem;
  /** The starting directory (default the filesystem's cwd). */
  directory?: string;
  /** The dialog title. */
  title?: string;
}

/**
 * Show a modal file dialog and resolve to the chosen absolute path, or `null` if the user cancels.
 *
 * @param host A host that can run a view modally — the `createApplication` result works directly.
 * @param opts Filesystem, starting directory/wildcard, open/save mode, and title.
 * @returns The chosen absolute path, or `null` on cancel.
 * @example
 * import { createApplication } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { openFile } from '@jsvision/files';
 *
 * const caps = resolveCapabilities({ env: process.env, platform: process.platform }).profile;
 * const app = createApplication({ caps });
 *
 * const path = await openFile(app, { directory: '/home/user', wildcard: '*.ts' });
 * if (path !== null) console.log('chosen', path);
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
 * Show a modal change-directory dialog and resolve to the chosen absolute directory, or `null` if the
 * user cancels.
 *
 * @param host A host that can run a view modally — the `createApplication` result works directly.
 * @param opts Filesystem, starting directory, and title.
 * @returns The chosen absolute directory, or `null` on cancel.
 * @example
 * import { createApplication } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { changeDir } from '@jsvision/files';
 *
 * const caps = resolveCapabilities({ env: process.env, platform: process.platform }).profile;
 * const app = createApplication({ caps });
 *
 * const dir = await changeDir(app, { directory: '/home/user' });
 * if (dir !== null) console.log('changed to', dir);
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
