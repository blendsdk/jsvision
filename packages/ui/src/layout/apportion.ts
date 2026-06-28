/**
 * Cell-native layout core (ADR-008): integer apportionment + a 1-D flex track
 * solver built on it.
 *
 * Terminal cells are integers, but flex layout produces fractional ideal sizes.
 * Rounding each child independently makes their widths fail to sum to the
 * container — the 1-cell gaps/overlaps at flex boundaries that float-based
 * engines (Yoga, hence Ink) exhibit. The fix is **largest-remainder (Hamilton)
 * apportionment**: floor every share, then hand the leftover cells one at a time
 * to the largest fractional remainders, so a row fills its container *exactly*.
 *
 * The arithmetic here is done in integers (exact remainder, not float rounding)
 * so the "fills exactly" guarantee holds for every width by construction.
 */

/** A single item along a 1-D flex track. */
export type TrackItem =
  | { readonly kind: 'fixed'; readonly size: number } // exact integer cells
  | { readonly kind: 'flex'; readonly weight: number }; // `fr` / grow weight

/**
 * Distribute `total` integer cells across weighted shares so the result sums to
 * `total` **exactly** (largest-remainder method).
 *
 * @param total Integer cells to distribute (≤ 0 → all zeros).
 * @param weights Per-item `fr` weights; treated as non-negative integers
 *   (fractional weights are rounded, keeping the apportionment exact).
 * @returns One integer size per weight, summing to `total` when any weight is
 *   positive; all zeros otherwise.
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
 * Solve a 1-D flex track into exact integer sizes. Fixed items keep their size;
 * flexible items split the leftover free space via {@link apportion}, so the
 * sizes plus gaps fill `total` exactly whenever a flexible item has free space.
 *
 * @param total Integer cells available along the axis.
 * @param items Track items, in order.
 * @param gap Integer gap between adjacent items (default 0).
 * @returns One integer size per item (gaps are the caller's to place).
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
  const flex = apportion(free, weights);

  return items.map((item, i) => (item.kind === 'fixed' ? Math.max(0, item.size) : flex[i]));
}
