/**
 * Word-boundary helpers for {@link Input} (RD-13 HR-48), extracted so `input.ts` stays under the
 * 500-line cap (AC-9). Faithful to Turbo Vision `TInputLine`'s file-static `prevWord`/`nextWord`
 * (`tinputli.cpp:64-82`) — space-delimited word runs. Pure functions over strings. The `.js`
 * extension is required by NodeNext ESM resolution.
 */

/**
 * The previous word boundary from `pos` (TV `prevWord`, `tinputli.cpp:64-72`): scan left from
 * `pos-1` to index 1, returning the first non-space code point immediately preceded by a space; `0`
 * when none. Used by Ctrl/Alt+Backspace to delete the word to the caret's left.
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
 * The next word boundary from `pos` (TV `nextWord`, `tinputli.cpp:74-82`): scan right from `pos`,
 * returning the first index after a space→non-space transition; the string length when none. Used by
 * Ctrl+Delete to delete the word to the caret's right.
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

/** The editable state a deletion transforms (JS string indices; `selStart ≤ selEnd`). */
export interface EditState {
  readonly value: string;
  readonly curPos: number;
  readonly selStart: number;
  readonly selEnd: number;
}

/** The delete gestures TV recognizes (`tinputli.cpp:380-414`); `selection` deletes the current range. */
export type DeleteKind = 'backspace' | 'forward' | 'wordLeft' | 'wordRight' | 'selection';

/** Remove `[selStart, selEnd)` when non-empty; caret → `selStart` (TV `deleteSelect`, `:203-211`). */
function deleteRange(s: EditState): EditState {
  if (s.selStart >= s.selEnd) return s;
  const value = s.value.slice(0, s.selStart) + s.value.slice(s.selEnd);
  return { value, curPos: s.selStart, selStart: s.selStart, selEnd: s.selStart };
}

/**
 * Compute the post-delete state for a delete gesture (TV `:380-414`). An existing selection is
 * removed for every kind; otherwise the gesture selects its target range (one code point, or a word
 * via {@link prevWord}/{@link nextWord}) and removes it. Pure — the caller re-validates + commits.
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
