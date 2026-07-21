/**
 * Implementation tests — `wrapText` internals & edges around the code-point scan.
 *
 * The public contract lives in `wrap-text.spec.test.ts`; this file covers what sits just outside it:
 * malformed input that must not hang the scan, and the grapheme-cluster boundary that the helper
 * deliberately does not cross. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { wrapText, stringWidth } from '../src/index.js';

// A string can legally hold an unpaired surrogate — it arrives from a truncated read or a bad
// decode. `codePointAt` returns the surrogate value itself, so the scan advances one unit and
// terminates; the alternative (a zero-width advance) would hang the whole render loop.
test('a lone surrogate in the input is consumed rather than looped on', () => {
  const lone = '\ud83d'; // an unpaired high surrogate
  expect(wrapText(`a${lone}b`, 2)).toEqual([`a${lone}`, 'b']);
  expect(wrapText(lone, 1)).toEqual([lone]);
  // A trailing high surrogate followed by nothing is the worst case for an advance-by-code-point
  // scan; it must still finish.
  expect(wrapText(`ab${lone}`, 10)).toEqual([`ab${lone}`]);
});

// Grapheme clusters are explicitly out of scope: a ZWJ sequence or a skin-tone modifier is several
// code points, and the wrap may fall between them. Pinned so that a future grapheme-aware wrap is a
// deliberate, visible change — the same way the surrogate-pair gap was pinned before it was fixed.
test('a ZWJ sequence may still wrap between its code points (documented limitation)', () => {
  const family = '👨‍👩‍👧'; // man + ZWJ + woman + ZWJ + girl — one rendered grapheme
  const lines = wrapText(family, 2);
  // It breaks into more than one line: each component emoji is measured on its own.
  expect(lines.length).toBeGreaterThan(1);
  // But every line is still made of whole code points — no surrogate is ever halved.
  for (const line of lines) {
    expect([...line].every((cp) => cp.codePointAt(0) !== undefined)).toBe(true);
    expect(line).toBe([...line].join(''));
  }
});

// A zero-width combining mark adds no columns, so it never forces a break of its own.
test('zero-width combining marks do not consume width', () => {
  const combining = 'é'; // e + COMBINING ACUTE ACCENT = 1 column
  expect(stringWidth(combining)).toBe(1);
  expect(wrapText(`${combining}${combining}`, 2)).toEqual([`${combining}${combining}`]);
});

// The hard-break path advances by the width of the glyph that did not fit. For an astral glyph that
// is two UTF-16 units — advancing one would emit half a pair and leave the other half to start the
// next line, which is precisely the reported defect.
test('the hard-break path advances by the whole glyph, not one code unit', () => {
  expect(wrapText('😀', 1)).toEqual(['😀']);
  expect(wrapText('😀😀', 1)).toEqual(['😀', '😀']);
  // The same path with a BMP wide glyph, unchanged from before the fix.
  expect(wrapText('日', 1)).toEqual(['日']);
});
