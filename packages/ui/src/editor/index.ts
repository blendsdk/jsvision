/**
 * Public surface of the editor family: the multiline `Editor` view, the dialog-embeddable `Memo`,
 * the `EditWindow` (a blue window wrapping an editor with scroll bars + a line/column indicator),
 * the `Indicator` strip, the find/replace/message-box dialog builders, and the option/seam types
 * that wire them together. The buffer internals (gap buffer, grapheme segmentation, navigation),
 * the keymap tables, the undo stack, and the search helpers are implementation detail and are not
 * re-exported.
 */
export { Editor } from './editor.js';
export type { EditorOptions, IndicatorTarget, EditorCommandSeam } from './editor.js';
export { Memo } from './memo.js';
export type { MemoOptions } from './memo.js';
export { EditWindow } from './edit-window.js';
export type { EditWindowOptions } from './edit-window.js';
export { Indicator } from './indicator.js';
export { EditorCommands } from './editor-actions.js';
export type { EditorAction, EditorKeyBindings } from './keymap.js';
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
