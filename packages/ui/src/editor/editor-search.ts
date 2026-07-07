/**
 * Find and replace operations over an {@link Editor}.
 *
 * `editorFind`/`editorReplace` ask the dialog handler for the search parameters, then run the
 * search/replace loop: find the next match, optionally prompt before replacing, then replace.
 * Replace-all loops until it is cancelled or runs out of matches, and returns the number of
 * replacements made. A "not found" message is shown except during a silent replace-all. An empty
 * search string is a no-op and does not even open a dialog.
 */
import type { Point } from '../view/index.js';
import { convertNewEdit } from './buffer/index.js';
import { scan, isWordChar } from './search.js';
import type { FindRec, ReplaceRec } from './editor-dialog.js';
import type { Editor } from './editor.js';

/** Open the Find dialog, then search for the first match from the caret. */
export async function editorFind(ed: Editor): Promise<void> {
  const rec: FindRec = { find: ed.findStr, options: { ...ed.searchOpts } };
  const res = await ed.dialog({ kind: 'find', rec });
  if (res.kind === 'find' && res.rec !== null) {
    ed.findStr = res.rec.find;
    ed.searchOpts = { ...res.rec.options };
    ed.doReplace = false;
    await editorDoSearchReplace(ed);
  }
}

/** Open the Replace dialog, then run the replace loop; returns the number of replacements made. */
export async function editorReplace(ed: Editor): Promise<number> {
  const rec: ReplaceRec = {
    find: ed.findStr,
    replace: ed.replaceStr,
    options: { ...ed.searchOpts },
    promptOnReplace: ed.promptOnReplace,
    replaceAll: ed.replaceAllFlag,
  };
  const res = await ed.dialog({ kind: 'replace', rec });
  if (res.kind === 'replace' && res.rec !== null) {
    ed.findStr = res.rec.find;
    ed.replaceStr = res.rec.replace;
    ed.searchOpts = { ...res.rec.options };
    ed.promptOnReplace = res.rec.promptOnReplace;
    ed.replaceAllFlag = res.rec.replaceAll;
    ed.doReplace = true;
    return editorDoSearchReplace(ed);
  }
  return 0;
}

/** One search step — scan from the caret, whole-words retry, select the match. */
export function editorSearchOnce(ed: Editor): boolean {
  let pos = ed.curPtr;
  for (;;) {
    const i = scan(ed.buf, pos, ed.findStr, ed.searchOpts);
    if (i === -1) return false;
    const len = ed.findStr.length;
    if (
      !ed.searchOpts.wholeWords ||
      !(
        (i !== 0 && isWordChar(ed.buf.charAt(i - 1))) ||
        (i + len !== ed.buf.length && isWordChar(ed.buf.charAt(i + len)))
      )
    ) {
      ed.setSelect(i, i + len, false); // select the match, caret landing at its end
      ed.trackCursor(!ed.isCursorVisible());
      return true;
    }
    pos = i + 1;
  }
}

/** The search/replace loop; returns the number of replacements made. */
export async function editorDoSearchReplace(ed: Editor): Promise<number> {
  if (ed.findStr === '') return 0;
  let count = 0;
  let verdict: 'yes' | 'no' | 'cancel';
  do {
    verdict = 'cancel';
    if (!editorSearchOnce(ed)) {
      if (!(ed.replaceAllFlag && ed.doReplace)) await ed.dialog({ kind: 'searchFailed' });
    } else if (ed.doReplace) {
      verdict = 'yes';
      if (ed.promptOnReplace) {
        const res = await ed.dialog({ kind: 'replacePrompt', cursor: globalCaret(ed) });
        verdict = res.kind === 'confirm' ? res.answer : 'cancel';
      }
      if (verdict === 'yes') {
        ed.insertRaw(convertNewEdit(ed.replaceStr, ed.eolKind), false);
        ed.trackCursor(false);
        count++;
      }
    }
  } while (verdict !== 'cancel' && ed.replaceAllFlag);
  return count;
}

/** The caret's position in absolute (screen-wide) coordinates. */
export function globalCaret(ed: Editor): Point {
  let x = ed.bounds.x + (ed.curX - ed.delta.x());
  let y = ed.bounds.y + (ed.curY - ed.delta.y());
  let p = ed.parent;
  while (p !== null) {
    x += p.bounds.x;
    y += p.bounds.y;
    p = p.parent;
  }
  return { x, y };
}
