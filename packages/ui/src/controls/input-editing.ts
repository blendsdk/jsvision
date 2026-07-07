/**
 * Deletion helpers for {@link Input}: word-boundary scans plus a pure `computeDelete` that turns a
 * delete gesture (backspace, forward-delete, delete-word, delete-selection) into the resulting edit
 * state. Words are space-delimited. Pure functions over strings — the caller re-validates and
 * commits the result.
 */

/**
 * The start of the word to the left of `pos`: scanning left, the first non-space immediately
 * preceded by a space; `0` when none. Used by `Ctrl`/`Alt`+`Backspace` to delete the word to the
 * caret's left.
 *
 * @param s   The value.
 * @param pos The caret index.
 * @returns The start index of the word to delete back to.
 */
export function prevWord(s: string, pos: number): number {
  for (let i = pos - 1; i >= 1; i -= 1) {
    if (s[i] !== ' ' && s[i - 1] === ' ') return i;
  }
  return 0;
}

/**
 * The start of the word to the right of `pos`: scanning right, the first index after a
 * space-then-non-space transition; the string length when none. Used by `Ctrl`+`Delete` to delete
 * the word to the caret's right.
 *
 * @param s   The value.
 * @param pos The caret index.
 * @returns The end index of the word to delete forward to.
 */
export function nextWord(s: string, pos: number): number {
  for (let i = pos; i < s.length - 1; i += 1) {
    if (s[i] === ' ' && s[i + 1] !== ' ') return i + 1;
  }
  return s.length;
}

/** The editable state a deletion transforms (string indices; `selStart ≤ selEnd`). */
export interface EditState {
  readonly value: string;
  readonly curPos: number;
  readonly selStart: number;
  readonly selEnd: number;
}

/** The delete gestures a text field recognizes; `selection` deletes the current selection range. */
export type DeleteKind = 'backspace' | 'forward' | 'wordLeft' | 'wordRight' | 'selection';

/** Remove `[selStart, selEnd)` when non-empty and put the caret at `selStart`. */
function deleteRange(s: EditState): EditState {
  if (s.selStart >= s.selEnd) return s;
  const value = s.value.slice(0, s.selStart) + s.value.slice(s.selEnd);
  return { value, curPos: s.selStart, selStart: s.selStart, selEnd: s.selStart };
}

/**
 * Compute the state after a delete gesture. If there is a selection, every gesture just removes it;
 * otherwise the gesture selects its own target (one character, or a word via {@link prevWord} /
 * {@link nextWord}) and removes that. Pure — the caller re-validates and commits.
 *
 * @param s    The current edit state.
 * @param kind The delete gesture.
 * @returns The resulting edit state (value + caret + collapsed selection).
 */
export function computeDelete(s: EditState, kind: DeleteKind): EditState {
  if (s.selStart !== s.selEnd) return deleteRange(s); // any kind deletes an existing selection
  let selStart = s.curPos;
  let selEnd = s.curPos;
  switch (kind) {
    case 'backspace':
      selStart = Math.max(0, s.curPos - 1);
      break;
    case 'forward':
      selEnd = s.curPos < s.value.length ? s.curPos + 1 : s.curPos;
      break;
    case 'wordLeft':
      selStart = prevWord(s.value, s.curPos);
      break;
    case 'wordRight':
      selEnd = nextWord(s.value, s.curPos);
      break;
    case 'selection':
      break; // no selection present ⇒ nothing to delete
  }
  return deleteRange({ ...s, selStart, selEnd });
}
