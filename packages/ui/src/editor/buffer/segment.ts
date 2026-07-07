/**
 * Grapheme-cluster boundary primitives over `Intl.Segmenter` (RD-08 PA-5 — a pure, ui-local
 * module; promotion to `@jsvision/core` waits for a second consumer, RD-08 PF-002).
 *
 * These generalize TV's double-byte `TText::next`/`TText::prev` stepping (`edits.cpp:130-159`) to
 * Unicode grapheme clusters (AR-251). Inputs are LINE-BOUNDED slices (the navigate.ts callers pass
 * `lineStart(p)…lineEnd(p)`, PF-007) so the segmenter never scans a whole buffer. Malformed input
 * must never throw: `Intl.Segmenter` treats a lone surrogate as its own 1-unit cluster (the RD-13
 * HR-01 rule, asserted by ST-4).
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
