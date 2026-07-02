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

// ---------------------------------------------------------------------------
// Phase-5 impl edges: HR-05×HR-17 ordering, mixed wide/fallback serialize, box fit (HR-17/18/25)
// ---------------------------------------------------------------------------
import { serialize } from '../src/engine/render/serialize.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';

const implNoUtf8 = resolveCapabilities({ env: {}, platform: 'linux', override: { unicode: { utf8: false } } }).profile;

// HR-05 × HR-17 ordering: a control is replaced by a space FIRST, so a following combining mark
// composes onto that space (a valid base) rather than attaching to a raw control byte.
test('a combining mark after a control composes onto the replacement space', () => {
  const buf = new ScreenBuffer(4, 1, STYLE);
  buf.text(0, 0, '\t́x', STYLE); // TAB (→ space) + combining acute + x
  expect(buf.get(0, 0)?.char).toBe(' ́'); // the space cell carries the mark
  expect(buf.get(0, 0)?.width).toBe(1);
  expect(buf.get(1, 0)?.char).toBe('x');
});

// HR-18: a row mixing an ASCII run and a fallen-back wide glyph keeps column count under utf8:false.
test('a mixed ASCII + wide-fallback row serializes without column drift', () => {
  const buf = new ScreenBuffer(6, 1, STYLE);
  buf.text(0, 0, 'a世b', STYLE); // a (col0) + 世 (col1-2) + b (col3)
  const out = serialize(buf, null, { caps: implNoUtf8 });
  expect(out).toContain('a? b'); // 世 → '? '; b stays at its column
});

// HR-25: an exact-fit title (interior width) is not clipped; a border stays intact.
test('a box title exactly filling the interior is not clipped', () => {
  const buf = new ScreenBuffer(7, 3, STYLE);
  buf.box(0, 0, 7, 3, STYLE, 'single', 'abc'); // " abc " = 5 cols = interior (7-2)
  expect(rowChars(buf, 0, 7)).toBe('┌ abc ┐'); // fills the interior exactly, corners intact
});
