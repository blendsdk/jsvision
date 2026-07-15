/**
 * `SortHeader<T>` — the datagrid's own sticky header. It renders multi-key sort indicators (an
 * ascending/descending arrow, plus a 1-based priority digit when several columns sort) from a
 * container-owned `Signal<SortKey[]>`, and a funnel `▽` on any column with an active filter from a
 * container-owned `Signal<FilterModel>`. A click in a column's title reports sort intent (Ctrl held ⇒
 * add a key rather than replace); a click on a column's funnel cell reports a funnel click instead, so
 * the container can open that column's filter popup. It shares the body's column geometry
 * (`apportionColumns`/`alignCell`/`stringWidth`) and its horizontal-scroll `indent`, so header and
 * body stay column-aligned and pan together.
 *
 * Unlike the engine's single-column, column-*index*-keyed `GridHeader`, this header is
 * `columnId`-keyed and multi-key, so a later frozen-panel split can bind several `SortHeader`s to the
 * one container signal. It is passive chrome (`focusable = false`) — the body owns the keyboard.
 */
import { View, apportionColumns, alignCell, stringWidth } from '@jsvision/ui';
import type { Column, ColumnGeometry, DispatchEvent, DrawContext, Signal } from '@jsvision/ui';
import type { SortKey } from './sort.js';
import type { FilterModel } from './filter.js';
import { clampWidth } from './column-model.js';

/** The inter-column divider `│` drawn at each column's right edge (mirrors the engine body). */
const DIVIDER = '│';
/** Ascending / descending sort indicators (shared with the engine header glyphs). */
const SORT_ASC = '▲';
const SORT_DESC = '▼';
/** The funnel indicator drawn on a column that has an active filter (same width class as the arrows). */
const FUNNEL = '▽';
/** The reorder drop indicator — a thin caret at the target slot's left edge during a title drag. */
const DROP_MARKER = '▏';

/** Construction config for {@link SortHeader}. */
export interface SortHeaderConfig<T> {
  /** The engine columns (titles + sizing) — shared with the body so geometry never disagrees. */
  columns: Column<T>[];
  /** Column ids parallel to `columns` (index → columnId), so a click resolves to a stable id. */
  columnIds: readonly string[];
  /** The memoized `auto`-width measurement (shared with the body). */
  autoWidths: () => (number | null)[];
  /** The horizontal cell offset (shared with the body — header and body pan in lockstep). */
  indent: Signal<number>;
  /** The container's sort model, read to render the indicators. */
  sort: Signal<SortKey[]>;
  /** Reports a header click: the clicked `columnId` and whether Ctrl was held (an additive multi-key click). */
  onHeaderClick: (columnId: string, additive: boolean) => void;
  /** The container's filter model, read to render the funnel on columns that have an active filter. */
  filterModel: Signal<FilterModel>;
  /**
   * Reports a funnel-cell click: the clicked `columnId`, the funnel cell's header-local anchor (for
   * positioning the filter popup), and the **live dispatch envelope**. The envelope is forwarded
   * because the focus/popup seam (`ev.focusView` / `ev.popupHost`) lives on it — the container needs it
   * to focus the mounted popup and to let the popup's nested dropdowns open (a `ComboBox`/`DatePicker`
   * silently no-ops without `ev.popupHost`). The `{x,y}` anchor alone is not sufficient.
   */
  onFunnelClick: (columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void;
  /**
   * Reports a live column resize (a captured drag on a column's right-edge grip): the `columnId` and the
   * new width in cells, already clamped to the column's `[minWidth, maxWidth]`. Fired on every captured
   * drag so the grid resizes live. Optional — a header without it has no resize grips (a sort/filter-only
   * grid is unaffected).
   */
  onColumnResize?: (columnId: string, width: number) => void;
  /**
   * Reports a double-click on a column's grip: the `columnId` to auto-fit to its widest visible cell.
   * Optional — omit to disable grip auto-fit.
   */
  onColumnAutoFit?: (columnId: string) => void;
  /**
   * A reactive column-geometry trigger, bound for repaint so a width-override change (a live resize /
   * auto-fit) re-apportions the header — `draw` reads widths through the column objects but does not
   * auto-track. Omit when the grid has no resizable columns.
   */
  widthTick?: () => unknown;
  /**
   * Reports a committed column reorder (a title press-drag-drop): the `from` and `to` indices in the
   * **global visible order** (this panel's local index plus {@link columnOffset}). The target is
   * constrained to this panel, so `from`/`to` never cross a freeze boundary. Optional — a header without
   * it has no reorder gesture (a title stays a plain sort click).
   */
  onColumnReorder?: (fromVisible: number, toVisible: number) => void;
  /**
   * Fired once, when a title press turns into a reorder drag (the pointer moved past the threshold). The
   * container uses it to revert the sort the press triggered on mouse-down, so a drag reorders without a
   * net sort while a plain click still sorts. Optional — pairs with {@link onColumnReorder}.
   */
  onReorderStart?: () => void;
  /**
   * This panel's start index in the global visible order (default `0`), added to a local column index so
   * {@link onColumnReorder} reports global visible indices. `0` for a single body.
   */
  columnOffset?: number;
}

/**
 * The datagrid's multi-key sticky header — see the module overview.
 *
 * @example
 * ```ts
 * import { signal } from '@jsvision/ui';
 * import { SortHeader } from '@jsvision/datagrid';
 * import type { SortKey, FilterModel } from '@jsvision/datagrid';
 * const header = new SortHeader({
 *   columns: [{ title: 'Qty', accessor: (r) => String(r.qty), width: 6 }],
 *   columnIds: ['qty'],
 *   autoWidths: () => [null],
 *   indent: signal(0),
 *   sort: signal<SortKey[]>([{ columnId: 'qty', dir: 'asc' }]),
 *   onHeaderClick: (id, additive) => { console.log(id, additive); },
 *   filterModel: signal<FilterModel>(new Map()),
 *   onFunnelClick: (id, anchor) => { console.log('open filter popup for', id, 'at', anchor); },
 * });
 * // Share `autoWidths`/`indent`/`filterModel` with an EditableGridRows so header and body stay aligned.
 * ```
 */
export class SortHeader<T> extends View {
  override focusable = false; // passive chrome — the body owns the keys
  private readonly columns: Column<T>[];
  private readonly columnIds: readonly string[];
  private readonly autoWidths: () => (number | null)[];
  private readonly indent: Signal<number>;
  private readonly sort: Signal<SortKey[]>;
  private readonly onHeaderClick: (columnId: string, additive: boolean) => void;
  private readonly filterModel: Signal<FilterModel>;
  private readonly onFunnelClick: (columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void;
  private readonly onColumnResize?: (columnId: string, width: number) => void;
  private readonly onColumnAutoFit?: (columnId: string) => void;
  private readonly widthTick?: () => unknown;
  private readonly onColumnReorder?: (fromVisible: number, toVisible: number) => void;
  private readonly onReorderStart?: () => void;
  private readonly columnOffset: number;
  // Live-resize gesture state: the local column index being resized (`-1` when idle), the content-space
  // x where the grip was grabbed, and the column's width at grab time — the drag delta adds to it.
  private resizeCol = -1;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  // Reorder gesture state: the local source column being dragged (`-1` when idle), the content-space x at
  // press, whether the drag passed the threshold (a reorder vs a plain click), and the current drop slot.
  private reorderCol = -1;
  private reorderStartX = 0;
  private reorderMoved = false;
  private reorderTarget = -1;

  /**
   * @param cfg The shared header configuration (columns, ids, geometry, indent, sort/filter models, sinks).
   */
  constructor(cfg: SortHeaderConfig<T>) {
    super();
    this.columns = cfg.columns;
    this.columnIds = cfg.columnIds;
    this.autoWidths = cfg.autoWidths;
    this.indent = cfg.indent;
    this.sort = cfg.sort;
    this.onHeaderClick = cfg.onHeaderClick;
    this.filterModel = cfg.filterModel;
    this.onFunnelClick = cfg.onFunnelClick;
    this.onColumnResize = cfg.onColumnResize;
    this.onColumnAutoFit = cfg.onColumnAutoFit;
    this.widthTick = cfg.widthTick;
    this.onColumnReorder = cfg.onColumnReorder;
    this.onReorderStart = cfg.onReorderStart;
    this.columnOffset = cfg.columnOffset ?? 0;
    this.onMount(() => {
      // Repaint when the sort model, the filter model, or the shared H-scroll offset changes.
      this.bind(
        () => this.sort(),
        () => undefined,
      );
      this.bind(
        () => this.filterModel(),
        () => undefined,
      );
      this.bind(
        () => this.indent(),
        () => undefined,
      );
      // Repaint when a column width override changes (a live resize/auto-fit) so the header re-flows.
      if (this.widthTick !== undefined) {
        this.bind(
          () => this.widthTick!(),
          () => undefined,
        );
      }
    });
  }

  /**
   * The right-edge cells a sorted column reserves for its indicator: one for the arrow (single sort),
   * two for a multi-key sort (priority digit + arrow), zero when the column is not sorted. The funnel,
   * when present, sits one cell further left (`sortReserve` away from the right edge).
   */
  private sortReserve(sorted: boolean, multi: boolean): number {
    return sorted ? (multi ? 2 : 1) : 0;
  }

  /** The column geometry for the current viewport width (identical inputs to the body). */
  private geometry(width: number): ColumnGeometry {
    return apportionColumns(this.columns, this.autoWidths(), width);
  }

  /** The clamped horizontal offset for a given content width. */
  private clampedIndent(geom: ColumnGeometry, width: number): number {
    const maxIndent = Math.max(0, geom.totalWidth - width);
    return Math.min(maxIndent, Math.max(0, this.indent()));
  }

  /**
   * The column whose resize grip sits at content-space `x`, or `-1`. A grip is the 1-cell divider at a
   * column's right edge (`starts[c] + widths[c]`) — the same `│` cell {@link draw} paints.
   */
  private gripAt(geom: ColumnGeometry, x: number): number {
    for (let c = 0; c < geom.widths.length; c += 1) {
      if (x === geom.starts[c] + geom.widths[c]) return c;
    }
    return -1;
  }

  /**
   * Apply a captured resize drag: map the pointer to content space, add the drag delta to the grabbed
   * width, clamp to the column's `[minWidth, maxWidth]`, and report it. Fired on every drag so the grid
   * resizes live.
   */
  private dragResize(localX: number): void {
    const geom = this.geometry(this.bounds.width);
    const contentX = localX + this.clampedIndent(geom, this.bounds.width);
    const col = this.columns[this.resizeCol];
    const next = clampWidth(this.resizeStartWidth + (contentX - this.resizeStartX), col.minWidth, col.maxWidth);
    this.onColumnResize?.(this.columnIds[this.resizeCol], next);
  }

  /**
   * Draw the header row: blank it in the header colour, then each title left-aligned with a right-edge
   * `│` divider. A column reserves its last cell(s) for indicators — a funnel `▽` when it has an active
   * filter, then (further right) a 1-based priority digit for a multi-key sort and the sort arrow — so
   * an indicator is never truncated even when the title fills the width. The glyphs are painted from
   * left (funnel) to right (arrow), so the sort arrow always survives when the column is too narrow.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const width = ctx.size.width;
    const geom = this.geometry(width);
    const indent = this.clampedIndent(geom, width);
    const header = ctx.color('tableHeader');
    const divider = ctx.color('listDivider');
    const keys = this.sort();
    // Rank each sorted column by its 1-based priority (its position in the key list) and direction.
    const rank = new Map<string, { priority: number; dir: SortKey['dir'] }>();
    keys.forEach((k, i) => rank.set(k.columnId, { priority: i, dir: k.dir }));
    const multi = keys.length >= 2;
    const filters = this.filterModel();

    ctx.fill(' ', header);
    for (let c = 0; c < this.columns.length; c += 1) {
      const col = this.columns[c];
      const w = geom.widths[c];
      const x = geom.starts[c] - indent;
      const sorted = rank.get(this.columnIds[c]);
      const filtered = filters.has(this.columnIds[c]);
      const sortReserve = this.sortReserve(sorted !== undefined, multi);
      // The title clips into whatever the funnel + sort glyphs leave, clamped to the column width.
      const reserve = Math.min(sortReserve + (filtered ? 1 : 0), w);
      ctx.text(x, 0, alignCell(col.title, Math.max(0, w - reserve), 'left', stringWidth), header);
      // Funnel first (leftmost reserved cell), then the sort glyphs to its right — painted last, so a
      // too-narrow column drops the funnel before the arrow.
      if (filtered && w - 1 - sortReserve >= 0) ctx.text(x + w - 1 - sortReserve, 0, FUNNEL, header);
      if (sorted !== undefined && w > 0) {
        if (multi && w >= 2) ctx.text(x + w - 2, 0, String(sorted.priority + 1), header);
        ctx.text(x + w - 1, 0, sorted.dir === 'asc' ? SORT_ASC : SORT_DESC, header);
      }
      ctx.text(x + w, 0, DIVIDER, divider); // divider at the column right edge
    }
    // While a reorder drag is live, paint a drop indicator at the target slot's left edge (the
    // insertion point). It marks "drop before this column" and is cleared when the gesture resets.
    if (this.reorderMoved && this.reorderTarget >= 0) {
      const tx = geom.starts[this.reorderTarget] - indent;
      if (tx >= 0 && tx < width) ctx.text(tx, 0, DROP_MARKER, ctx.color('listFocused'));
    }
  }

  /**
   * The header pointer machine. A captured gesture (resize or reorder) owns every drag/move/up until
   * release and aborts cleanly on a lost capture. Otherwise a mouse-down is classified grip > funnel >
   * title: a grip down starts a live resize (or auto-fits on a double-click); a funnel down opens that
   * column's filter popup (the live envelope is forwarded so the container inherits its focus/popup seam)
   * and never also sorts; a title down reports a sort intent (Ctrl ⇒ additive) AND — when reorder is
   * enabled — arms a reorder drag. A down on a divider that is not a resize grip, or past the last
   * column, is ignored and left unhandled so it can fall through.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse') return;

    // A captured gesture (resize or reorder) owns drag/move/up until release; a lost capture aborts it.
    if (inner.kind === 'drag' || inner.kind === 'move' || inner.kind === 'up') {
      if (this.resizeCol < 0 && this.reorderCol < 0) return; // no gesture in progress — not ours
      if (ev.hasCapture !== undefined && !ev.hasCapture(this)) {
        this.resetGesture(); // capture was stolen — abandon the half-finished gesture (mirrors Desktop)
        return;
      }
      if (inner.kind === 'up') {
        if (this.reorderCol >= 0) this.finishReorder();
        this.resetGesture();
        ev.releaseCapture?.();
      } else if (this.resizeCol >= 0) {
        if (ev.local !== undefined) this.dragResize(ev.local.x);
      } else {
        this.dragReorder(ev);
      }
      ev.handled = true;
      return;
    }

    if (inner.kind !== 'down') return;
    // A new press supersedes any dangling gesture (a real `up` always precedes; this is defensive).
    if (this.resizeCol >= 0 || this.reorderCol >= 0) {
      ev.releaseCapture?.();
      this.resetGesture();
    }
    const local = ev.local;
    if (local === undefined) return;
    const geom = this.geometry(this.bounds.width);
    const indent = this.clampedIndent(geom, this.bounds.width);
    const contentX = local.x + indent;

    // A resize grip (a column's right-edge divider cell) takes precedence over the title/funnel zones.
    const grip = this.gripAt(geom, contentX);
    if (grip >= 0 && this.onColumnResize !== undefined) {
      if (ev.clickCount !== undefined && ev.clickCount >= 2) {
        this.onColumnAutoFit?.(this.columnIds[grip]); // double-click a grip → auto-fit the column
        ev.handled = true;
        return;
      }
      this.resizeCol = grip;
      this.resizeStartX = contentX;
      this.resizeStartWidth = geom.widths[grip]; // the visible width the user grabbed — the drag delta adds to it
      ev.setCapture?.(this);
      ev.handled = true;
      return;
    }

    // A funnel click is checked next, so a click on a filtered column's funnel never also sorts.
    const filters = this.filterModel();
    const multi = this.sort().length >= 2;
    const sortedIds = new Set(this.sort().map((k) => k.columnId));
    const f = funnelColumnAt(
      geom,
      contentX,
      (k) => filters.has(this.columnIds[k]),
      (k) => this.sortReserve(sortedIds.has(this.columnIds[k]), multi),
    );
    if (f >= 0) {
      const funnelLocalX =
        geom.starts[f] + geom.widths[f] - 1 - this.sortReserve(sortedIds.has(this.columnIds[f]), multi) - indent;
      // Forward the LIVE envelope: `ev.focusView`/`ev.popupHost` live on it, and a popup's nested
      // ComboBox/DatePicker silently no-op without `ev.popupHost`.
      this.onFunnelClick(this.columnIds[f], { x: funnelLocalX, y: 0 }, ev);
      ev.handled = true;
      return;
    }

    const c = columnAtX(geom, contentX);
    if (c >= 0) {
      this.onHeaderClick(this.columnIds[c], inner.ctrl === true); // sort on down (a plain click's effect)
      ev.handled = true;
      // Arm a reorder: a subsequent drag past the threshold turns this press into a reorder (and reverts
      // the sort above via onReorderStart); a plain click with no drag leaves the sort in place.
      if (this.onColumnReorder !== undefined) {
        this.reorderCol = c;
        this.reorderStartX = contentX;
        this.reorderMoved = false;
        this.reorderTarget = c;
        ev.setCapture?.(this);
      }
    }
  }

  /** Clear all gesture state; repaint to drop the reorder indicator if one was showing. */
  private resetGesture(): void {
    const wasReordering = this.reorderMoved;
    this.resizeCol = -1;
    this.reorderCol = -1;
    this.reorderMoved = false;
    this.reorderTarget = -1;
    if (wasReordering) this.invalidate(); // clear the drop indicator
  }

  /**
   * Advance a reorder drag: once the pointer clears the 1-cell threshold, fire {@link onReorderStart}
   * (so the container reverts the on-down sort) and track the drop slot, clamped to this panel, painting
   * the drop indicator as it moves.
   */
  private dragReorder(ev: DispatchEvent): void {
    if (ev.local === undefined) return;
    const geom = this.geometry(this.bounds.width);
    const indent = this.clampedIndent(geom, this.bounds.width);
    const contentX = ev.local.x + indent;
    if (!this.reorderMoved) {
      if (Math.abs(contentX - this.reorderStartX) < 1) return; // still within the click threshold
      this.reorderMoved = true;
      this.onReorderStart?.(); // a real drag → revert the sort the press fired on mouse-down
    }
    const target = this.slotAt(geom, contentX);
    if (target !== this.reorderTarget) {
      this.reorderTarget = target;
      this.invalidate(); // move the drop indicator
    }
  }

  /** Commit a reorder on drop: report the move in global visible indices when it actually changed slots. */
  private finishReorder(): void {
    if (this.reorderMoved && this.reorderTarget >= 0 && this.reorderTarget !== this.reorderCol) {
      this.onColumnReorder?.(this.columnOffset + this.reorderCol, this.columnOffset + this.reorderTarget);
    }
  }

  /** The drop slot for a content-space x: the column under the pointer, clamped to this panel's range. */
  private slotAt(geom: ColumnGeometry, x: number): number {
    const c = columnAtX(geom, x);
    if (c >= 0) return c;
    return x < geom.starts[0] ? 0 : this.columns.length - 1; // on a divider / past an end → nearest slot
  }
}

/**
 * The column index whose CONTENT region contains `x` (`starts[k] <= x < starts[k] + widths[k]`), or
 * `-1` when `x` falls on a divider or past the last column. Deliberately excludes the divider cell, so
 * a click between columns is a no-op — unlike the engine's `columnAt`, which includes the divider.
 */
function columnAtX(geom: ColumnGeometry, x: number): number {
  for (let k = 0; k < geom.widths.length; k += 1) {
    if (x >= geom.starts[k] && x < geom.starts[k] + geom.widths[k]) return k;
  }
  return -1;
}

/**
 * The column whose funnel cell sits exactly at content-space `x`, or `-1` when none does. A column has
 * a funnel only when `isFiltered(k)` is true and it is wide enough to hold it; the funnel occupies the
 * cell `sortReserveOf(k)` in from the column's right edge (so it clears any sort arrow/priority digit).
 * Checked before {@link columnAtX} so a funnel click routes to the popup instead of a sort.
 */
function funnelColumnAt(
  geom: ColumnGeometry,
  x: number,
  isFiltered: (index: number) => boolean,
  sortReserveOf: (index: number) => number,
): number {
  for (let k = 0; k < geom.widths.length; k += 1) {
    const w = geom.widths[k];
    const reserve = sortReserveOf(k);
    if (!isFiltered(k) || w - 1 - reserve < 0) continue;
    if (x === geom.starts[k] + w - 1 - reserve) return k;
  }
  return -1;
}
