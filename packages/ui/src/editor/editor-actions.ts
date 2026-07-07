/**
 * Runs one internal editor action against an {@link Editor} — the single switch that turns an
 * {@link EditorAction} id (a resolved keystroke, or a call to `Editor.execute`) into a cursor move,
 * a mutation, or a find/replace.
 *
 * Most actions run the caret motion/edit and then keep the caret in view; the find/replace actions
 * do not track the cursor (they open a dialog instead). Also the home of {@link EditorCommands},
 * the app-level command names that menus and the status line bind to. (Save/Save-as are not here;
 * they belong to the file-backed editor in `@jsvision/files`.)
 */
import { lineStart, lineEnd, nextChar, prevChar, nextWord, prevWord, nextLine, lineMove } from './buffer/index.js';
import type { EditorAction } from './keymap.js';
import { Editor, SM_EXTEND } from './editor.js';

/**
 * The app-level editor command names. Bind these from a menu or the status line; the focused
 * `Editor` handles them. Save and Save-as are not here — they belong to the file-backed editor in
 * `@jsvision/files`.
 *
 * @example
 * import { menuBar, subMenu, item, EditorCommands } from '@jsvision/ui';
 *
 * const search = subMenu('~S~earch', [
 *   item('~F~ind...', EditorCommands.find),
 *   item('~R~eplace...', EditorCommands.replace),
 *   item('~S~earch again', EditorCommands.searchAgain),
 * ]);
 */
export const EditorCommands = {
  /** Open the Find dialog. */
  find: 'find',
  /** Open the Replace dialog. */
  replace: 'replace',
  /** Repeat the last search. */
  searchAgain: 'searchAgain',
  /** Delete the current selection. */
  clear: 'clear',
} as const;

/** Home lands after the leading indent first (then, on a second press, at the true line start). */
function indentedLineStart(ed: Editor, p: number): number {
  const startPtr = lineStart(ed.buf, p);
  let destPtr = startPtr;
  let c: string;
  while (destPtr < ed.buf.length && ((c = ed.buf.charAt(destPtr)) === ' ' || c === '\t')) destPtr++;
  return destPtr === p ? startPtr : destPtr;
}

/**
 * Apply one action to the editor. Motion and edit actions finish by keeping the caret in view;
 * the find/replace actions open a dialog and do not move the caret.
 *
 * @param ed The editor to act on.
 * @param action The internal action id.
 * @param selectMode Selection bits: pass a non-zero value (with the `SM_EXTEND` bit) to extend the
 *   selection with the motion instead of collapsing it — set when Shift is held or select mode is on.
 * @param centerCursor When `true`, re-center the viewport on the caret rather than nudging it into
 *   view; typically passed when the caret was scrolled off-screen before the action.
 */
export function applyAction(ed: Editor, action: EditorAction, selectMode: number, centerCursor = false): void {
  switch (action) {
    // Find/replace open an async dialog; dispatch must not block on it, so fire-and-forget and
    // return without the cursor-tracking the motion/edit actions do.
    case 'find':
      void ed.find();
      return;
    case 'replace':
      void ed.replace();
      return;
    case 'searchAgain':
      void ed.searchAgain();
      return;
    // Everything below runs the edit/motion and then tracks the cursor at the end of the switch.
    case 'cut':
      ed.cut();
      break;
    case 'copy':
      ed.copy();
      break;
    case 'paste':
      ed.paste();
      break;
    case 'undo':
      ed.undo();
      break;
    case 'redo':
      ed.redo();
      break;
    case 'clear':
      ed.deleteSelect();
      break;
    case 'charLeft':
      ed.setCurPtr(prevChar(ed.buf, ed.curPtr), selectMode);
      break;
    case 'charRight':
      ed.setCurPtr(nextChar(ed.buf, ed.curPtr), selectMode);
      break;
    case 'wordLeft':
      ed.setCurPtr(prevWord(ed.buf, ed.curPtr), selectMode);
      break;
    case 'wordRight':
      ed.setCurPtr(nextWord(ed.buf, ed.curPtr), selectMode);
      break;
    case 'lineStart':
      ed.setCurPtr(ed.autoIndentOn ? indentedLineStart(ed, ed.curPtr) : lineStart(ed.buf, ed.curPtr), selectMode);
      break;
    case 'lineEnd':
      ed.setCurPtr(lineEnd(ed.buf, ed.curPtr), selectMode);
      break;
    case 'lineUp':
      ed.setCurPtr(lineMove(ed.buf, ed.curPtr, -1), selectMode);
      break;
    case 'lineDown':
      ed.setCurPtr(lineMove(ed.buf, ed.curPtr, 1), selectMode);
      break;
    case 'pageUp':
      ed.setCurPtr(lineMove(ed.buf, ed.curPtr, -(ed.viewH() - 1)), selectMode);
      break;
    case 'pageDown':
      ed.setCurPtr(lineMove(ed.buf, ed.curPtr, ed.viewH() - 1), selectMode);
      break;
    case 'textStart':
      ed.setCurPtr(0, selectMode);
      break;
    case 'textEnd':
      ed.setCurPtr(ed.buf.length, selectMode);
      break;
    case 'newLine':
      ed.newLine();
      break;
    case 'backSpace':
      ed.coalesceNextEdit = true; // consecutive single-char deletes merge into one undo step
      ed.deleteRange(prevChar(ed.buf, ed.curPtr), ed.curPtr, true);
      break;
    case 'delChar':
      ed.coalesceNextEdit = true;
      ed.deleteRange(ed.curPtr, nextChar(ed.buf, ed.curPtr), true);
      break;
    case 'delWord':
      ed.deleteRange(ed.curPtr, nextWord(ed.buf, ed.curPtr), false);
      break;
    case 'delWordLeft':
      ed.deleteRange(prevWord(ed.buf, ed.curPtr), ed.curPtr, false);
      break;
    case 'delStart':
      ed.deleteRange(lineStart(ed.buf, ed.curPtr), ed.curPtr, false);
      break;
    case 'delEnd':
      ed.deleteRange(ed.curPtr, lineEnd(ed.buf, ed.curPtr), false);
      break;
    case 'delLine':
      ed.deleteRange(lineStart(ed.buf, ed.curPtr), nextLine(ed.buf, ed.curPtr), false);
      break;
    case 'toggleInsert':
      ed.toggleInsMode();
      break;
    case 'startSelect':
      // Collapse any selection, then arm persistent-select so subsequent motions extend it.
      ed.selecting = false;
      ed.setSelect(ed.curPtr, ed.curPtr, false);
      ed.selecting = true;
      break;
    case 'hideSelect':
      // Turn off persistent-select and collapse the selection to the caret.
      ed.selecting = false;
      ed.setSelect(ed.curPtr, ed.curPtr, false);
      break;
    case 'toggleIndent':
      ed.autoIndentOn = !ed.autoIndentOn;
      break;
    case 'selectAll':
      ed.setCurPtr(0, selectMode);
      ed.setCurPtr(ed.buf.length, selectMode | SM_EXTEND);
      break;
  }
  ed.trackCursor(centerCursor);
}
