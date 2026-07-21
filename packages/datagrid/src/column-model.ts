/**
 * The pure, view-free column-layout model for `@jsvision/datagrid`: the SHAPE of column-layout state
 * (visible order, the frozen left/center/right partition, width clamping, and the over-pin guard) as
 * deterministic functions. Like `sort.ts`/`filter.ts` it holds no view state and no signals — callers
 * pass plain snapshots, so every function is directly unit-testable. The container (`grid.ts`) wraps
 * these in reactive signals and injects the results into the panels.
 *
 * The freeze partition regroups the visible ids into `[left, center, right]`; the container renders in
 * that concatenated order, which is what makes a single global column cursor a contiguous index.
 */

/** The minimum a column may be resized to when it declares no `minWidth` (fits an ellipsis + a glyph). */
export const DEFAULT_MIN_WIDTH = 3;

/** The default upper bound for auto-fit when a column declares no `maxWidth` (generous but bounded). */
export const DEFAULT_AUTOFIT_MAX = 60;

/**
 * A freeze partition: the visible column ids grouped into each panel, in visible order. The three
 * slices concatenated (`[...left, ...center, ...right]`) are the effective render/cursor order.
 */
export interface FreezePartition {
  /** Left-pinned column ids, in order. */
  readonly left: string[];
  /** Center (horizontally-scrolling) column ids, in order. */
  readonly center: string[];
  /** Right-pinned column ids, in order. */
  readonly right: string[];
}

/**
 * The freeze specification as authored at construction. The three forms are alternatives: explicit id
 * lists (`freezeLeft`/`freezeRight`) take precedence over the `freeze` first-N shorthand.
 */
export interface FreezeSpec {
  /** Column ids to pin to the left panel. */
  readonly freezeLeft?: string[];
  /** Column ids to pin to the right panel. */
  readonly freezeRight?: string[];
  /** Shorthand: pin the first N visible columns to the left (ignored when `freezeLeft` is set). */
  readonly freeze?: number;
}

/**
 * Project the full column order into visible order, dropping the hidden ids and preserving the rest.
 *
 * @param order The full column order (all ids, hidden included).
 * @param hidden The set of hidden column ids.
 * @returns The visible ids, in order.
 * @example
 * ```ts
 * import { visibleOrder } from '@jsvision/datagrid';
 * visibleOrder(['id', 'name', 'dept'], new Set(['dept'])); // ['id', 'name']
 * ```
 */
export function visibleOrder(order: readonly string[], hidden: ReadonlySet<string>): string[] {
  return order.filter((id) => !hidden.has(id));
}

/**
 * Partition the visible ids into left / center / right panels from a freeze spec. Left/right slices
 * keep their visible-order sequence; everything not frozen is center. Ids in the freeze spec that are
 * not present in `visible` are ignored (an unknown or hidden frozen id simply isn't placed).
 *
 * @param visible The visible column ids, in order.
 * @param freeze The freeze spec (`freezeLeft`/`freezeRight` take precedence over `freeze`).
 * @returns The three ordered id slices.
 * @example
 * ```ts
 * import { partition } from '@jsvision/datagrid';
 * partition(['id', 'name', 'dept', 'note'], { freezeLeft: ['id'], freezeRight: ['note'] });
 * // { left: ['id'], center: ['name', 'dept'], right: ['note'] }
 * partition(['id', 'name', 'dept'], { freeze: 2 });
 * // { left: ['id', 'name'], center: ['dept'], right: [] }
 * ```
 */
export function partition(visible: readonly string[], freeze: FreezeSpec): FreezePartition {
  const present = new Set(visible);
  const rightSet = new Set((freeze.freezeRight ?? []).filter((id) => present.has(id)));
  let leftSet: Set<string>;
  if (freeze.freezeLeft !== undefined) {
    leftSet = new Set(freeze.freezeLeft.filter((id) => present.has(id) && !rightSet.has(id)));
  } else if (freeze.freeze !== undefined && freeze.freeze > 0) {
    const n = Math.min(freeze.freeze, visible.length);
    leftSet = new Set(visible.slice(0, n).filter((id) => !rightSet.has(id)));
  } else {
    leftSet = new Set();
  }
  const left = visible.filter((id) => leftSet.has(id));
  const right = visible.filter((id) => rightSet.has(id));
  const center = visible.filter((id) => !leftSet.has(id) && !rightSet.has(id));
  return { left, center, right };
}

/**
 * Move a column within its own panel (a reorder). `from`/`to` are indices into the effective visible
 * order (`[...left, ...center, ...right]`). A move that would cross a panel (freeze) boundary is
 * rejected — the order is returned unchanged — so a frozen column can never be dragged out of its
 * panel and a scrolling column can never be dragged into a frozen one (the within-panel reorder rule).
 *
 * @param visible The visible column ids, in effective (grouped) order.
 * @param freeze The freeze spec (defines the panel boundaries).
 * @param from The source index.
 * @param to The destination index.
 * @returns The reordered ids, or a copy of the input unchanged when the move is out of range, a no-op,
 *   or crosses a freeze boundary.
 * @example
 * ```ts
 * import { reorderWithinPanel } from '@jsvision/datagrid';
 * // freeze:1 → left=[id], center=[name,dept,note]; move 'dept' (2) before 'name' (1):
 * reorderWithinPanel(['id', 'name', 'dept', 'note'], { freeze: 1 }, 2, 1);
 * // ['id', 'dept', 'name', 'note']
 * // a center→left move is rejected:
 * reorderWithinPanel(['id', 'name', 'dept'], { freeze: 1 }, 1, 0); // ['id', 'name', 'dept']
 * ```
 */
export function reorderWithinPanel(visible: readonly string[], freeze: FreezeSpec, from: number, to: number): string[] {
  const n = visible.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return [...visible];
  const { left, center } = partition(visible, freeze);
  const leftLen = left.length;
  const centerEnd = leftLen + center.length;
  const panelOf = (i: number): number => (i < leftLen ? 0 : i < centerEnd ? 1 : 2);
  if (panelOf(from) !== panelOf(to)) return [...visible]; // cross-boundary → rejected
  const arr = [...visible];
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  return arr;
}

/**
 * Clamp a requested column width to `[minWidth ?? DEFAULT_MIN_WIDTH, maxWidth]`. The floor always
 * applies; the cap applies only when `maxWidth` is set (an interactive resize may exceed the auto-fit
 * default, but never a column's own declared max).
 *
 * @param requested The requested width in cells.
 * @param minWidth The column's minimum width (defaults to {@link DEFAULT_MIN_WIDTH}).
 * @param maxWidth The column's maximum width (uncapped when omitted).
 * @returns The clamped width.
 * @example
 * ```ts
 * import { clampWidth } from '@jsvision/datagrid';
 * clampWidth(1, 4, 20);  // 4  (below min)
 * clampWidth(99, 4, 20); // 20 (above max)
 * clampWidth(10);        // 10 (within default floor, no cap)
 * ```
 */
export function clampWidth(requested: number, minWidth?: number, maxWidth?: number): number {
  const min = minWidth ?? DEFAULT_MIN_WIDTH;
  let w = Math.max(min, requested);
  if (maxWidth !== undefined) w = Math.min(w, maxWidth);
  return w;
}

/**
 * The frozen column ids to un-pin so the center panel keeps at least one cell — i.e. the columns that
 * make the total frozen width meet or exceed the viewport. Peels the **innermost** frozen column
 * (nearest the center: the left panel's last, then the right panel's first) until the frozen total
 * fits under `viewportWidth − 1`. Returns `[]` when everything already fits. The container moves the
 * returned ids to the center and emits a single dev warning (the center is therefore never blank).
 *
 * @param part The current freeze partition.
 * @param widthOf The resolved width (in cells) of a column id.
 * @param viewportWidth The grid's usable width in cells.
 * @returns The frozen ids to un-pin (innermost-first), or `[]` when the frozen columns fit.
 * @example
 * ```ts
 * import { overPinnedIds } from '@jsvision/datagrid';
 * // two 10-wide frozen columns in a 15-wide viewport → drop the innermost:
 * overPinnedIds({ left: ['a', 'b'], center: ['c'], right: [] }, () => 10, 15); // ['b']
 * ```
 */
export function overPinnedIds(part: FreezePartition, widthOf: (id: string) => number, viewportWidth: number): string[] {
  const left = [...part.left];
  const right = [...part.right];
  const dropped: string[] = [];
  const frozenTotal = (): number => [...left, ...right].reduce((s, id) => s + Math.max(0, widthOf(id)), 0);
  // Reserve ≥ 1 cell for the center: the frozen total must stay strictly under viewportWidth − 1.
  while (left.length + right.length > 0 && frozenTotal() >= viewportWidth - 1) {
    if (left.length > 0) dropped.push(left.pop()!);
    else dropped.push(right.shift()!);
  }
  return dropped;
}
