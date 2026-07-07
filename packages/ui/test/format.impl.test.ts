/**
 * Implementation tests — RD-08 Phase-3 `formatLine` edge cases (after green).
 *
 * Boundary tabs, degenerate widths, whole-row selection, straddling wide glyphs at the right
 * edge, zero-width combining folds, and the control-char one-column rule.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { GapBuffer } from '../src/editor/buffer/index.js';
import { formatLine } from '../src/editor/format.js';

function row(cells: readonly { ch: string }[]): string {
  return cells.map((c) => c.ch).join('');
}

test('a tab at col 7 fills exactly one column; back-to-back tabs stack 8-col stops', () => {
  const b = new GapBuffer('abcdefg\tX'); // tab enters at col 7 → stop at 8
  const cells = formatLine(b, 0, 0, 10, null);
  expect(cells[7].ch).toBe(' ');
  expect(cells[8].ch).toBe('X');

  const t = new GapBuffer('\t\tY'); // two leading tabs → cols 0..7, 8..15
  const cells2 = formatLine(t, 0, 0, 18, null);
  expect(cells2.slice(0, 16).every((c) => c.ch === ' ')).toBe(true);
  expect(cells2[16].ch).toBe('Y');
});

test('hScroll past the line end renders pure padding; width 0 renders nothing', () => {
  const b = new GapBuffer('ab');
  const padded = formatLine(b, 0, 10, 5, null);
  expect(padded).toHaveLength(5);
  expect(padded.every((c) => c.ch === ' ')).toBe(true);
  expect(formatLine(b, 0, 0, 0, null)).toHaveLength(0);
});

test('a selection covering the whole line marks every cell including padding', () => {
  const b = new GapBuffer('abc');
  const cells = formatLine(b, 0, 0, 6, { start: 0, end: 99 });
  expect(cells.every((c) => c.selected)).toBe(true);
});

test('a wide glyph at the right edge is still emitted (the pre-draw break draws it; buffer clips)', () => {
  const b = new GapBuffer('abc漢'); // 漢 enters at col 3 of width 4 → straddles
  const cells = formatLine(b, 0, 0, 4, null);
  expect(row(cells)).toBe('abc漢'); // emitted; DrawContext/ScreenBuffer clip the overhang
  expect(cells[3].width).toBe(2);
});

test('a combining mark folds into its base cell; a LONE combining mark is a width-1 cell', () => {
  const b = new GapBuffer('éx'); // e + combining acute = one cluster
  const cells = formatLine(b, 0, 0, 4, null);
  expect(cells[0].ch).toBe('é');
  expect(cells[0].width).toBe(1);
  expect(cells[1].ch).toBe('x');

  const lone = new GapBuffer('́z'); // combining mark with no base — degenerate
  const cells2 = formatLine(lone, 0, 0, 4, null);
  expect(cells2[0].width).toBe(1); // the ScreenBuffer degenerate rule
});

test('every C0 control occupies exactly one column (agrees with write-time sanitize)', () => {
  const b = new GapBuffer('a\u0001\u0002b');
  const cells = formatLine(b, 0, 0, 6, null);
  expect(cells).toHaveLength(6); // a, C0, C0, b + 2 pad — one column each
  expect(cells[3].ch).toBe('b');
});

test('formatting a mid-buffer line ignores other lines entirely', () => {
  const b = new GapBuffer('first\nsecond\nthird');
  const cells = formatLine(b, 6, 0, 8, null);
  expect(row(cells).trimEnd()).toBe('second');
});
