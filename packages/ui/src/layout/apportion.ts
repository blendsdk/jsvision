/**
 * The integer math at the heart of the flex layout: distribute a whole number of
 * terminal cells across weighted shares so they sum to the total exactly, plus a
 * 1-D flex track solver built on it.
 *
 * Terminal cells are integers, but flex layout produces fractional ideal sizes.
 * Rounding each child independently makes their widths fail to sum to the
 * container — the 1-cell gaps and overlaps at flex boundaries that float-based
 * layout engines exhibit. The fix is **largest-remainder apportionment**: floor
 * every share, then hand the leftover cells out one at a time to the largest
 * fractional remainders, so a row fills its container *exactly*.
 *
 * All arithmetic is done in integers (exact remainder, not float rounding) so the
 * "fills exactly" guarantee holds for every width by construction.
 */

/** A single item along a 1-D flex track: either a fixed cell count or a flexible grow-weight share. */
export type TrackItem =
  | { readonly kind: 'fixed'; readonly size: number } // exact integer cells
  | {
      readonly kind: 'flex';
      readonly weight: number; // `fr` / grow weight
      /**
       * Optional floor in whole cells: this item is never solved below `min`, even as the
       * container shrinks. When **no** item on the track carries a `min`, the solver runs its
       * plain apportionment untouched (the no-min fast path), so the field is free for every
       * existing caller. When the floors are collectively unsatisfiable — their sum exceeds the
       * available space — every item squeezes proportionally rather than overflow the track.
       */
      readonly min?: number;
    };

/**
 * Distribute `total` integer cells across weighted shares so the result sums to
 * `total` **exactly**. Uses the largest-remainder method: floor each ideal
 * share, then give the leftover cells to the items with the largest remainders,
 * so no cell is lost to rounding. Ties break toward the earlier item, so the
 * result is deterministic.
 *
 * @param total Integer cells to distribute (≤ 0 → all zeros).
 * @param weights Per-item grow weights; treated as non-negative integers
 *   (fractional weights are rounded, keeping the apportionment exact).
 * @returns One integer size per weight, summing to `total` when any weight is
 *   positive; all zeros otherwise.
 * @example
 * import { apportion } from '@jsvision/ui';
 *
 * // 10 cells split three equal ways — the odd cell goes to the first item.
 * apportion(10, [1, 1, 1]); // → [4, 3, 3]  (sums to exactly 10)
 *
 * // Weighted split: a 2:1:1 ratio of 100 cells.
 * apportion(100, [2, 1, 1]); // → [50, 25, 25]
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  const sizes = new Array<number>(n).fill(0);
  if (n === 0 || total <= 0) return sizes;

  const w = weights.map((x) => Math.max(0, Math.round(x)));
  const weightSum = w.reduce((sum, x) => sum + x, 0);
  if (weightSum === 0) return sizes;

  // Exact integer division: ideal_i = total * w_i / weightSum. The quotient is
  // each item's floor; the remainder ranks who is owed a leftover cell.
  const ranked: { index: number; remainder: number }[] = [];
  let distributed = 0;
  for (let i = 0; i < n; i++) {
    const numerator = total * w[i];
    const remainder = numerator % weightSum;
    const quotient = (numerator - remainder) / weightSum;
    sizes[i] = quotient;
    distributed += quotient;
    ranked.push({ index: i, remainder });
  }

  // Hand leftover cells, one each, to the largest remainders. Ties break toward
  // the earliest item (stable sort) for deterministic fill. leftover < n always,
  // so every cell is placed and the sizes sum to `total` exactly.
  let leftover = total - distributed;
  ranked.sort((a, b) => b.remainder - a.remainder);
  for (let k = 0; k < ranked.length && leftover > 0; k++, leftover--) {
    sizes[ranked[k].index] += 1;
  }
  return sizes;
}

/**
 * Distribute `total` cells across weighted shares while honouring per-item minimums.
 *
 * Pins to a fixpoint: apportion the free space, freeze every item the plain split would starve
 * below its floor, then re-apportion the remainder among those still free — repeating until a
 * pass freezes nothing new. Each pass freezes at least one item, so it converges in at most
 * `weights.length` passes. Pure integer arithmetic; the result sums to `total` exactly whenever an
 * unfrozen item has positive weight, and always in the infeasible branch.
 *
 * When the floors are collectively unsatisfiable (their sum ≥ `total`) there is genuinely no room,
 * so every item squeezes proportionally by minimum via {@link apportion} — still summing to `total`
 * exactly. Items sink below their floors only here, because the space does not exist; what they must
 * never do is exceed the track (hit-testing reads the resulting bounds, so an overflow is a wrong
 * click target, not merely a clipped glyph).
 *
 * Module-private: {@link solveTrack} is the only caller, and only when some item carries a min.
 */
function apportionMin(total: number, weights: readonly number[], mins: readonly number[]): number[] {
  const n = weights.length;
  const m = mins.map((x) => Math.max(0, Math.round(x)));
  const minSum = m.reduce((sum, x) => sum + x, 0);

  // Not enough room for every floor → squeeze proportionally by minimum. Still fills `total` exactly.
  if (minSum >= total) return apportion(total, m);

  const pinned = new Array<boolean>(n).fill(false);
  for (let pass = 0; pass < n; pass++) {
    let pinnedSum = 0;
    for (let i = 0; i < n; i++) if (pinned[i]) pinnedSum += m[i];

    // Re-solve the still-free items over whatever the pinned floors leave behind.
    const activeWeights = weights.map((w, i) => (pinned[i] ? 0 : w));
    const solved = apportion(total - pinnedSum, activeWeights);

    let newlyPinned = false;
    for (let i = 0; i < n; i++) {
      if (!pinned[i] && solved[i] < m[i]) {
        pinned[i] = true;
        newlyPinned = true;
      }
    }
    // No further starvation: pinned items take their floor, the rest keep this pass's solve.
    if (!newlyPinned) return solved.map((s, i) => (pinned[i] ? m[i] : s));
  }

  // Every item pinned — reachable only when the residual free items all have zero weight. Each
  // gets its floor and any residue stays unfilled, exactly as an all-zero-weight track does today.
  return m.slice();
}

/**
 * Solve a 1-D flex track into exact integer sizes. Fixed items keep their size;
 * flexible items split whatever space is left after the fixed items and the gaps,
 * shared out via {@link apportion} so the sizes plus gaps fill `total` exactly
 * whenever a flexible item has free space.
 *
 * A flexible item may carry an optional `min` cell floor. When any does, the free space is solved
 * so no item falls below its floor (squeezing proportionally if the floors cannot all be met);
 * when none does, the plain apportionment runs unchanged — so every pre-existing caller is byte
 * identical.
 *
 * @param total Integer cells available along the axis.
 * @param items Track items, in order — each `{ kind: 'fixed', size }` or
 *   `{ kind: 'flex', weight }` (a flex item may add an optional `min` cell floor).
 * @param gap Integer gap between adjacent items (default 0). Gaps are reserved
 *   from the total before flexible items are sized, but the returned sizes are
 *   item sizes only — placing the gaps is the caller's job.
 * @returns One integer size per item.
 * @example
 * import { solveTrack } from '@jsvision/ui';
 *
 * // A 20-cell row: a 5-cell fixed sidebar plus two equal flexible panes.
 * solveTrack(20, [
 *   { kind: 'fixed', size: 5 },
 *   { kind: 'flex', weight: 1 },
 *   { kind: 'flex', weight: 1 },
 * ]); // → [5, 8, 7]  (the 15 free cells split 8/7, summing to exactly 20)
 *
 * // A binding minimum: the first pane never solves below 15 cells.
 * solveTrack(20, [
 *   { kind: 'flex', weight: 1, min: 15 },
 *   { kind: 'flex', weight: 1 },
 * ]); // → [15, 5]  (the floor binds; still sums to exactly 20)
 */
export function solveTrack(total: number, items: readonly TrackItem[], gap = 0): number[] {
  const n = items.length;
  if (n === 0) return [];

  const totalGap = Math.max(0, gap) * (n - 1);
  let fixedSum = 0;
  for (const item of items) {
    if (item.kind === 'fixed') fixedSum += Math.max(0, item.size);
  }
  const free = Math.max(0, total - fixedSum - totalGap);

  const weights = items.map((item) => (item.kind === 'flex' ? item.weight : 0));
  // Fast path: no floor anywhere → the plain apportionment, byte-identical to before.
  const hasMin = items.some((item) => item.kind === 'flex' && item.min !== undefined && item.min > 0);
  const flex = hasMin
    ? apportionMin(
        free,
        weights,
        items.map((item) => (item.kind === 'flex' ? (item.min ?? 0) : 0)),
      )
    : apportion(free, weights);

  return items.map((item, i) => (item.kind === 'fixed' ? Math.max(0, item.size) : flex[i]));
}
