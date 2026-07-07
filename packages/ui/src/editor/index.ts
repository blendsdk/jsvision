/**
 * Editor-family barrel (RD-08) — the public surface per 03-07 §Packaging. The pure internals
 * (`buffer/*`, `format.ts` internals, the keymap tables, `undo.ts`, `search.ts` helpers) stay
 * internal; only the components, builders, commands, and option/seam types ride the package.
 */
export { Editor } from './editor.js';
export type { EditorOptions, IndicatorTarget, EditorCommandSeam } from './editor.js';
export { Memo } from './memo.js';
export type { MemoOptions } from './memo.js';
export { EditWindow } from './edit-window.js';
export type { EditWindowOptions } from './edit-window.js';
export { Indicator } from './indicator.js';
export { EditorCommands } from './editor-actions.js';
export type { EditorAction } from './keymap.js';
export { defaultEditorDialog } from './editor-dialog.js';
export type {
  EditorDialogHandler,
  EditorDialogRequest,
  EditorDialogResult,
  FindRec,
  ReplaceRec,
  SearchOptions,
} from './editor-dialog.js';
export { findDialog, replaceDialog, confirmBox, infoBox, replacePrompt, wireEditorDialogs } from './dialogs.js';
export type { EditorDialogHost } from './dialogs.js';
export type { LineEnding } from './buffer/index.js';
