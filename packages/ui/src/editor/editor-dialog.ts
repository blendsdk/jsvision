/**
 * The `editorDialog` seam — a single async handler through which the editor asks the host to run a
 * find/replace dialog, a save-confirmation prompt, or an error box.
 *
 * Every editor prompt is one call to an {@link EditorDialogHandler}, which returns a typed answer.
 * Because the answer is a promise, the dialog can be a real modal window without blocking the event
 * loop. The {@link defaultEditorDialog} answers cancel/null for everything, so an editor with no
 * handler wired is fully safe — find/replace just do nothing. Wire a real handler with
 * `wireEditorDialogs` to get the actual dialogs.
 */
import type { Point } from '../view/index.js';

/** Options controlling how a literal search matches. */
export interface SearchOptions {
  /** Match case exactly when `true`. */
  caseSensitive: boolean;
  /** Match only whole words (a match flanked by word characters is skipped) when `true`. */
  wholeWords: boolean;
}

/** What the user entered in the Find dialog. */
export interface FindRec {
  /** The text to search for. */
  find: string;
  /** The match options. */
  options: SearchOptions;
}

/** What the user entered in the Replace dialog. */
export interface ReplaceRec extends FindRec {
  /** The replacement text. */
  replace: string;
  /** Ask for confirmation before each replacement when `true`. */
  promptOnReplace: boolean;
  /** Replace every match without stopping when `true`. */
  replaceAll: boolean;
}

/** One request the editor sends through the seam, as a discriminated union on `kind`. */
export type EditorDialogRequest =
  | { kind: 'find'; rec: FindRec }
  | { kind: 'replace'; rec: ReplaceRec }
  | { kind: 'replacePrompt'; cursor: Point }
  | { kind: 'searchFailed' }
  | { kind: 'saveModify'; name: string }
  | { kind: 'saveUntitled' }
  | { kind: 'saveAs'; name: string }
  | { kind: 'readError' | 'writeError' | 'createError' | 'outOfMemory'; name?: string };

/** The handler's typed answer, matched to the request `kind`. */
export type EditorDialogResult =
  | { kind: 'find'; rec: FindRec | null }
  | { kind: 'replace'; rec: ReplaceRec | null }
  | { kind: 'confirm'; answer: 'yes' | 'no' | 'cancel' }
  | { kind: 'path'; path: string | null }
  | { kind: 'ok' };

/** One async handler that answers every editor prompt. */
export type EditorDialogHandler = (req: EditorDialogRequest) => Promise<EditorDialogResult>;

/**
 * A no-op dialog handler that cancels every prompt (find/replace return `null`, confirmations return
 * `'cancel'`). It is the default when no handler is passed to an `Editor`, keeping the editor safe
 * to use without any dialog wiring — find/replace simply do nothing.
 *
 * @param req The editor's dialog request.
 * @returns A promise resolving to the cancel/no-op answer for that request kind.
 * @example
 * import { Editor, defaultEditorDialog } from '@jsvision/ui';
 *
 * // Passing it explicitly is the same as omitting `editorDialog` entirely.
 * const editor = new Editor({ editorDialog: defaultEditorDialog });
 * await editor.find(); // resolves immediately, no dialog, no match
 */
export const defaultEditorDialog: EditorDialogHandler = (req) => {
  switch (req.kind) {
    case 'find':
      return Promise.resolve({ kind: 'find', rec: null });
    case 'replace':
      return Promise.resolve({ kind: 'replace', rec: null });
    case 'replacePrompt':
    case 'saveModify':
    case 'saveUntitled':
      return Promise.resolve({ kind: 'confirm', answer: 'cancel' });
    case 'saveAs':
      return Promise.resolve({ kind: 'path', path: null });
    default:
      return Promise.resolve({ kind: 'ok' });
  }
};
