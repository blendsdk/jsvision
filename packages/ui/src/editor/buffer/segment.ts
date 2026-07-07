/**
 * Grapheme-cluster boundary primitives over `Intl.Segmenter`, so the caret steps over a whole
 * user-perceived character (an emoji, a base + combining marks, a CJK glyph) as one unit.
 *
 * Callers pass line-bounded slices (a single line's text, not the whole buffer), so the segmenter
 * never scans more than one line at a time. Malformed input never throws: a lone surrogate is
 * treated as its own one-unit cluster.
 */

/** One module-level segmenter, reused across calls (locale-independent grapheme granularity). */
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

/**
 * End index (exclusive) of the cluster starting at — or containing — code-unit index `i`.
 *
 * @param text The line-bounded text slice.
 * @param i A code-unit index into `text`; out-of-range clamps to `text.length`.
 * @returns The first index after the cluster; `text.length` when `i` is at/past the end.
 */
export function nextClusterEnd(text: string, i: number): number {
  if (i >= text.length) return text.length;
  const seg = segmenter.segment(text).containing(Math.max(0, i));
  return seg === undefined ? text.length : seg.index + seg.segment.length;
}

/**
 * Start index of the cluster strictly before code-unit index `i`.
 *
 * @param text The line-bounded text slice.
 * @param i A code-unit index into `text`; out-of-range clamps.
 * @returns The containing cluster's start for the unit at `i − 1`; `0` when `i ≤ 0`.
 */
export function prevClusterStart(text: string, i: number): number {
  if (i <= 0) return 0;
  const seg = segmenter.segment(text).containing(Math.min(i, text.length) - 1);
  return seg === undefined ? 0 : seg.index;
}

/**
 * Whether `i` is a cluster boundary in `text` (both ends count as boundaries).
 *
 * @param text The line-bounded text slice.
 * @param i A code-unit index.
 * @returns `true` iff a cluster starts at `i` (or `i` is `0`/`text.length`).
 */
export function isClusterStart(text: string, i: number): boolean {
  if (i === 0 || i === text.length) return true;
  if (i < 0 || i > text.length) return false;
  const seg = segmenter.segment(text).containing(i);
  return seg !== undefined && seg.index === i;
}
