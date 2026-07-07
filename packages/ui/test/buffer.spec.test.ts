/**
 * Specification tests (immutable oracles) — RD-08 Phase-2 buffer core (ST-1…ST-4).
 *
 * Source: RD-08 AC-1/AC-4/AC-16 + RD §Security (HR-01) → ST-1…ST-4
 * (codeops/features/jsvision-ui/plans/editor-family/07-testing-strategy.md; decodes in
 * 03-01-buffer-core.md). The navigation semantics are faithful transcriptions of the TV editor
 * core — `lineStart`/`lineEnd`/`nextChar`/`prevChar` (`edits.cpp:94-159`), the word-hop char
 * classes `getCharType`/`isWordBoundary` (`teditor2.cpp:45-59`), `nextWord`/`prevWord`
 * (`teditor2.cpp:318-330,337-352`), `lineMove` (`teditor2.cpp:270-292`), and the visual-column
 * math `charPos`/`charPtr` with the `(pos|7)+1` tab stop (`teditor1.cpp:255,270-294`) — with TV's
 * double-byte awareness generalized to grapheme clusters (AR-251). Positions are UTF-16 code-unit
 * offsets. Expectations derive from RD-08 + the recorded decodes, never the implementation.
 *
 * Trace: RD-08 03-01 · AR-250/AR-251 · PF-007 (BufText.slice) · ST-1…ST-4.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  GapBuffer,
  lineStart,
  lineEnd,
  nextChar,
  prevChar,
  nextLine,
  prevLine,
  nextWord,
  prevWord,
  charPos,
  charPtr,
  lineMove,
} from '../src/editor/buffer/index.js';

// ST-1 / AC-1 — line scans, CRLF atomicity, tab columns, lineMove clamp + column preservation.
test('ST-1: lineStart/lineEnd around a position, LF and CRLF', () => {
  const b = new GapBuffer('ab\ncd');
  expect(lineStart(b, 2)).toBe(0); // p after 'b'
  expect(lineEnd(b, 2)).toBe(2); // the '\n'

  const c = new GapBuffer('ab\r\ncd');
  expect(lineEnd(c, 0)).toBe(2); // stops at the '\r'
  expect(lineStart(c, 5)).toBe(4); // second line starts after the CRLF pair
});

test('ST-1: a CRLF pair traverses as ONE unit in both directions', () => {
  const c = new GapBuffer('ab\r\ncd');
  expect(nextChar(c, 2)).toBe(4); // step over \r\n
  expect(prevChar(c, 4)).toBe(2);
  expect(nextLine(c, 0)).toBe(4);
  // prevLine is lineStart(prevChar(p)) (teditor2.cpp:332-335): from a LINE START it yields the
  // previous line's start (lineMove always passes line starts); from mid-line it yields the
  // CURRENT line's start. (Oracle corrected against the .cpp per the TV-fidelity gate — the
  // original expectation `prevLine(c, 5) === 0` was a mis-decode.)
  expect(prevLine(c, 4)).toBe(0);
  expect(prevLine(c, 5)).toBe(4);
});

test('ST-1: a tab at visual col 3 expands to col 8 — the (pos|7)+1 stop', () => {
  const b = new GapBuffer('abc\td');
  expect(charPos(b, 0, 4)).toBe(8); // after the tab: (3|7)+1
  expect(charPtr(b, 0, 8)).toBe(4); // col 8 → position after the tab
  expect(charPtr(b, 0, 5)).toBe(3); // overshoot inside the tab → the previous position (decode)
});

test('ST-1: lineMove clamps at a short line EOL and preserves the column across it in one call', () => {
  const b = new GapBuffer('abcdef\nxy\nabcdef');
  // From col 5 of line 1 (p=5), one line down lands clamped at "xy"'s EOL (col 2, p=9).
  expect(lineMove(b, 5, 1)).toBe(9);
  // Two lines down IN ONE CALL passes through the short line and restores col 5 (p=15) —
  // the decode computes the visual column once from the origin (teditor2.cpp:270-292).
  expect(lineMove(b, 5, 2)).toBe(15);
  // And back up two from there restores the origin position.
  expect(lineMove(b, 15, -2)).toBe(5);
});

// ST-2 / AC-16 — grapheme clusters: steps land only on cluster starts; delete removes the cluster.
test('ST-2: nextChar/prevChar step whole clusters (emoji, combining mark, wide CJK)', () => {
  const emoji = new GapBuffer('a👍b'); // 👍 = 2 code units
  expect(nextChar(emoji, 0)).toBe(1);
  expect(nextChar(emoji, 1)).toBe(3); // the whole surrogate pair
  expect(nextChar(emoji, 3)).toBe(4);
  expect(prevChar(emoji, 3)).toBe(1);
  expect(prevChar(emoji, 4)).toBe(3);

  const combining = new GapBuffer('éx'); // e + combining acute = one cluster
  expect(nextChar(combining, 0)).toBe(2);
  expect(prevChar(combining, 2)).toBe(0);

  const cjk = new GapBuffer('漢z'); // single-unit wide glyph
  expect(nextChar(cjk, 0)).toBe(1);
  expect(charPos(cjk, 0, 1)).toBe(2); // wide glyph counts 2 visual columns (wcwidth)
});

test('ST-2: backspace-delete bounded by prevChar removes the WHOLE cluster', () => {
  const g = new GapBuffer('a👍b');
  g.remove(prevChar(g, 3), 3); // delete the cluster before p=3
  expect(g.text()).toBe('ab');
});

// ST-3 / AC-4 / PF-014 — word hops per the TV char classes (teditor2.cpp:45-59): whitespace=0,
// break=1, punctuation=2, word=3; a hop stops at every class boundary.
test('ST-3: nextWord/prevWord hop the TV char-class boundaries', () => {
  const b = new GapBuffer('foo  bar(baz)');
  expect(nextWord(b, 0)).toBe(3); // end of "foo" (word → space boundary)
  expect(nextWord(b, 3)).toBe(5); // start of "bar" (space → word)
  expect(nextWord(b, 5)).toBe(8); // end of "bar" (word → punct)
  expect(nextWord(b, 8)).toBe(9); // '(' → 'b' (punct → word)
  expect(prevWord(b, 12)).toBe(9); // back to the start of "baz"
  expect(prevWord(b, 13)).toBe(12); // back to the ')' run
});

// ST-4 / RD §Security (HR-01) — hostile input: lone surrogates and out-of-range positions.
test('ST-4: a lone surrogate is one 1-unit cluster; navigation never throws', () => {
  const b = new GapBuffer('\uD83D'); // unpaired high surrogate
  expect(b.length).toBe(1);
  expect(nextChar(b, 0)).toBe(1);
  expect(prevChar(b, 1)).toBe(0);
});

test('ST-4: positions outside [0, length] clamp — every navigation function is total', () => {
  const b = new GapBuffer('ab\ncd');
  expect(() => {
    lineStart(b, 99);
    lineEnd(b, -7);
    nextChar(b, 99);
    prevChar(b, -1);
    nextWord(b, 1e9);
    prevWord(b, -1e9);
    charPos(b, -3, 99);
    charPtr(b, 99, -5);
    lineMove(b, 99, -99);
  }).not.toThrow();
  expect(lineStart(b, 99)).toBe(3); // clamped to length → last line's start
  expect(nextChar(b, 99)).toBe(5); // clamped to length
  expect(prevChar(b, -1)).toBe(0);
  expect(b.charAt(99)).toBe(''); // bounds-checked accessor (03-01)
});
