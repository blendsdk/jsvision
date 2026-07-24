import { charWidth } from '@jsvision/core';

const graphemeSegmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

/** Iterates Unicode grapheme clusters with their UTF-16 source indices. */
export function visualGraphemeSegments(text: string): Intl.Segments {
  return graphemeSegmenter.segment(text);
}

/**
 * Returns the terminal-cell width of one Unicode grapheme cluster.
 *
 * A cluster can contain several code points, but terminal width follows its widest printable
 * member rather than adding every combining mark, variation selector, or joiner.
 */
export function graphemeDisplayWidth(grapheme: string): number {
  let width = 0;
  for (const character of grapheme) {
    width = Math.max(width, charWidth(character.codePointAt(0) ?? 0, 'wcwidth'));
  }
  return width;
}
