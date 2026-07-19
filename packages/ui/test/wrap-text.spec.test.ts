/**
 * Specification test (immutable oracle) — the public `wrapText` word-wrap helper.
 *
 * `wrapText` is the wrap a `Text` view draws with, promoted to the package's public surface so a
 * caller can count the lines a message will occupy *before* laying anything out — sizing a dialog
 * tall enough that its message cannot be clipped is the motivating case.
 *
 * Promotion must be behavior-preserving, so the table below re-states the documented contract term
 * by term: lines are verbatim source slices (whitespace between words survives), the wrap breaks
 * after the last whole word that fits, an over-wide word is hard-broken at the boundary, break
 * spaces are dropped from the next line, `\n` always forces a break, a blank source line stays
 * blank, and a non-positive width yields nothing. Widths are display columns, so a wide CJK glyph
 * counts as two.
 *
 * Imports go through the package barrel, which is itself part of what this pins. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { wrapText, stringWidth } from '../src/index.js';

// ST-FE09 — the helper is reachable from the package barrel, beside `stringWidth`.
test('ST-FE09: wrapText is exported from the package barrel', () => {
  expect(typeof wrapText).toBe('function');
  expect(typeof stringWidth).toBe('function');
});

// ST-FE09 — the documented wrap contract, term by term.
const cases: Array<{ what: string; content: string; width: number; lines: string[] }> = [
  { what: 'text that fits stays one line', content: 'hello', width: 10, lines: ['hello'] },
  {
    what: 'breaks after the last whole word that fits',
    content: 'the quick brown fox',
    width: 10,
    lines: ['the quick', 'brown fox'],
  },
  { what: 'drops the break spaces from the next line', content: 'alpha    beta', width: 6, lines: ['alpha', 'beta'] },
  {
    what: 'preserves leading indentation verbatim',
    content: '  indented text',
    width: 12,
    lines: ['  indented', 'text'],
  },
  {
    what: 'hard-breaks a single word wider than the width',
    content: 'supercalifragilistic',
    width: 6,
    lines: ['superc', 'alifra', 'gilist', 'ic'],
  },
  { what: 'an explicit newline always forces a break', content: 'a\nb', width: 40, lines: ['a', 'b'] },
  {
    what: 'a blank source line stays a blank output line',
    content: 'one\n\ntwo',
    width: 10,
    lines: ['one', '', 'two'],
  },
  { what: 'an empty string yields one empty line', content: '', width: 10, lines: [''] },
  { what: 'a zero width yields no lines at all', content: 'anything', width: 0, lines: [] },
  { what: 'a negative width yields no lines at all', content: 'anything', width: -5, lines: [] },
  { what: 'wide glyphs count as two columns', content: '日本語', width: 4, lines: ['日本', '語'] },
];

for (const c of cases) {
  test(`ST-FE09: wrapText ${c.what}`, () => {
    expect(wrapText(c.content, c.width)).toEqual(c.lines);
  });
}

// ST-FE09 — no wrapped line exceeds the requested width, given a width that fits every glyph.
test('ST-FE09: no wrapped line is wider than the requested width', () => {
  const samples = [
    'The file could not be opened because the directory it lives in is not readable.',
    'short',
    'a  b   c    d     e',
    'mixed 日本語 text with wide glyphs interleaved among narrow ones',
  ];
  for (const s of samples) {
    for (const width of [2, 5, 12, 40, 58]) {
      for (const line of wrapText(s, width)) {
        expect(stringWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  }
});

// ST-FE09 — a glyph wider than the whole width is still emitted, so wrapping always terminates.
test('ST-FE09: a glyph too wide for the width is emitted alone rather than dropped or looped on', () => {
  // A 2-column glyph cannot fit a 1-column width; it is emitted on its own line so the wrap makes
  // progress, which is the one case a line may exceed the requested width.
  expect(wrapText('日本', 1)).toEqual(['日', '本']);
  expect(wrapText('ab日', 1)).toEqual(['a', 'b', '日']);
});

// ST-FE09 — wrapping loses no non-whitespace content.
test('ST-FE09: wrapping drops only whitespace, never text', () => {
  const source = 'The file could not be opened because the directory is not readable by this account.';
  const strip = (s: string): string => s.replace(/\s+/g, '');
  expect(strip(wrapText(source, 20).join(''))).toBe(strip(source));
});
