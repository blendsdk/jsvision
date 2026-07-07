/**
 * Pure buffer navigation over a {@link BufText}: line starts/ends, cursor and word/line hops, and
 * visual-column conversion. All hops are grapheme-cluster aware, so the caret never lands inside a
 * multi-unit character, a `\r\n` pair, or a wide glyph.
 *
 * Notable rules a caller relies on:
 *   • `\r\n` steps as one unit; a grapheme cluster (emoji, base + combining marks) steps as one.
 *   • Word hops classify each character as whitespace, line break, punctuation, or word, and stop
 *     at the boundary between two classes. (This is a deliberately different notion of "word" from
 *     the single-line `Input` control's — do not assume they match.)
 *   • Tabs advance to the next 8-column stop when computing visual columns.
 *   • `lineMove` preserves the origin's visual column: a multi-line move passes through shorter
 *     intermediate lines without clamping, and only the final line clamps to its end.
 *   • `charPtr` never lands inside a tab or wide glyph — an overshoot returns the previous position.
 *
 * Every function clamps its position into `[0, length]` and never throws on hostile input.
 */
import { stringWidth } from '../../controls/measure.js';
import { nextClusterEnd, prevClusterStart } from './segment.js';
import type { BufText } from './gap.js';

/** Clamp a (possibly hostile) position into `[0, len]`. */
function clampPos(p: number, len: number): number {
  const t = Math.trunc(p);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.min(t, len));
}

/** Start of the line containing `p` — the position just after the previous line break, or `0`. */
export function lineStart(b: BufText, p: number): number {
  let i = clampPos(p, b.length);
  while (i--) {
    const c = b.charAt(i);
    if (c === '\r') {
      if (b.charAt(i + 1) === '\n') return i + 2;
      return i + 1;
    }
    if (c === '\n') return i + 1;
  }
  return 0;
}

/** End of the line containing `p` — the first `\r`/`\n` at or after `p`, else `length`. */
export function lineEnd(b: BufText, p: number): number {
  const len = b.length;
  for (let i = clampPos(p, len); i < len; i++) {
    const c = b.charAt(i);
    if (c === '\r' || c === '\n') return i;
  }
  return len;
}

/** One step forward — a `\r\n` pair and a grapheme cluster each count as a single step. */
export function nextChar(b: BufText, p: number): number {
  const len = b.length;
  const q = clampPos(p, len);
  if (q >= len) return len;
  const c = b.charAt(q);
  if (c === '\r' && b.charAt(q + 1) === '\n') return q + 2;
  if (c === '\r' || c === '\n') return q + 1;
  const ls = lineStart(b, q);
  const text = b.slice(ls, lineEnd(b, q));
  return ls + nextClusterEnd(text, q - ls);
}

/** One step back — a `\r\n` pair and a grapheme cluster each count as a single step. */
export function prevChar(b: BufText, p: number): number {
  const q = clampPos(p, b.length);
  if (q <= 1) return 0;
  if (b.charAt(q - 2) === '\r' && b.charAt(q - 1) === '\n') return q - 2;
  const before = b.charAt(q - 1);
  if (before === '\r' || before === '\n') return q - 1;
  const ls = lineStart(b, q - 1);
  const text = b.slice(ls, lineEnd(b, q - 1));
  return ls + prevClusterStart(text, q - ls);
}

/** Start of the next line after `p` (the position past the current line's break). */
export function nextLine(b: BufText, p: number): number {
  return nextChar(b, lineEnd(b, p));
}

/** Start of the line before the one containing `p`. */
export function prevLine(b: BufText, p: number): number {
  return lineStart(b, prevChar(b, p));
}

/**
 * Classify a character for word hops: 0 = whitespace (or the empty string returned out of range),
 * 1 = line break, 2 = ASCII punctuation, 3 = word character.
 */
function getCharType(ch: string): number {
  if (ch === '\t' || ch === ' ' || ch === '') return 0;
  if (ch === '\n' || ch === '\r') return 1;
  if ('!"#$%&\'()*+,-./:;<=>?@[\\]^`{|}~'.includes(ch)) return 2;
  return 3;
}

/** A word boundary sits between two characters of different class. */
function isWordBoundary(a: string, bch: string): boolean {
  return getCharType(a) !== getCharType(bch);
}

/** Hop forward to the next character-class boundary (the start of the next word or run). */
export function nextWord(b: BufText, p: number): number {
  const len = b.length;
  let q = clampPos(p, len);
  if (q < len) {
    let a = b.charAt(q);
    let last: string;
    do {
      last = a;
      q = nextChar(b, q);
      if (q >= len) break;
      a = b.charAt(q);
    } while (!isWordBoundary(a, last));
  }
  return q;
}

/** Hop back to the previous character-class boundary (the start of the current or previous word). */
export function prevWord(b: BufText, p: number): number {
  let q = clampPos(p, b.length);
  if (q > 0) {
    q = prevChar(b, q);
    if (q > 0) {
      let a = b.charAt(q);
      let last: string;
      do {
        last = a;
        q = prevChar(b, q);
        a = b.charAt(q);
      } while (q > 0 && !isWordBoundary(a, last));
      if (isWordBoundary(a, last)) q = nextChar(b, q);
    }
  }
  return q;
}

/**
 * One in-line step for the visual-column walkers: a tab advances one code unit to the next
 * 8-column stop `(pos|7)+1`; any other cluster advances by its display width.
 */
function stepInLine(text: string, i: number, pos: number): { i: number; pos: number } {
  if (text[i] === '\t') return { i: i + 1, pos: (pos | 7) + 1 };
  const end = nextClusterEnd(text, i);
  return { i: end, pos: pos + stringWidth(text.slice(i, end)) };
}

/**
 * Position → visual column: sum the display widths from `lineStartP` up to `target`. A `target`
 * past the line end clamps to the end (hostile-input-safe).
 */
export function charPos(b: BufText, lineStartP: number, target: number): number {
  const len = b.length;
  const ls = clampPos(lineStartP, len);
  const t = clampPos(target, len);
  const text = b.slice(ls, lineEnd(b, ls));
  let i = 0;
  let pos = 0;
  while (ls + i < t && i < text.length) {
    ({ i, pos } = stepInLine(text, i, pos));
  }
  return pos;
}

/**
 * Visual column → position: walk from `lineStartP` until reaching column `target`, stopping at the
 * line break. An overshoot (the column falls inside a tab or wide glyph) returns the previous
 * position, so the result never splits a cell.
 */
export function charPtr(b: BufText, lineStartP: number, target: number): number {
  const len = b.length;
  const ls = clampPos(lineStartP, len);
  const text = b.slice(ls, lineEnd(b, ls));
  let i = 0;
  let prevI = 0;
  let pos = 0;
  while (i < text.length && pos < target) {
    prevI = i;
    ({ i, pos } = stepInLine(text, i, pos));
  }
  if (pos > target) i = prevI;
  return ls + i;
}

/**
 * Move `count` lines from `p` (negative = up), preserving the origin's visual column: the column is
 * computed once from `p`, carried through intermediate lines unclamped, and converted back on the
 * final line — clamping at a shorter line's end.
 */
export function lineMove(b: BufText, p: number, count: number): number {
  let q = clampPos(p, b.length);
  let i = q;
  q = lineStart(b, q);
  const pos = charPos(b, q, i);
  let n = Math.trunc(count) || 0;
  while (n !== 0) {
    i = q;
    if (n < 0) {
      q = prevLine(b, q);
      n++;
    } else {
      q = nextLine(b, q);
      n--;
    }
  }
  if (q !== i) q = charPtr(b, q, pos);
  return q;
}
