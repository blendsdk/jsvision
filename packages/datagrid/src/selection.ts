/**
 * The pure, view-free selection model for `@jsvision/datagrid`: the ordered set-membership ops every
 * selection gesture (Space toggle, Ctrl/Shift, the checkbox column, header select-all) shares.
 *
 * Like `sort.ts` / `filter.ts` / `column-model.ts` this module holds no view state and no signals — a
 * caller passes a plain `ReadonlySet<Key>` (the current selection) plus, for ranges, the current
 * display-order key list, and every function returns a **new** `ReadonlySet<Key>` (never mutating its
 * input) so the container can `selectedKeys.set(next)` and drive a reactive repaint. Because the
 * selection is keyed by `rowKey` (not by index), it survives re-sort/re-filter with no reconcile: the
 * same rows re-highlight wherever they move.
 */

/**
 * A stable row identity — the same value a source's `rowKey(row)` returns. Selection is keyed by this,
 * so a selected row stays selected across sort/filter/scroll (its key does not change).
 */
export type Key = string | number;

/**
 * How a pick composes with the existing selection. `single` holds at most one key (each pick replaces
 * the prior); `multi` accumulates (each pick toggles or extends).
 */
export type SelectionMode = 'single' | 'multi';

/**
 * The header select-all tri-state over the displayed rows: `none` (no displayed row selected), `all`
 * (every displayed row selected), or `some` (a non-empty, non-total subset).
 */
export type TriState = 'none' | 'some' | 'all';

/**
 * Toggle `key`'s membership, returning a new set.
 *
 * In `multi` mode the key is added when absent and removed when present, so the same gesture (Space,
 * Ctrl+click) grows or shrinks the selection. In `single` mode the result holds at most one key: an
 * absent key **replaces** the selection with just `{key}`; toggling the one already-selected key
 * clears the selection.
 *
 * @param current The current selection (not mutated).
 * @param key The row key to toggle.
 * @param mode `'single'` (≤1 key, replace) or `'multi'` (accumulate).
 * @returns A new selection set with `key`'s membership flipped under the mode's rules.
 * @example
 * ```ts
 * import { toggleKey } from '@jsvision/datagrid';
 * let sel = new Set<number>();
 * sel = toggleKey(sel, 1, 'multi'); // {1}
 * sel = toggleKey(sel, 2, 'multi'); // {1, 2}
 * sel = toggleKey(sel, 1, 'multi'); // {2}      — present key removed
 * sel = toggleKey(sel, 9, 'single'); // {9}     — single replaces
 * ```
 */
export function toggleKey(current: ReadonlySet<Key>, key: Key, mode: SelectionMode): ReadonlySet<Key> {
  const present = current.has(key);
  if (mode === 'single') {
    // Single holds ≤1 key: re-picking the selected key clears; any other pick replaces the whole set.
    return present ? new Set() : new Set([key]);
  }
  const next = new Set(current);
  if (present) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * Select the contiguous run between `anchorKey` and `toKey` **in display order**, returning a new set.
 *
 * The run is the slice of `displayKeys` between the two keys' positions, inclusive, and is
 * order-independent — an anchor after the target selects the same rows. In `multi` mode the run is
 * unioned onto `current`; in `single` mode it collapses to just `{toKey}` (a single selection cannot
 * hold a range). If either key is absent from `displayKeys` (a stale anchor after a delete/filter, or
 * an off-display target), the op degrades to selecting just `toKey` (unioned onto `current` in multi).
 *
 * @param current The current selection (not mutated).
 * @param anchorKey The range's fixed end (typically the last cursor/selection anchor).
 * @param toKey The range's moving end (the just-picked row).
 * @param displayKeys The current display order mapped to keys (`display()` through `rowKey`).
 * @param mode `'single'` (collapses to `{toKey}`) or `'multi'` (unions the run onto `current`).
 * @returns A new selection set extended by the display-order run (or just `toKey` when stale).
 * @example
 * ```ts
 * import { selectRange } from '@jsvision/datagrid';
 * const display = ['a', 'b', 'c', 'd'];
 * selectRange(new Set(), 'a', 'c', display, 'multi'); // {a, b, c}
 * selectRange(new Set(), 'c', 'a', display, 'multi'); // {a, b, c} — order-independent
 * selectRange(new Set(), 'a', 'c', display, 'single'); // {c}      — single can't hold a range
 * ```
 */
export function selectRange(
  current: ReadonlySet<Key>,
  anchorKey: Key,
  toKey: Key,
  displayKeys: readonly Key[],
  mode: SelectionMode,
): ReadonlySet<Key> {
  if (mode === 'single') return new Set([toKey]);

  const anchorAt = displayKeys.indexOf(anchorKey);
  const toAt = displayKeys.indexOf(toKey);
  // A stale anchor (or off-display target) has no run to sweep — fall back to just the target key.
  if (anchorAt === -1 || toAt === -1) return new Set(current).add(toKey);

  const lo = Math.min(anchorAt, toAt);
  const hi = Math.max(anchorAt, toAt);
  const next = new Set(current);
  for (let i = lo; i <= hi; i++) next.add(displayKeys[i]);
  return next;
}

/**
 * Select every displayed row — the header checkbox's select-all target. The scope is the current
 * `display()` (all filtered/sorted rows in view); filtered-out rows are not swept in.
 *
 * @param displayKeys The current display order mapped to keys.
 * @returns A new set containing exactly the displayed keys (empty when nothing is displayed).
 * @example
 * ```ts
 * import { selectAll } from '@jsvision/datagrid';
 * selectAll(['a', 'b', 'c']); // {a, b, c}
 * ```
 */
export function selectAll(displayKeys: readonly Key[]): ReadonlySet<Key> {
  return new Set(displayKeys);
}

/**
 * The header select-all tri-state over the displayed rows.
 *
 * Counts how many of `displayKeys` are in `current`: `none` when zero (or nothing is displayed),
 * `all` when every displayed row is selected, `some` otherwise. Keys in `current` that are not
 * displayed (e.g. selected then filtered out) do not affect the result.
 *
 * @param current The current selection.
 * @param displayKeys The current display order mapped to keys.
 * @returns `'none'`, `'some'`, or `'all'`.
 * @example
 * ```ts
 * import { triState } from '@jsvision/datagrid';
 * const display = ['a', 'b', 'c'];
 * triState(new Set(['a', 'b']), display);      // 'some'
 * triState(new Set(['a', 'b', 'c']), display);  // 'all'
 * triState(new Set(), display);                 // 'none'
 * ```
 */
export function triState(current: ReadonlySet<Key>, displayKeys: readonly Key[]): TriState {
  if (displayKeys.length === 0) return 'none';
  let selectedCount = 0;
  for (const key of displayKeys) if (current.has(key)) selectedCount++;
  if (selectedCount === 0) return 'none';
  return selectedCount === displayKeys.length ? 'all' : 'some';
}
