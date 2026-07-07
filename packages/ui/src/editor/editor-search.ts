/**
 * Search/replace operations over the `Editor` (RD-08 03-03 — the PF-011 split pattern: free
 * functions driving the editor's @internal search state, keeping `editor.ts` ≤ 500).
 *
 * Decode (re-verified 2026-07-07 @ 57b6f56): `TEditor::find` (`teditor1.cpp:476-485`) and
 * `replace` (`teditor2.cpp:364-375`) round-trip their record through the seam, then run
 * `doSearchReplace` (`teditor1.cpp:400-429`): search → optionally prompt (`edReplacePrompt`
 * carries the GLOBAL cursor point, `:415-419`) → replace; `replaceAll` loops until a cancel or a
 * miss; the failure box is suppressed only when BOTH replaceAll and doReplace (`:405-408`). One
 * search step (`TEditor::search`, `teditor2.cpp:389-421`) scans from the caret and applies the
 * whole-words boundary test with the search-side `isWordChar` (`:61-64`), retrying past embedded
 * matches. Replace-all returns its COUNT (the PF-009 documented extension); an empty needle is a
 * no-op WITHOUT a seam round-trip (03-03 §Error Handling).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Point } from '../view/index.js';
import { convertNewEdit } from './buffer/index.js';
import { scan, isWordChar } from './search.js';
import type { FindRec, ReplaceRec } from './editor-dialog.js';
import type { Editor } from './editor.js';

/** `TEditor::find` — seam round-trip → search (`& ~efDoReplace`). */
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

/** `TEditor::replace` — seam round-trip → the replace loop (`| efDoReplace`); returns the count. */
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
      ed.setSelect(i, i + len, false); // the caret lands AFTER the match (curStart=false)
      ed.trackCursor(!ed.isCursorVisible());
      return true;
    }
    pos = i + 1;
  }
}

/** The `doSearchReplace` loop; returns the replacement count (PF-009). */
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

/** The caret as a GLOBAL point (TV `makeGlobal(cursor)` — the replace-prompt request payload). */
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
