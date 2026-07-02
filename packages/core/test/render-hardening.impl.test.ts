/**
 * Implementation tests — render/output hardening (RD-13, HR-05).
 *
 * Edge coverage beyond ST-2.2: multiple consecutive controls, DEL, and controls mixed with a wide
 * glyph all keep one-char-one-cell column math. (HR-17 combining-mark ordering lands in Phase 5.)
 */
import { test, expect } from 'vitest';

import { ScreenBuffer } from '../src/engine/render/buffer.js';
import type { Style } from '../src/engine/render/types.js';

const STYLE: Style = { fg: 'default', bg: 'default' };

function rowChars(buf: ScreenBuffer, y: number, n: number): string {
  let out = '';
  for (let x = 0; x < n; x += 1) out += buf.get(x, y)?.char ?? '';
  return out;
}

test('consecutive tabs each become one space cell', () => {
  const buf = new ScreenBuffer(8, 1, STYLE);
  const end = buf.text(0, 0, 'a\t\tb', STYLE);
  expect(rowChars(buf, 0, 4)).toBe('a  b');
  expect(end).toBe(4);
});

test('DEL (0x7f) becomes a space cell', () => {
  const buf = new ScreenBuffer(4, 1, STYLE);
  buf.text(0, 0, 'a\x7fb', STYLE);
  expect(rowChars(buf, 0, 3)).toBe('a b');
});

test('a control between wide glyphs keeps column math', () => {
  const buf = new ScreenBuffer(8, 1, STYLE);
  // 世 (wide, 2 cols) + tab (1 space) + 界 (wide, 2 cols) → cols: [世][cont][ ][界][cont]
  const end = buf.text(0, 0, '世\t界', STYLE);
  expect(buf.get(0, 0)?.width).toBe(2); // wide lead
  expect(buf.get(1, 0)?.width).toBe(0); // continuation
  expect(buf.get(2, 0)?.char).toBe(' '); // tab → space
  expect(buf.get(3, 0)?.width).toBe(2); // second wide lead
  expect(end).toBe(5); // 2 + 1 + 2
});
