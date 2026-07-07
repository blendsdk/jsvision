/**
 * Pure virtual-scroll geometry for the list widgets.
 *
 * A single-column list shows `viewportRows` items starting at `topItem`; row `i` shows item
 * `topItem + i`. These helpers keep the focused item visible and clamp indices into range — the only
 * math the rows renderer needs, kept pure and independently testable (no view state).
 */

/**
 * Clamp an item index into `[0, range-1]`. A negative index snaps to 0, an over-range index to the
 * last item, and an empty list to 0.
 *
 * @param index The (possibly out-of-range) item index.
 * @param range The total item count.
 * @returns The clamped index.
 * @example
 * clampIndex(-3, 10); // 0
 * clampIndex(99, 10); // 9
 * clampIndex(4, 0);   // 0 (empty list)
 */
export function clampIndex(index: number, range: number): number {
  if (range <= 0) return 0;
  return Math.min(range - 1, Math.max(0, index));
}

/**
 * The `topItem` that keeps `focused` visible in a `viewportRows`-tall single-column window: scroll up
 * if the focused item is above the window, down if it is at or below the bottom, else leave `topItem`
 * unchanged. The result is clamped so the window never scrolls past the end
 * (`[0, max(0, range − viewportRows)]`).
 *
 * @param focused      The focused item index (assumed already clamped into range).
 * @param topItem      The current top item index.
 * @param viewportRows The number of visible rows.
 * @param range        The total item count.
 * @returns The adjusted `topItem`.
 * @example
 * // A 5-row window currently showing items 0..4; focusing item 7 scrolls it down.
 * keepVisible(7, 0, 5, 20); // 3  (window now shows items 3..7)
 * keepVisible(1, 3, 5, 20); // 1  (focus above the window scrolls back up)
 */
export function keepVisible(focused: number, topItem: number, viewportRows: number, range: number): number {
  if (viewportRows <= 0) return 0;
  let top = topItem;
  if (focused < top)
    top = focused; // focus above the window ⇒ make it the new top row
  else if (focused >= top + viewportRows) top = focused - viewportRows + 1; // below ⇒ make it the bottom row
  const maxTop = Math.max(0, range - viewportRows);
  return Math.min(maxTop, Math.max(0, top));
}
