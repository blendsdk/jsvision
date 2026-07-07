/**
 * Pure selection math for {@link Input}: classifying caret-motion keys, mapping a motion to a new
 * caret index, finding word boundaries, ordering a selection range, and turning a mouse column into
 * a value index. Plain functions over strings and indices — no view or reactive dependency.
 */

import type { KeyEvent } from '@jsvision/core';

/** A half-open selection range `[start, end)` as string indices (`start ≤ end`). */
export interface SelectionRange {
  readonly start: number;
  readonly end: number;
}

/** A caret motion. `Ctrl+Left`/`Ctrl+Right` move by whole words; the rest by one position/edge. */
export type Motion = 'left' | 'right' | 'wordLeft' | 'wordRight' | 'home' | 'end';

/**
 * Classify a key as a caret motion, or `null` if it is not one. `Ctrl+Left`/`Ctrl+Right` become
 * word motions.
 *
 * @param inner The decoded key event.
 * @returns The motion kind, or `null`.
 */
export function motionOf(inner: KeyEvent): Motion | null {
  switch (inner.key) {
    case 'left':
      return inner.ctrl ? 'wordLeft' : 'left';
    case 'right':
      return inner.ctrl ? 'wordRight' : 'right';
    case 'home':
      return 'home';
    case 'end':
      return 'end';
    default:
      return null;
  }
}

/**
 * The caret index after applying a pad-key motion (no selection side effects — the caller derives
 * the block). Clamped to `[0, v.length]`.
 *
 * @param motion The motion kind.
 * @param curPos The current caret.
 * @param v      The value string.
 * @returns The moved caret index.
 */
export function caretAfterMotion(motion: Motion, curPos: number, v: string): number {
  switch (motion) {
    case 'left':
      return Math.max(0, curPos - 1);
    case 'right':
      return Math.min(v.length, curPos + 1);
    case 'wordLeft':
      return prevWord(v, curPos);
    case 'wordRight':
      return nextWord(v, curPos);
    case 'home':
      return 0;
    case 'end':
      return v.length;
  }
}

/**
 * The start of the word to the left of `pos`: the first non-space that immediately follows a space,
 * scanning left. Returns 0 when there is no earlier word boundary. Words are space-delimited.
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
 * The start of the word to the right of `pos`: the first non-space that follows a space, scanning
 * right. Returns `s.length` when there is no later word boundary. Words are space-delimited.
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
 * Order a selection range from the moving caret and the fixed anchor: the lower of the two is
 * `start`, the higher is `end`.
 *
 * @param curPos The moved caret.
 * @param anchor The fixed selection end.
 * @returns The `{ start, end }` range.
 */
export function selectionBlock(curPos: number, anchor: number): SelectionRange {
  return curPos < anchor ? { start: curPos, end: anchor } : { start: anchor, end: curPos };
}

/**
 * Map a view-local mouse column to a value index. Column 0 is the left-arrow gutter, so the column
 * is clamped to ≥1 before the map, and the result is clamped to the value's bounds.
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
