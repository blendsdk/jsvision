/**
 * Editor option/seam types and a couple of small shared helpers, re-exported through the editor's
 * public surface.
 */
import type { View } from '../view/index.js';
import type { EditorDialogHandler } from './editor-dialog.js';
import type { EditorKeyBindings } from './keymap.js';
import type { Editor } from './editor.js';

/** What the editor needs from a line/column indicator; the `Indicator` view satisfies it. */
export interface IndicatorTarget {
  /** Push the caret position (1-based `line`/`col`) and the modified flag to display. */
  setValue(pos: { line: number; col: number }, modified: boolean): void;
}

/** Optional hook for greying out menu/status commands (Cut, Copy, Paste, …) as the editor's state changes. */
export interface EditorCommandSeam {
  /** Enable or disable a command by name; wire this to your app's command registry. */
  enable(command: string, enabled: boolean): void;
}

/** Construction options for {@link Editor}. Every field is optional — a bare `new Editor()` is fully usable. */
export interface EditorOptions {
  /**
   * The shared clipboard editor. There is no implicit default: without one, in-app Cut/Copy/Paste
   * between editors is a no-op. Pass the same `Editor` instance to every editor that should share a
   * clipboard (typically a single hidden editor).
   */
  clipboard?: Editor;
  /** Handler for find/replace/save prompts. Defaults to a handler that cancels every prompt. */
  editorDialog?: EditorDialogHandler;
  /** Maximum retained undo steps (default 1000). */
  undoDepth?: number;
  /** Copy the previous line's leading whitespace when pressing Enter (default false). */
  autoIndent?: boolean;
  /** Start in overwrite mode; Insert toggles it (default false = insert mode). */
  overwrite?: boolean;
  /** Hook for greying out editing commands as selection/undo state changes (default: none). */
  commands?: EditorCommandSeam;
  /** Editor key set — `'modern'` (default) overlays Ctrl+X/C/V/A; `'wordstar'` = the classic WordStar layout. */
  keyBindings?: EditorKeyBindings;
}

/** The minimal scroll-bar surface the editor pushes ranges to (a subset of `ScrollBar`). */
export interface GadgetBar {
  setRange(min: number, max: number, pageStep?: number, arrowStep?: number): void;
}

/** Whether `v` is `root` or a descendant of it (walks the parent chain). */
export function isWithin(v: View | null, root: View): boolean {
  let cur: View | null = v;
  while (cur !== null) {
    if (cur === root) return true;
    cur = cur.parent;
  }
  return false;
}

/** Count line breaks in `text`, counting a `\r\n` pair as one. */
export function countBreaks(text: string): number {
  const m = text.match(/\r\n|\r|\n/g);
  return m === null ? 0 : m.length;
}
