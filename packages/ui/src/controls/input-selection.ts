/**
 * Pure selection math for {@link Input} (RD-07), extracted so `input.ts` stays under the 500-line
 * cap (AC-13). Faithful to Turbo Vision `TInputLine` (`tinputli.cpp`): space-delimited word nav
 * (`:64-82`, PA-12), the `adjustSelectBlock` range derivation (`:225-237`), and the `mousePos`
 * column→index map (`:186-196`). Code-point unit (PA-1). No `View`/reactive dependency — plain
 * functions over strings/indices. The `.js` extension is required by NodeNext ESM resolution.
 */

/** A half-open selection range `[start, end)` as JS string indices (`start ≤ end`). */
export interface SelectionRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The index of the first non-space that follows a space, scanning left from `pos` (TV `prevWord`,
 * `tinputli.cpp:64-72`, space-delimited PA-12). Returns 0 when none.
 *
 * @param s   The value string.
 * @param pos The caret index to scan left from.
 * @returns The previous word-start index, or 0.
 */
export function prevWord(s: string, pos: number): number {
  for (let i = pos - 1; i >= 1; i -= 1) {
    if (s[i] !== ' ' && s[i - 1] === ' ') return i;
  }
  return 0;
}

/**
 * The index of the first non-space that follows a space, scanning right from `pos` (TV `nextWord`,
 * `tinputli.cpp:74-82`, space-delimited PA-12). Returns `s.length` when none.
 *
 * @param s   The value string.
 * @param pos The caret index to scan right from.
 * @returns The next word-start index, or `s.length`.
 */
export function nextWord(s: string, pos: number): number {
  for (let i = pos; i < s.length - 1; i += 1) {
    if (s[i] === ' ' && s[i + 1] !== ' ') return i + 1;
  }
  return s.length;
}

/**
 * Derive the ordered selection range from the caret + anchor (TV `adjustSelectBlock`, `:225-237`):
 * the lower of the two is `start`, the higher is `end`.
 *
 * @param curPos The moved caret.
 * @param anchor The fixed selection end.
 * @returns The `{ start, end }` range.
 */
export function selectionBlock(curPos: number, anchor: number): SelectionRange {
  return curPos < anchor ? { start: curPos, end: anchor } : { start: anchor, end: curPos };
}

/**
 * Map a local mouse column to a value index (TV `mousePos`, `:186-196`; code-unit v1). Column 0 is
 * the left-arrow gutter, so the column is clamped to ≥1 before the map, and the result is clamped to
 * the value bounds.
 *
 * @param localX   The view-local mouse column.
 * @param firstPos The current horizontal scroll offset.
 * @param length   The value length (upper clamp).
 * @returns The value index under the mouse.
 */
export function mousePos(localX: number, firstPos: number, length: number): number {
  const pos = Math.max(localX, 1) + firstPos - 1;
  return Math.max(0, Math.min(length, pos));
}
