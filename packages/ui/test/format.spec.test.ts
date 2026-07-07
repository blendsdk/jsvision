/**
 * Specification tests (immutable oracles) — RD-08 Phase-3 `formatLine` (ST-6/ST-7).
 *
 * Source: RD-08 AC-2/AC-17 + PF-010 → ST-6/ST-7 (codeops/features/jsvision-ui/plans/editor-family/
 * 07-testing-strategy.md; the decode in 03-02-editor-view.md §format.ts). `formatLine` is the
 * faithful TV row renderer (`edits.cpp:38-92` + `getColorAt` `:31-36`): per-position selection
 * split `selStart ≤ P < selEnd`, tabs to 8-column stops, h-scrolled partial tabs/wide glyphs as
 * SPACES (never a split cell), stop at `\r`/`\n`, and EOL padding in the trailing position's
 * colour. Colour byte checks (`0x1E`/`0x71`) are pinned at the ROLE level by editor-theme.spec
 * (ST-32); here `selected` is the role selector. The sanitize half of ST-7 goes through a real
 * core `ScreenBuffer` — the write-time injection boundary. Expectations derive from RD-08 + the
 * decode, never the implementation.
 *
 * Trace: RD-08 03-02 · PA-8 · ST-6/ST-7.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { ScreenBuffer } from '@jsvision/core';
import { GapBuffer } from '../src/editor/buffer/index.js';
import { formatLine } from '../src/editor/format.js';

/** Sum of cell display widths (a formatted row must cover exactly `width` unless it overflows a wide edge glyph). */
function totalWidth(cells: readonly { width: number }[]): number {
  return cells.reduce((w, c) => w + c.width, 0);
}

// ST-6 / AC-2 — the selection split: selStart ≤ P < selEnd → selected, else normal.
test('ST-6: selection [2,5) splits "hello!" into normal/selected/normal + normal padding', () => {
  const b = new GapBuffer('hello!');
  const cells = formatLine(b, 0, 0, 10, { start: 2, end: 5 });
  expect(
    cells
      .map((c) => c.ch)
      .join('')
      .trimEnd(),
  ).toBe('hello!');
  expect(cells.slice(0, 2).map((c) => c.selected)).toEqual([false, false]); // 'he'
  expect(cells.slice(2, 5).map((c) => c.selected)).toEqual([true, true, true]); // 'llo'
  expect(cells.slice(5).every((c) => !c.selected)).toBe(true); // '!' + padding
  expect(totalWidth(cells)).toBe(10); // padded to width
});

// ST-7 / AC-2 — tab expansion: a tab at visual col 3 renders as spaces up to col 8.
test('ST-7: a tab renders as spaces to the next 8-column stop', () => {
  const b = new GapBuffer('abc\tX');
  const cells = formatLine(b, 0, 0, 12, null);
  expect(cells.slice(0, 3).map((c) => c.ch)).toEqual(['a', 'b', 'c']);
  expect(cells.slice(3, 8).map((c) => c.ch)).toEqual([' ', ' ', ' ', ' ', ' ']); // cols 3..7
  expect(cells[8].ch).toBe('X'); // lands at col 8 = (3|7)+1
  expect(totalWidth(cells)).toBe(12);
});

// ST-7 / AC-2 — h-scroll straddle: a wide glyph cut by hScroll renders as spaces, never split.
test('ST-7: a wide glyph straddling the hScroll edge renders as spaces', () => {
  const b = new GapBuffer('ab漢cd'); // 漢 spans visual cols 2-3
  const cells = formatLine(b, 0, 3, 6, null); // hScroll=3 cuts 漢 in half
  expect(cells[0].ch).toBe(' '); // the visible half of 漢 → a space (decode: never a split cell)
  expect(cells[0].width).toBe(1);
  expect(cells[1].ch).toBe('c');
  expect(cells[2].ch).toBe('d');
  expect(totalWidth(cells)).toBe(6);
});

// ST-7 / AC-2 — EOL padding carries the colour of the position AFTER the text (the break's).
test('ST-7: padding after the line break uses the trailing position colour (selection reaches it)', () => {
  const b = new GapBuffer('ab\ncd');
  const cells = formatLine(b, 0, 0, 6, { start: 2, end: 5 }); // the break at P=2 is selected
  expect(cells.slice(0, 2).map((c) => c.selected)).toEqual([false, false]); // 'ab'
  expect(cells.slice(2).every((c) => c.ch === ' ' && c.selected)).toBe(true); // selected padding
  expect(totalWidth(cells)).toBe(6);
});

// ST-7 / AC-17 / PF-010 — hostile bytes: formatted cells written through the core ScreenBuffer
// land inert (write-time sanitize — the canonical injection boundary).
test('ST-7: OSC/C0 bytes in a row are inert once written through ScreenBuffer', () => {
  const b = new GapBuffer('a\u001b]0;x\u0007b\u0001');
  const cells = formatLine(b, 0, 0, 12, null);
  const buf = new ScreenBuffer(12, 1, { fg: '#ffffff', bg: '#000000' });
  let x = 0;
  for (const cell of cells) {
    buf.set(x, 0, cell.ch, { fg: '#ffffff', bg: '#000000' });
    x += cell.width;
  }
  for (let col = 0; col < 12; col++) {
    const ch = buf.get(col, 0)?.char ?? ' ';
    for (const cp of ch) {
      const code = cp.codePointAt(0) ?? 0x20;
      expect(code >= 0x20 && code !== 0x7f, `col ${col} inert`).toBe(true); // no C0/ESC/DEL stored
    }
  }
});
