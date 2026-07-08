/**
 * The app's only filesystem surface: open and save a theme file. It reuses `@jsvision/files`'
 * `openFile` opener (which runs the modal `FileDialog` and returns a path or `null`) and reads/writes
 * through an injected {@link FileSystem}; a bad file surfaces in an error box and never crashes or
 * mutates the model. `@jsvision/core` stays pure — all I/O lives here.
 */
import { openFile, errorBox, nodeFileSystem } from '@jsvision/files';
import type { FileSystem, ExecHost } from '@jsvision/files';
import { InvalidThemeError } from '@jsvision/core';
import { confirm } from '@jsvision/ui';
import type { ModalDialogHost } from '@jsvision/ui';

import type { DesignerModel } from '../model/index.js';

/** The modal + filesystem seams the file operations depend on (defaults wrap `@jsvision/files`). */
export interface FileIoDeps {
  model: DesignerModel;
  /** File read/write (default {@link nodeFileSystem}). */
  fs: Pick<FileSystem, 'readFile' | 'writeFile'>;
  /** Prompt for a path (open or save); resolves to the path or `null` on cancel. */
  openPath: (save: boolean) => Promise<string | null>;
  /** Confirm discarding unsaved edits; resolves to whether to proceed. */
  confirmDiscard: () => Promise<boolean>;
  /** Surface an error to the user (never throws). */
  showError: (message: string) => Promise<void>;
  /** Remembered last path, for a plain Save. */
  getLastPath: () => string | null;
  setLastPath: (path: string | null) => void;
}

/** The default modal/filesystem seams for a live app, bound to its host. */
export function defaultFileIoSeams(host: ExecHost & ModalDialogHost): {
  fs: Pick<FileSystem, 'readFile' | 'writeFile'>;
  openPath: (save: boolean) => Promise<string | null>;
  confirmDiscard: () => Promise<boolean>;
  showError: (message: string) => Promise<void>;
} {
  return {
    fs: nodeFileSystem,
    openPath: (save) => openFile(host, { save }),
    confirmDiscard: () => confirm(host, 'Discard unsaved changes?'),
    showError: async (message) => {
      await errorBox(host, message);
    },
  };
}

/** If the model is dirty, ask before discarding; returns whether to proceed. Clean state always proceeds. */
export async function guardDirty(d: FileIoDeps): Promise<boolean> {
  if (!d.model.state().dirty) return true;
  return d.confirmDiscard();
}

/**
 * Open a theme file: guard unsaved edits, prompt for a path, read it, and adopt it via
 * `model.importJson`. A parse/validate/read failure shows an error and leaves the model unchanged.
 *
 * @param d The file-I/O seams + model.
 * @example
 * await openTheme(deps); // shows the dialog, adopts the chosen file, or no-ops on cancel
 */
export async function openTheme(d: FileIoDeps): Promise<void> {
  if (!(await guardDirty(d))) return;
  const path = await d.openPath(false);
  if (path === null) return;
  let json: string;
  try {
    json = d.fs.readFile(path);
  } catch (e) {
    await d.showError(`Could not read ${path}: ${errorMessage(e)}`);
    return;
  }
  try {
    d.model.importJson(json);
  } catch (e) {
    const detail = e instanceof InvalidThemeError ? e.message : errorMessage(e);
    await d.showError(`Not a valid theme file: ${detail}`);
    return;
  }
  d.setLastPath(path);
}

/**
 * Save the current theme: to the remembered path (plain Save) or a prompted one (Save As / first save).
 * A write failure shows an error and leaves the model dirty.
 *
 * @param d The file-I/O seams + model.
 * @param saveAs Force the path prompt even when a last path is remembered.
 * @example
 * await saveTheme(deps, false); // Save (prompts only if no path yet)
 * await saveTheme(deps, true);  // Save As (always prompts)
 */
export async function saveTheme(d: FileIoDeps, saveAs: boolean): Promise<void> {
  const remembered = d.getLastPath();
  const path = !saveAs && remembered !== null ? remembered : await d.openPath(true);
  if (path === null) return;
  try {
    d.fs.writeFile(path, d.model.exportJson());
  } catch (e) {
    await d.showError(`Could not save ${path}: ${errorMessage(e)}`);
    return;
  }
  d.model.markSaved();
  d.setLastPath(path);
}

/** A safe message from an unknown thrown value. */
function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
