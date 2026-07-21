/**
 * Opens (or creates) a file in a new editor window on a desktop, wiring everything up in one call:
 * it builds a {@link FileEditor}, loads the file, wraps it in an `EditWindow`, keeps the window title
 * in sync with the file name (falling back to `'Untitled'`, so a later "save as" retitles the window
 * automatically), adds the window to the desktop, and hands back both objects.
 *
 * Use this rather than assembling a `FileEditor` and window by hand.
 */
import { EditWindow } from '@jsvision/ui';
import type { Desktop, Rect } from '@jsvision/ui';
import { FileEditor } from './file-editor.js';
import type { FileEditorOptions } from './file-editor.js';

/** Options for {@link openFileInEditor} — every {@link FileEditorOptions} field, plus an initial rect. */
export interface OpenFileInEditorOptions extends FileEditorOptions {
  /** The window's initial rectangle, applied before it is mounted. */
  rect?: Rect;
}

/**
 * Open (or create) a file in a new editor window on the desktop.
 *
 * @param host An object with a `desktop` to add the window to — the `createApplication` result works.
 * @param opts The editor options (`fs` required; omit `fileName` for an untitled buffer) plus `rect`.
 * @returns The mounted window and its editor.
 * @example
 * import { createApplication } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { openFileInEditor, nodeFileSystem } from '@jsvision/files';
 *
 * const caps = resolveCapabilities().profile; // ambient: reads process.env + process.platform
 * const app = createApplication({ caps });
 *
 * const { window, editor } = openFileInEditor(app, {
 *   fs: nodeFileSystem,
 *   fileName: '/home/user/notes.txt',   // omit for an untitled buffer
 *   rect: { x: 2, y: 2, width: 60, height: 20 },
 * });
 * await editor.save();
 */
export function openFileInEditor(
  host: { desktop: Pick<Desktop, 'addWindow'> },
  opts: OpenFileInEditorOptions,
): { window: EditWindow; editor: FileEditor } {
  const editor = new FileEditor(opts);
  editor.loadFile();
  // Pass the rect through the constructor so the very first paint uses it; setting layout.rect after
  // construction would leave one frame drawn at stale geometry before the mount re-pins it.
  const window = new EditWindow({
    editor,
    clipboard: opts.clipboard,
    editorDialog: opts.editorDialog,
    rect: opts.rect,
  });
  // Keep the window title in sync with the file name, defaulting to 'Untitled'.
  window.onMount(() => {
    window.bind(
      () => editor.fileName(),
      (name) => window.title.set(name ?? 'Untitled'),
    );
  });
  host.desktop.addWindow(window);
  return { window, editor };
}
