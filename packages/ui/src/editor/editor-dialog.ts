/**
 * The `editorDialog` seam — TV's `TEditorDialog` callback ported to a typed async discriminated
 * union (RD-08 03-03, PA-17).
 *
 * TV routes every editor prompt through one `ushort editorDialog(int dialog, ...)` hook
 * (`editors.h:86-97` — the `ed*` request codes; the default `defEditorDialog` answers `cmCancel`,
 * `editstat.cpp:18-21`). House modality is promise-based (`execView`), so the handler is async;
 * the editor awaits it without blocking the loop. The default handler answers cancel/null — every
 * `cmFind`-style action is a safe no-op until an app wires `wireEditorDialogs` (03-03).
 *
 * (File placement note: these types belong to the 03-03 concern; they land with Phase 4 because
 * the `Editor` view already carries the seam option — a mechanical phase-ordering split.)
 */
import type { Point } from '../view/index.js';

/** Literal-search options — the TV `efCaseSensitive`/`efWholeWordsOnly` bits as booleans (`editors.h:99-103`). */
export interface SearchOptions {
  caseSensitive: boolean;
  wholeWords: boolean;
}

/** The find-dialog record (TV `TFindDialogRec`, `editors.h`). */
export interface FindRec {
  find: string;
  options: SearchOptions;
}

/** The replace-dialog record (TV `TReplaceDialogRec`) — the `ef*` flags as booleans (AC-9). */
export interface ReplaceRec extends FindRec {
  replace: string;
  promptOnReplace: boolean;
  replaceAll: boolean;
}

/** One request through the seam — TV's `ed*` codes as a discriminated union (`editors.h:86-97`). */
export type EditorDialogRequest =
  | { kind: 'find'; rec: FindRec }
  | { kind: 'replace'; rec: ReplaceRec }
  | { kind: 'replacePrompt'; cursor: Point }
  | { kind: 'searchFailed' }
  | { kind: 'saveModify'; name: string }
  | { kind: 'saveUntitled' }
  | { kind: 'saveAs'; name: string }
  | { kind: 'readError' | 'writeError' | 'createError' | 'outOfMemory'; name?: string };

/** The handler's typed answer for each request family. */
export type EditorDialogResult =
  | { kind: 'find'; rec: FindRec | null }
  | { kind: 'replace'; rec: ReplaceRec | null }
  | { kind: 'confirm'; answer: 'yes' | 'no' | 'cancel' }
  | { kind: 'path'; path: string | null }
  | { kind: 'ok' };

/** The async seam shape (PA-17): one handler answers every editor prompt. */
export type EditorDialogHandler = (req: EditorDialogRequest) => Promise<EditorDialogResult>;

/**
 * The default handler — answers cancel/null for everything (TV `defEditorDialog`,
 * `editstat.cpp:18-21`), so an editor with no seam wired is fully safe.
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
