/**
 * Layout variants for `@jsvision/datagrid` — a serializable snapshot of a grid's full column layout
 * (order, per-column width/visibility, the frozen partition, sort, and filter) that a caller persists
 * and later re-applies. Like `sort.ts`/`filter.ts` this module is pure and view-free: `buildVariant`
 * serializes a plain {@link LayoutSnapshot} into a {@link GridVariant}, and `resolveVariant` re-derives
 * the concrete restore instructions against a grid's actual column ids (dropping ids the grid no longer
 * has and appending current-but-unnamed columns after the named ones). The grid's `saveVariant` /
 * `applyVariant` methods are thin delegators over these; the grid never stores a variant itself.
 */
import type { SortKey } from './sort.js';
import type { ColumnFilter, FilterModel } from './filter.js';

/**
 * One column entry in a {@link GridVariant}: its id, whether it is visible, and — only when the column
 * carries an explicit width override — that width. Array position in `GridVariant.columns` is the
 * column's order (hidden columns are kept in place).
 */
export interface GridVariantColumn {
  /** The column id. */
  readonly id: string;
  /** Whether the column is visible (a hidden column stays in the order with `visible: false`). */
  readonly visible: boolean;
  /** An explicit width override, in cells; omitted when the column has no override (auto/declared width). */
  readonly width?: number;
}

/**
 * Read-only, resolved column metadata for a personalization UI: one column's id, header title, current
 * visibility, resolved freeze side, and resolved width in cells. Produced by {@link buildColumnInfos}
 * (the live layout) and {@link defaultLayout} (the construction-time baseline). `frozen` is the
 * *resolved* partition membership — an over-pinned column reports `'none'`, matching `grid.frozen()`.
 * `width` is the resolved (display) width; it is not an override signal — restoring the baseline
 * *omits* a width rather than copying this number back.
 */
export interface GridColumnInfo {
  /** The column id. */
  readonly id: string;
  /** The header title. */
  readonly title: string;
  /** Whether the column is currently visible (not hidden). */
  readonly visible: boolean;
  /** The resolved freeze side: pinned left, pinned right, or not frozen. */
  readonly frozen: 'left' | 'right' | 'none';
  /** The resolved width in cells (override → declared → auto → title). */
  readonly width: number;
}

/**
 * A named, serializable snapshot of a grid's column layout — the object `saveVariant` returns and
 * `applyVariant` consumes. Array order in `columns` is the full column order (hidden interleaved). It is
 * plain JSON (no functions), so a caller can persist it however it likes.
 *
 * @example
 * ```ts
 * import { EditableDataGrid, type GridVariant } from '@jsvision/datagrid';
 * const grid = new EditableDataGrid({ columns, source });
 * const mine: GridVariant = grid.saveVariant('mine'); // persist mine somewhere…
 * grid.applyVariant(mine);                            // …and restore it later
 * ```
 */
export interface GridVariant {
  /** A caller-facing label for the variant. */
  readonly name: string;
  /** The full column order (hidden interleaved), each with its visibility and optional width. */
  readonly columns: GridVariantColumn[];
  /** The frozen partition: column ids pinned to the left and right panels. */
  readonly freeze: { left: string[]; right: string[] };
  /** The sort model (ordered keys; the first is primary). */
  readonly sort: SortKey[];
  /** The per-column filters, as `{ columnId, filter }` pairs. */
  readonly filter: Array<{ columnId: string; filter: ColumnFilter }>;
}

/**
 * The live layout state `buildVariant` reads. The grid assembles one from its private signals — the full
 * order, the hidden set, an explicit-width lookup, the resolved freeze, the sort model, and the filter
 * map.
 */
export interface LayoutSnapshot {
  /** The full column order (all ids, hidden included). */
  readonly order: readonly string[];
  /** The hidden column ids. */
  readonly hidden: ReadonlySet<string>;
  /** An explicit width override for a column id, or `undefined` when it has none. */
  readonly widthOf: (id: string) => number | undefined;
  /** The resolved frozen partition (left/right pinned ids). */
  readonly freeze: { left: string[]; right: string[] };
  /** The sort model. */
  readonly sort: readonly SortKey[];
  /** The filter model (per-column conditions). */
  readonly filter: FilterModel;
}

/**
 * The concrete restore instructions `resolveVariant` produces — already reconciled against the grid's
 * actual columns: `order` is the full order to set (known-named columns first in variant order, then the
 * current-but-unnamed columns appended in their current order); `visibleById`/`widthById` carry the
 * per-column state for the **named** columns only (unnamed columns keep their current state); and
 * `freeze`/`sort`/`filter` are filtered to columns the grid still has.
 */
export interface ResolvedLayout {
  /** The full column order to apply. */
  readonly order: string[];
  /** Visibility per named-and-known column id (unnamed columns keep their current visibility). */
  readonly visibleById: Map<string, boolean>;
  /** Explicit width per named-and-known column that carried one (others keep their current width). */
  readonly widthById: Map<string, number>;
  /**
   * Named-and-known column ids that carry NO width in the variant — their existing width override is
   * *removed* on apply (delete-then-set), so restoring a layout can return a column to auto width, not
   * only set one. Unnamed (appended) columns are absent here and keep their current override.
   */
  readonly clearWidths: string[];
  /** The frozen partition, filtered to columns the grid still has. */
  readonly freeze: { left: string[]; right: string[] };
  /** The sort model, filtered to columns the grid still has. */
  readonly sort: SortKey[];
  /** The per-column filters, filtered to columns the grid still has. */
  readonly filter: Array<{ columnId: string; filter: ColumnFilter }>;
}

/**
 * Serialize a live layout snapshot into a named, JSON-serializable {@link GridVariant}. The full order is
 * preserved (hidden columns kept in place with `visible: false`); a column's `width` is emitted only when
 * it has an explicit override; freeze/sort/filter are copied (the filter map is flattened to an array).
 *
 * @param name The caller-facing variant label.
 * @param snap The live layout state to capture.
 * @returns The serializable variant.
 * @example
 * ```ts
 * const v = buildVariant('compact', {
 *   order: ['id', 'name', 'note'], hidden: new Set(['note']),
 *   widthOf: (id) => (id === 'name' ? 20 : undefined),
 *   freeze: { left: ['id'], right: [] }, sort: [], filter: new Map(),
 * });
 * // v.columns → [{ id: 'id', visible: true }, { id: 'name', visible: true, width: 20 }, { id: 'note', visible: false }]
 * ```
 */
export function buildVariant(name: string, snap: LayoutSnapshot): GridVariant {
  const columns: GridVariantColumn[] = snap.order.map((id) => {
    const width = snap.widthOf(id);
    const visible = !snap.hidden.has(id);
    return width === undefined ? { id, visible } : { id, visible, width };
  });
  return {
    name,
    columns,
    freeze: { left: [...snap.freeze.left], right: [...snap.freeze.right] },
    sort: snap.sort.map((k) => ({ ...k })),
    filter: [...snap.filter.entries()].map(([columnId, filter]) => ({ columnId, filter })),
  };
}

/**
 * Re-derive a variant against a grid's actual column ids. Ids the grid no longer has are dropped (from
 * the order, freeze, sort, and filter); a duplicate id in the variant keeps only its first occurrence;
 * and columns the grid has but the variant does not name are appended after the named ones, in the grid's
 * current order (they keep their current state). Pure — it computes instructions only; the grid applies
 * them.
 *
 * @param variant The variant to restore.
 * @param currentIds The grid's full current column order (all ids, hidden included).
 * @returns The reconciled restore instructions.
 * @example
 * ```ts
 * resolveVariant(
 *   { name: 'x', columns: [{ id: 'b', visible: true }, { id: 'gone', visible: true }], freeze: { left: [], right: [] }, sort: [], filter: [] },
 *   ['a', 'b'],
 * ).order; // ['b', 'a'] — 'gone' dropped, current-but-unnamed 'a' appended
 * ```
 */
export function resolveVariant(variant: GridVariant, currentIds: readonly string[]): ResolvedLayout {
  const currentSet = new Set(currentIds);
  const named: GridVariantColumn[] = [];
  const seen = new Set<string>();
  for (const col of variant.columns) {
    if (currentSet.has(col.id) && !seen.has(col.id)) {
      seen.add(col.id);
      named.push(col);
    }
  }
  const appended = currentIds.filter((id) => !seen.has(id)); // current-but-unnamed, in current order
  const order = [...named.map((c) => c.id), ...appended];
  const visibleById = new Map(named.map((c) => [c.id, c.visible]));
  const widthById = new Map(named.filter((c) => c.width !== undefined).map((c) => [c.id, c.width as number]));
  // Named columns carrying no width signal "clear this override" so applyVariant can delete it — the
  // half of a round-trip that lets a cleared width actually return to auto, not keep a stale value.
  const clearWidths = named.filter((c) => c.width === undefined).map((c) => c.id);
  return {
    order,
    visibleById,
    widthById,
    clearWidths,
    freeze: {
      left: variant.freeze.left.filter((id) => currentSet.has(id)),
      right: variant.freeze.right.filter((id) => currentSet.has(id)),
    },
    sort: variant.sort.filter((k) => currentSet.has(k.columnId)).map((k) => ({ ...k })),
    filter: variant.filter.filter((f) => currentSet.has(f.columnId)).map((f) => ({ ...f })),
  };
}

/**
 * Assemble the full, resolved column list a personalization UI reads — one {@link GridColumnInfo} per
 * id in `order` (hidden columns included, in place). Pure: the grid passes its resolved layout state in
 * as plain lookups, so this holds no reactive reads. `frozen` is resolved partition membership — an
 * over-pinned column that `frozen` does not contain reports `'none'`.
 *
 * @param order The full column order (all ids, hidden included).
 * @param hidden The hidden column ids (a column is `visible` when absent from this set).
 * @param frozen The resolved frozen partition — the left/right pinned ids as `grid.frozen()` reports them.
 * @param widthOf The resolved width of a column id, in cells.
 * @param titleOf The header title of a column id.
 * @returns One resolved info per column, in `order`.
 * @example
 * ```ts
 * buildColumnInfos(
 *   ['id', 'name'], new Set(['name']),
 *   { left: ['id'], right: [] },
 *   (id) => (id === 'id' ? 5 : 8), (id) => id.toUpperCase(),
 * );
 * // → [{ id: 'id', title: 'ID', visible: true, frozen: 'left', width: 5 },
 * //    { id: 'name', title: 'NAME', visible: false, frozen: 'none', width: 8 }]
 * ```
 */
export function buildColumnInfos(
  order: readonly string[],
  hidden: ReadonlySet<string>,
  frozen: { left: readonly string[]; right: readonly string[] },
  widthOf: (id: string) => number,
  titleOf: (id: string) => string,
): GridColumnInfo[] {
  const left = new Set(frozen.left);
  const right = new Set(frozen.right);
  return order.map((id) => ({
    id,
    title: titleOf(id),
    visible: !hidden.has(id),
    frozen: left.has(id) ? 'left' : right.has(id) ? 'right' : 'none',
    width: widthOf(id),
  }));
}

/**
 * The construction-time column baseline: every column visible, in construction order, no freeze, and
 * each column's declared/auto width (no overrides). Pure — the source of a dialog's Reset. The returned
 * `width` is display-only: a Reset restores *no override* (the pending column omits `width`); never copy
 * this number back, or it re-establishes an override and defeats the clear.
 *
 * @param constructionOrder The column ids in construction (declaration) order.
 * @param declaredWidthOf The declared/auto width of a column id (no override lookup).
 * @param titleOf The header title of a column id.
 * @returns One baseline info per column, all visible and unfrozen, in construction order.
 * @example
 * ```ts
 * defaultLayout(['id', 'name'], (id) => (id === 'id' ? 5 : 8), (id) => id.toUpperCase());
 * // → [{ id: 'id', title: 'ID', visible: true, frozen: 'none', width: 5 }, …]
 * ```
 */
export function defaultLayout(
  constructionOrder: readonly string[],
  declaredWidthOf: (id: string) => number,
  titleOf: (id: string) => string,
): GridColumnInfo[] {
  return constructionOrder.map((id) => ({
    id,
    title: titleOf(id),
    visible: true,
    frozen: 'none' as const,
    width: declaredWidthOf(id),
  }));
}
