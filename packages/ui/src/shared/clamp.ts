/**
 * A single, shared integer/number clamp — kept in one place so every caller shares the same argument
 * order and the same empty-range convention, rather than each re-deriving it.
 */

/**
 * Clamp `n` into the inclusive range `[lo, hi]`. When the range is empty (`lo > hi`), `lo` wins.
 *
 * The empty-range rule is load-bearing for gesture math: a drag helper computes bounds from live
 * geometry that can momentarily invert, and a single pinned definition means every call site agrees
 * on what happens then instead of assuming it.
 *
 * @param n  The value to clamp.
 * @param lo The lower bound — also the result when the range is empty (`lo > hi`).
 * @param hi The upper bound.
 * @returns `n` confined to `[lo, hi]`, or `lo` when `lo > hi`.
 */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
