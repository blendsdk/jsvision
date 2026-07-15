/**
 * `SortHeader<T>` — the datagrid's own sticky header. It renders multi-key sort indicators (an
 * ascending/descending arrow, plus a 1-based priority digit when several columns sort) from a
 * container-owned `Signal<SortKey[]>`, and turns a header click into sort intent (Ctrl held ⇒ add a
 * key rather than replace). It shares the body's column geometry
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

/** The inter-column divider `│` drawn at each column's right edge (mirrors the engine body). */
const DIVIDER = '│';
/** Ascending / descending sort indicators (shared with the engine header glyphs). */
const SORT_ASC = '▲';
const SORT_DESC = '▼';

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
}

/**
 * The datagrid's multi-key sticky header — see the module overview.
 *
 * @example
 * ```ts
 * import { signal } from '@jsvision/ui';
 * import { SortHeader } from '@jsvision/datagrid';
 * import type { SortKey } from '@jsvision/datagrid';
 * const header = new SortHeader({
 *   columns: [{ title: 'Qty', accessor: (r) => String(r.qty), width: 6 }],
 *   columnIds: ['qty'],
 *   autoWidths: () => [null],
 *   indent: signal(0),
 *   sort: signal<SortKey[]>([{ columnId: 'qty', dir: 'asc' }]),
 *   onHeaderClick: (id, additive) => { console.log(id, additive); },
 * });
 * // Share `autoWidths`/`indent` with an EditableGridRows so header and body stay column-aligned.
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

  /**
   * @param cfg The shared header configuration (columns, ids, geometry, indent, sort, click sink).
   */
  constructor(cfg: SortHeaderConfig<T>) {
    super();
    this.columns = cfg.columns;
    this.columnIds = cfg.columnIds;
    this.autoWidths = cfg.autoWidths;
    this.indent = cfg.indent;
    this.sort = cfg.sort;
    this.onHeaderClick = cfg.onHeaderClick;
    this.onMount(() => {
      // Repaint when the sort model or the shared H-scroll offset changes.
      this.bind(
        () => this.sort(),
        () => undefined,
      );
      this.bind(
        () => this.indent(),
        () => undefined,
      );
    });
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
   * Draw the header row: blank it in the header colour, then each title left-aligned with a right-edge
   * `│` divider. A sorted column reserves its last cell(s) for the indicator — one cell for a single
   * sort (the arrow), two for a multi-key sort (a 1-based priority digit + the arrow) — so the
   * indicator is never truncated even when the title fills the width.
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

    ctx.fill(' ', header);
    for (let c = 0; c < this.columns.length; c += 1) {
      const col = this.columns[c];
      const w = geom.widths[c];
      const x = geom.starts[c] - indent;
      const sorted = rank.get(this.columnIds[c]);
      if (sorted !== undefined && w > 0) {
        // Reserve 1 cell (single sort) or 2 (multi), clamped to the column width; the title clips into
        // what remains but the arrow — drawn last — is never overwritten.
        const reserve = Math.min(multi ? 2 : 1, w);
        ctx.text(x, 0, alignCell(col.title, Math.max(0, w - reserve), 'left', stringWidth), header);
        if (multi && w >= 2) ctx.text(x + w - 2, 0, String(sorted.priority + 1), header);
        ctx.text(x + w - 1, 0, sorted.dir === 'asc' ? SORT_ASC : SORT_DESC, header);
      } else {
        ctx.text(x, 0, alignCell(col.title, w, 'left', stringWidth), header);
      }
      ctx.text(x + w, 0, DIVIDER, divider); // divider at the column right edge
    }
  }

  /**
   * A header click maps its content-space x to a column and reports the click (Ctrl ⇒ additive). A
   * click on a divider or past the last column is ignored — no sort change, and the event is left
   * unhandled so it can fall through.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse' || inner.kind !== 'down') return;
    const local = ev.local;
    if (local === undefined) return;
    const geom = this.geometry(this.bounds.width);
    const indent = this.clampedIndent(geom, this.bounds.width);
    const c = columnAtX(geom, local.x + indent);
    if (c >= 0) {
      this.onHeaderClick(this.columnIds[c], inner.ctrl === true);
      ev.handled = true;
    }
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
