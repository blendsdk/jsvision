/**
 * Editor option/seam types + tiny shared helpers (RD-08 03-02 — split from `editor.ts` per the
 * PF-011 ≤500-line rule; re-exported through the editor barrel unchanged).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { View } from '../view/index.js';
import type { EditorDialogHandler } from './editor-dialog.js';
import type { Editor } from './editor.js';

/** The structural indicator seam (plan-preflight PF-003) — the Phase-7 `Indicator` satisfies it. */
export interface IndicatorTarget {
  /** The `doUpdate` push: 1-based `line:col` + the modified flag. */
  setValue(pos: { line: number; col: number }, modified: boolean): void;
}

/** The optional command-greying seam (the `updateCommands` decode, PA-4; DesktopLoopSeam idiom). */
export interface EditorCommandSeam {
  /** Enable/disable a registry command (wired to `EventLoop.enableCommand` by the app). */
  enable(command: string, enabled: boolean): void;
}

/** Construction options (03-02; every field optional — a bare `new Editor()` is fully usable). */
export interface EditorOptions {
  /** The shared clipboard editor (PA-2 — injectable, NO implicit default; TV null-clipboard semantics). */
  clipboard?: Editor;
  /** The dialog seam (03-03); default answers cancel (`defEditorDialog`). */
  editorDialog?: EditorDialogHandler;
  /** Undo-stack depth (PA-1; default 1000). */
  undoDepth?: number;
  /** Copy the previous line's leading whitespace on Enter (TV `cmIndentMode`; default false). */
  autoIndent?: boolean;
  /** Start in overwrite mode (TV `cmInsMode` toggles; default false = insert). */
  overwrite?: boolean;
  /** Command-greying seam (the `updateCommands` decode; default no-op). */
  commands?: EditorCommandSeam;
}

/** The minimal scroll-bar surface the gadget pushes need (a structural `ScrollBar` subset). */
export interface GadgetBar {
  setRange(min: number, max: number, pageStep?: number, arrowStep?: number): void;
}

/** Walk `v`'s parent chain to decide whether it sits within (or is) `root` (the TabView idiom). */
export function isWithin(v: View | null, root: View): boolean {
  let cur: View | null = v;
  while (cur !== null) {
    if (cur === root) return true;
    cur = cur.parent;
  }
  return false;
}

/** Count line breaks in `text` (CRLF = one) — TV `countLines` made a regex scan. */
export function countBreaks(text: string): number {
  const m = text.match(/\r\n|\r|\n/g);
  return m === null ? 0 : m.length;
}
