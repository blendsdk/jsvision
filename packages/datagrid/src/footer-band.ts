/**
 * `FooterBand` — the passive, non-focusable painter for one panel's row of column-aligned footer
 * aggregate cells, the footer twin of the header/body bands.
 *
 * It reuses the exact shared geometry the body and header use — `apportionColumns` then `alignCell` per
 * column, drawn at `x = starts[c] - indent` — so an aggregate cell lands directly under its column and
 * pans in lockstep with the body across a frozen/scrolling split (a frozen segment binds a constant `0`
 * indent, the center binds the shared one). Its cell text comes from an injected `cell(columnId)`
 * accessor (the footer controller's on-demand fold). The fold runs once per DATA change — the band binds
 * it to its data dependencies and caches the result — so a repaint (e.g. a live column resize) never
 * re-folds.
 */
import { View, alignCell, apportionColumns, stringWidth } from '@jsvision/ui';
import type { Column, DrawContext, Signal } from '@jsvision/ui';

/** The inter-column rule glyph, matching the body's dividers. */
const DIVIDER = '│';

/** Construction config for {@link FooterBand}. */
export interface FooterBandConfig<T> {
  /** The engine columns for this panel's slice (provides each cell's width kind and alignment). */
  readonly columns: Column<T>[];
  /** The column ids parallel to {@link columns} — the key each cell's aggregate text is looked up by. */
  readonly columnIds: string[];
  /** The per-slice auto-width measurement (reactive), reindexed to this slice's order. */
  readonly autoWidths: () => (number | null)[];
  /** The shared horizontal scroll offset for this panel (`0` for a frozen panel; the shared one for center). */
  readonly indent: Signal<number>;
  /** Compact density — drop the reserved inter-column divider cell so the band apportions like the body. */
  readonly compact: boolean;
  /** Reactive live-resize trigger — repaint (re-apportion) on a column resize without re-folding. */
  readonly widthTick: () => unknown;
  /** The aggregate cell text for a column id (the controller's fold); `''` for a column with no aggregate. */
  readonly cell: (columnId: string) => string;
}

/**
 * A single-row band painting one panel's footer aggregate cells, aligned to their columns. Passive and
 * non-focusable — it mirrors the body's geometry but never takes the keyboard.
 *
 * @example
 * ```ts
 * import { signal } from '@jsvision/ui';
 * import { FooterBand } from '@jsvision/datagrid';
 *
 * interface Row { qty: number }
 * const columns = [{ title: 'Qty', accessor: (r: Row) => String(r.qty), width: 6 }];
 * const columnIds = ['qty'];
 * const totals: Record<string, string> = { qty: '42' };
 * // Built by the grid per frozen/scrolling segment; a bespoke `cell` supplies each column's aggregate text:
 * const band = new FooterBand({
 *   columns,
 *   columnIds,
 *   autoWidths: () => [null],
 *   indent: signal(0),
 *   compact: false,
 *   widthTick: () => 0,
 *   cell: (id) => totals[id] ?? '',
 * });
 * ```
 */
export class FooterBand<T> extends View {
  override focusable = false;
  private readonly columns: Column<T>[];
  private readonly columnIds: string[];
  private readonly autoWidths: () => (number | null)[];
  private readonly indent: Signal<number>;
  private readonly dividers: boolean;
  private readonly widthTick: () => unknown;
  private readonly cellText: (columnId: string) => string;
  /** The folded aggregate text per column, cached from the data-bind so `draw()` never re-folds. */
  private cache: string[] = [];

  /** @param cfg The column slice, geometry inputs, resize trigger, and the aggregate-cell accessor. */
  constructor(cfg: FooterBandConfig<T>) {
    super();
    this.columns = cfg.columns;
    this.columnIds = cfg.columnIds;
    this.autoWidths = cfg.autoWidths;
    this.indent = cfg.indent;
    this.dividers = cfg.compact !== true;
    this.widthTick = cfg.widthTick;
    this.cellText = cfg.cell;
    this.onMount(() => {
      // Re-fold once per data change: reading each cell's aggregate text subscribes this effect to the
      // grid's displayed rows (and the edit `version` tick behind them). The result is cached for draw().
      this.bind(
        () => this.columnIds.map((id) => this.cellText(id)),
        (texts) => {
          this.cache = texts;
        },
      );
      // Live-resize repaint only — never re-folds; draw() re-apportions using the cached texts.
      this.bind(
        () => this.widthTick(),
        () => undefined,
      );
      // Horizontal-scroll repaint: pan the aggregate cells in lockstep with the body (a center panel's
      // shared indent changes as the columns scroll). Invalidate-only — the fold is unaffected.
      this.bind(
        () => this.indent(),
        () => undefined,
      );
    });
  }

  draw(ctx: DrawContext): void {
    const width = ctx.size.width;
    const style = ctx.color('tableHeader'); // the summary strip reads like a banded header
    ctx.fill(' ', style);
    if (this.columns.length === 0) return;
    const geom = apportionColumns(this.columns, this.autoWidths(), width, this.dividers);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const dividerStyle = ctx.color('listDivider');
    for (let c = 0; c < this.columns.length; c += 1) {
      const col = this.columns[c];
      const w = geom.widths[c];
      const x = geom.starts[c] - indent;
      const text = alignCell(this.cache[c] ?? '', w, col.align ?? 'left', stringWidth);
      ctx.text(x, 0, text, style); // ctx clips off-screen cells (horizontal scroll)
      if (this.dividers) ctx.text(x + w, 0, DIVIDER, dividerStyle);
    }
  }
}
