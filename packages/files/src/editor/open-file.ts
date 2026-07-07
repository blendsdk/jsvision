/**
 * `openFileInEditor` — the files-side hosting factory (RD-08 03-06, plan-preflight PF-001).
 *
 * TV always `new`s a `TFileEditor` inside `TEditWindow` (`teditwnd.cpp:58`); with PF-001 the ui
 * `EditWindow` takes a caller-supplied `editor` instead, and THIS factory composes the pair —
 * ui never sees `FileSystem`/`FileEditor`, so no dependency cycle. It constructs the
 * `FileEditor` (+ `loadFile()`), news `EditWindow({ editor })`, binds
 * `fileName → window.title` with `?? 'Untitled'` (reactive — a `saveAs` retitles, PF-013 — the
 * `cmUpdateTitle` broadcast made a signal), adds the window to the host desktop, and returns
 * both.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { EditWindow } from '@jsvision/ui';
import type { Desktop, Rect } from '@jsvision/ui';
import { FileEditor } from './file-editor.js';
import type { FileEditorOptions } from './file-editor.js';

/** The factory options — the `FileEditor` options verbatim (clipboard/editorDialog ride `EditorOptions`). */
export interface OpenFileInEditorOptions extends FileEditorOptions {
  /** Optional initial window rect, applied BEFORE mounting (the WM set-rect-then-add idiom). */
  rect?: Rect;
}

/**
 * Open (or create) a file in a new `EditWindow` on the host desktop.
 *
 * @param host The app handle (the `createApplication` result satisfies this structurally).
 * @param opts The `FileEditor` options (`fs` required; `fileName` optional ⇒ untitled).
 * @returns The mounted window and its hosted editor.
 */
export function openFileInEditor(
  host: { desktop: Pick<Desktop, 'addWindow'> },
  opts: OpenFileInEditorOptions,
): { window: EditWindow; editor: FileEditor } {
  const editor = new FileEditor(opts);
  editor.loadFile();
  const window = new EditWindow({ editor, clipboard: opts.clipboard, editorDialog: opts.editorDialog });
  if (opts.rect !== undefined) window.layout.rect = { ...opts.rect };
  // The reactive title bind (PF-013): fileName → title, 'Untitled' fallback.
  window.onMount(() => {
    window.bind(
      () => editor.fileName(),
      (name) => window.title.set(name ?? 'Untitled'),
    );
  });
  host.desktop.addWindow(window);
  return { window, editor };
}
