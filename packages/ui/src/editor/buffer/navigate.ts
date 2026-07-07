/**
 * Pure buffer navigation — faithful transcriptions of the TV editor core over `BufText`, with
 * TV's double-byte awareness generalized to grapheme clusters (RD-08 AR-251).
 *
 * Decode sources (GATE-1, re-verified 2026-07-07 vs magiblot/tvision @ 57b6f56):
 *   • `lineStart`/`lineEnd` — `edits.cpp:94-125` (CRLF-aware backward/forward scans).
 *   • `nextChar`/`prevChar` — `edits.cpp:127-159` (`\r\n` steps as ONE unit; the multibyte
 *     `TText::next`/`prev` becomes an `Intl.Segmenter` cluster step on the LINE slice, PF-007).
 *   • Word hops — `getCharType` (`teditor2.cpp:45-54`: whitespace/NUL=0, break=1, punctuation=2,
 *     word=3) + `isWordBoundary` (`:56-59`) drive `nextWord` (`:318-330`) / `prevWord`
 *     (`:337-352`). This is a DISTINCT decode from Input's `tinputli.cpp` hops — do not merge
 *     (PF-014); the separately-named TV `isWordChar` (`:61-64`) belongs to search (03-03).
 *   • `nextLine`/`prevLine` — `teditor2.cpp:313-316,332-335`.
 *   • `lineMove` — `teditor2.cpp:270-292` (the visual column is computed ONCE from the origin, so
 *     one multi-line move passes through shorter lines unclamped; only the final line clamps).
 *   • Visual columns — `charPos`/`charPtr` (`teditor1.cpp:270-294`) over the `nextCharAndPos`
 *     step (`teditor1.cpp:240-268`): tab → `pos = (pos|7)+1` (8-column stops); otherwise the
 *     cluster's display width (core `wcwidth` via the shared measure helpers). `charPtr` never
 *     lands inside a tab/wide glyph — an overshoot returns the previous position (decode).
 *
 * Every function clamps its position into `[0, length]` and never throws (RD §Security, HR-01).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
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

/**
 * Start of the line containing `p` — the backward CRLF-aware scan (`edits.cpp:105-125`).
 * (TV's raw-buffer guard `i+1 != curPtr && i+1 != bufLen` protects a physical `bufChar` read
 * across the gap; our logical bounds-checked `charAt` needs no equivalent.)
 */
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

/** End of the line containing `p` — the first `\r`/`\n` at/after `p`, else `length` (`edits.cpp:94-103`). */
export function lineEnd(b: BufText, p: number): number {
  const len = b.length;
  for (let i = clampPos(p, len); i < len; i++) {
    const c = b.charAt(i);
    if (c === '\r' || c === '\n') return i;
  }
  return len;
}

/** One step forward — `\r\n` and grapheme clusters are atomic (`edits.cpp:127-143` + AR-251). */
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

/** One step back — `\r\n` and grapheme clusters are atomic (`edits.cpp:145-159` + AR-251). */
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

/** Start of the next line — `nextChar(lineEnd(p))` (`teditor2.cpp:313-316`). */
export function nextLine(b: BufText, p: number): number {
  return nextChar(b, lineEnd(b, p));
}

/** Start of the previous line — `lineStart(prevChar(p))` (`teditor2.cpp:332-335`). */
export function prevLine(b: BufText, p: number): number {
  return lineStart(b, prevChar(b, p));
}

/**
 * TV's editor char classes (`getCharType`, `teditor2.cpp:45-54`): 0 = whitespace/NUL (our
 * out-of-range `''` maps to TV's `\0`), 1 = line break, 2 = ASCII punctuation, 3 = word.
 */
function getCharType(ch: string): number {
  if (ch === '\t' || ch === ' ' || ch === '') return 0;
  if (ch === '\n' || ch === '\r') return 1;
  if ('!"#$%&\'()*+,-./:;<=>?@[\\]^`{|}~'.includes(ch)) return 2;
  return 3;
}

/** A word boundary sits between two units of different char class (`teditor2.cpp:56-59`). */
function isWordBoundary(a: string, bch: string): boolean {
  return getCharType(a) !== getCharType(bch);
}

/** Hop forward to the next char-class boundary (`TEditor::nextWord`, `teditor2.cpp:318-330`). */
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

/** Hop back to the previous char-class boundary (`TEditor::prevWord`, `teditor2.cpp:337-352`). */
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
 * One in-line step for the visual-column walkers — the `nextCharAndPos` decode
 * (`teditor1.cpp:240-268`): tab advances one unit to the next 8-column stop `(pos|7)+1`; any
 * other cluster advances by its display width.
 */
function stepInLine(text: string, i: number, pos: number): { i: number; pos: number } {
  if (text[i] === '\t') return { i: i + 1, pos: (pos | 7) + 1 };
  const end = nextClusterEnd(text, i);
  return { i: end, pos: pos + stringWidth(text.slice(i, end)) };
}

/**
 * Position → visual column: the width-summed walk from `lineStartP` up to `target`
 * (`TEditor::charPos`, `teditor1.cpp:270-277`), line-bounded (a `target` past the line end
 * clamps to it — hostile-input-safe).
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
 * Visual column → position: walk until `target`, stopping at the line break; an overshoot
 * (inside a tab/wide glyph) returns the PREVIOUS position (`TEditor::charPtr`,
 * `teditor1.cpp:279-294` — never splits a cell).
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
 * Move `count` lines from `p`, preserving the ORIGIN's visual column (`TEditor::lineMove`,
 * `teditor2.cpp:270-292`): the column is computed once from `p`, carried through intermediate
 * lines unclamped, and converted back on the final line — clamping at a shorter line's EOL.
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
