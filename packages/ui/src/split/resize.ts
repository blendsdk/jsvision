/**
 * The pure resize math behind {@link SplitView}: move one divider by a signed cell delta, conserving
 * the two adjacent panes' combined size and clamping so neither is pushed below its minimum.
 *
 * Module-private (the layout/pack-row precedent): the component is the only caller, and the surface it
 * exposes is the `SplitView` class, not this helper. Kept pure so it carries the heavy spec coverage.
 */
import { clamp } from '../shared/clamp.js';

/**
 * Move the divider at `index` by `delta` cells, trading space between pane `index` and pane
 * `index + 1` only. Their combined size is conserved, so the whole track still sums to the same free
 * space — which keeps the apportionment identity armed, so the next 1-cell drag also moves exactly 1
 * cell.
 *
 * @param cells The current resolved cell size of every pane.
 * @param index The divider index (between pane `index` and pane `index + 1`).
 * @param delta The requested signed movement in cells (positive grows the left/upper pane).
 * @param mins  The per-pane minimum cell floors (same length as `cells`).
 * @returns A new size array; only the two adjacent panes differ from `cells`.
 */
export function applySplitResize(
  cells: readonly number[],
  index: number,
  delta: number,
  mins: readonly number[],
): number[] {
  const next = cells.slice();
  const a = index;
  const b = index + 1;

  // Read these as *effective* minimums: a pane is never pushed further below wherever the engine has
  // already had to place it. Writing the bounds as min(0,…)/max(0,…) makes them always straddle 0, so
  // a zero delta is a no-op and the result never depends on how `clamp` orders its arguments. This is
  // load-bearing: the engine is specified to place panes BELOW their minimums when the container is
  // too small to honour them all, and in that regime the naive bounds invert (lo > hi) — which would
  // turn a zero-movement mouse-down into a silent rewrite of the caller-owned sizes.
  const lo = Math.min(0, (mins[a] ?? 0) - cells[a]);
  const hi = Math.max(0, cells[b] - (mins[b] ?? 0));
  const effective = clamp(delta, lo, hi);

  next[a] = cells[a] + effective;
  next[b] = cells[b] - effective;
  return next;
}
