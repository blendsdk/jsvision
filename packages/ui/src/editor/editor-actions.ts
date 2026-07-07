/**
 * The editor action dispatch — a faithful transcription of `TEditor::handleEvent`'s `evCommand`
 * switch (`teditor1.cpp:625-736`, re-verified 2026-07-07 @ 57b6f56) over the PA-15 internal
 * `EditorAction` ids (PF-011 decided split from editor.ts).
 *
 * TV wraps the motion/edit block in `lock() … trackCursor(centerCursor) … unlock()`; the dialog
 * actions (`cmFind`/`cmReplace`/`cmSearchAgain`) sit OUTSIDE that wrap (no cursor tracking) —
 * transcribed 1:1. `cmLineStart` honors autoIndent via `indentedLineStart`
 * (`teditor2.cpp:354-362`); `cmSelectAll` is the two-step `setCurPtr(0) → setCurPtr(bufLen,
 * smExtend)` (`:723-727`).
 *
 * Also home to `EditorCommands` — the ui-side registry-level command names (PA-15 as amended by
 * PF-004/PF-005: find/replace/searchAgain/clear; `save`/`saveAs` are files-owned `FileCommands`).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { lineStart, lineEnd, nextChar, prevChar, nextWord, prevWord, nextLine, lineMove } from './buffer/index.js';
import type { EditorAction } from './keymap.js';
import { Editor, SM_EXTEND } from './editor.js';

/**
 * The registry-level editor commands (PA-15, PF-004/PF-005 amendment): menus/status bind these;
 * the focused `Editor` handles them. `save`/`saveAs` live in `@jsvision/files`' `FileCommands`
 * (the TV decode places both in `TFileEditor`, `tfiledtr.cpp:257-262`).
 */
export const EditorCommands = {
  /** Open the find dialog (TV `cmFind`). */
  find: 'find',
  /** Open the replace dialog (TV `cmReplace`). */
  replace: 'replace',
  /** Repeat the last search (TV `cmSearchAgain`). */
  searchAgain: 'searchAgain',
  /** Delete the selection (TV `cmClear`, `teditor2.cpp:633` — PF-005; menu-reached, no live chord). */
  clear: 'clear',
} as const;

/** `TEditor::indentedLineStart` (`teditor2.cpp:354-362`) — Home lands after the indent first. */
function indentedLineStart(ed: Editor, p: number): number {
  const startPtr = lineStart(ed.buf, p);
  let destPtr = startPtr;
  let c: string;
  while (destPtr < ed.buf.length && ((c = ed.buf.charAt(destPtr)) === ' ' || c === '\t')) destPtr++;
  return destPtr === p ? startPtr : destPtr;
}

/**
 * Apply one action — the `evCommand` switch transcription. Motion/edit actions end with the TV
 * `trackCursor(centerCursor)`; the dialog actions return without tracking (decode).
 *
 * @param ed The editor.
 * @param action The internal action id.
 * @param selectMode The ambient TV selectMode bits (shift/selecting → `smExtend`).
 * @param centerCursor TV's `!cursorVisible()` — center the viewport instead of nudging it.
 */
export function applyAction(ed: Editor, action: EditorAction, selectMode: number, centerCursor = false): void {
  switch (action) {
    // Outside the tracked block (teditor1.cpp:625-636). The seam is async (PA-17) — dispatch
    // never blocks on it; the fire-and-forget is deliberate.
    case 'find':
      void ed.find();
      return;
    case 'replace':
      void ed.replace();
      return;
    case 'searchAgain':
      void ed.searchAgain();
      return;
    // The tracked block (teditor1.cpp:637-733).
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
    case 'redo': // RD-08 extension (PA-1) — rides the same tracked block as undo
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
      ed.coalesceNextEdit = true; // single-cluster deletes coalesce (AR-253)
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
      // TV startSelect (teditor2.cpp:562-566): collapse, then arm persistent select.
      ed.selecting = false;
      ed.setSelect(ed.curPtr, ed.curPtr, false);
      ed.selecting = true;
      break;
    case 'hideSelect':
      // TV hideSelect (teditor2.cpp:86-90).
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
