/**
 * `QuickFilterRow<T>` — the opt-in, one-cell-tall band of live text inputs (one per filterable column)
 * that sits between the sticky header and the body. Typing into a column's input drives a `contains`
 * text filter for that column; emptying the input clears it. A column that opts out of filtering
 * (`filterable: false`) has a blank slot instead of an input, and the surviving inputs stay aligned
 * under their columns. The band shares the body's column geometry
 * (`apportionColumns`) and its horizontal-scroll `indent`, so each input stays under its column's title
 * and pans with the body — an input scrolled off the left edge is clipped away by the band's bounds.
 *
 * It is a passive `Group`: its children are the per-column inputs, and it paints the inter-column `│`
 * divider at each column's right edge so the band lines up with the header and body (which draw the same
 * divider) instead of leaving a stray gap between columns. The container owns the filter model that
 * `onQuickFilter` writes into.
 */
import { Group, Input, apportionColumns, signal, untrack } from '@jsvision/ui';
import type { Column, Signal, DrawContext } from '@jsvision/ui';

/** The inter-column `│` drawn at each column's right edge — matches the header + body divider glyph. */
const DIVIDER = '│';

/** Construction config for {@link QuickFilterRow}. */
export interface QuickFilterRowConfig<T> {
  /** The engine columns — shared with the header + body so geometry never disagrees. */
  columns: Column<T>[];
  /** Column ids parallel to `columns` (index → columnId). */
  columnIds: readonly string[];
  /** The memoized `auto`-width measurement (shared with the header + body). */
  autoWidths: () => (number | null)[];
  /** The horizontal cell offset (shared — the band pans in lockstep with header and body). */
  indent: Signal<number>;
  /**
   * Reports a column's live quick-filter text. An **empty** string means "clear this column's filter"
   * — never an empty-needle `contains`, which would match every row.
   */
  onQuickFilter: (columnId: string, text: string) => void;
  /**
   * Compact density (default `false`): no reserved inter-column divider cell, so each input fills its
   * column's full width and the band stays aligned with a compact header/body.
   */
  compact?: boolean;
  /**
   * Per-column filterability, parallel to `columns` (index → filterable). A `false` entry omits that
   * column's input entirely — a blank, non-interactive slot — while the surrounding inputs keep their
   * positions under their columns. Omit to make every column filterable.
   */
  filterable?: boolean[];
}

/**
 * The datagrid's opt-in quick-filter band — see the module overview.
 *
 * @example
 * import { signal } from '@jsvision/ui';
 * import { QuickFilterRow } from '@jsvision/datagrid';
 *
 * const band = new QuickFilterRow({
 *   columns: [{ title: 'Name', accessor: (r) => String(r.name), width: 12 }],
 *   columnIds: ['name'],
 *   autoWidths: () => [null],
 *   indent: signal(0),
 *   onQuickFilter: (id, text) => { console.log('filter', id, 'contains', text); },
 * });
 * // Share `autoWidths`/`indent` with the SortHeader + body so the inputs line up under their columns.
 */
export class QuickFilterRow<T> extends Group {
  private readonly columns: Column<T>[];
  private readonly columnIds: readonly string[];
  private readonly autoWidths: () => (number | null)[];
  private readonly indent: Signal<number>;
  private readonly onQuickFilter: (columnId: string, text: string) => void;
  /** Whether a divider cell is reserved between columns (`false` in compact density). */
  private readonly dividers: boolean;
  /**
   * One slot per column, parallel to `columns`: a live `Input` for a filterable column, or `null` for a
   * non-filterable one. The non-null inputs are this group's children, in column order. Keeping the array
   * index-parallel to `columns` (rather than compacting out the gaps) is what keeps every surviving
   * input aligned under its title when an earlier column opts out — `reposition` and the filter wiring
   * both index by column position.
   */
  private readonly inputs: (Input | null)[];

  /**
   * @param cfg The shared band configuration (columns, ids, geometry, indent, and the filter-text sink).
   */
  constructor(cfg: QuickFilterRowConfig<T>) {
    super();
    this.columns = cfg.columns;
    this.columnIds = cfg.columnIds;
    this.autoWidths = cfg.autoWidths;
    this.dividers = cfg.compact !== true;
    this.indent = cfg.indent;
    this.onQuickFilter = cfg.onQuickFilter;
    // A `filterable: false` column gets a null slot (no input); every other column gets a live Input.
    // The array stays index-parallel to `columns` so positions never shift when a column opts out.
    const filterable = cfg.filterable;
    this.inputs = this.columns.map((_, c) => (filterable?.[c] === false ? null : new Input({ value: signal('') })));
    for (const input of this.inputs) if (input) this.add(input);

    this.onMount(() => {
      // Position the inputs (bounds are valid by onMount), then re-position whenever the shared
      // H-scroll offset or the measured column widths change. `relayout` applies the new child rects.
      this.bind(
        () => {
          this.indent();
          this.autoWidths();
        },
        () => this.reposition(),
        { relayout: true },
      );
      // Wire each input's text to the filter sink. Skip the initial (empty) fire: a fresh input must
      // not clear a filter that another surface (a popup) set on the column before this band mounted.
      // The sink mutates the container's filter model, so it runs UNTRACKED — otherwise its reads (the
      // display / cursor signals inside the container's re-anchor) would join this effect's
      // dependencies while it writes them, and the reactive graph would never converge.
      this.inputs.forEach((input, c) => {
        if (!input) return; // non-filterable column: no input, nothing to wire
        const value = input.getValueSignal();
        let first = true;
        this.bind(
          () => value(),
          (text) => {
            if (first) {
              first = false;
              return;
            }
            untrack(() => this.onQuickFilter(this.columnIds[c], text));
          },
        );
      });
    });
  }

  /**
   * Place each input under its column, clipped to the band's viewport. The column's natural span is
   * `[starts[c] - indent, starts[c] - indent + widths[c])` (`widths[c]` excludes the inter-column
   * divider cell, which `apportionColumns` reserves separately, so the input is flush with its header
   * title and the in-cell editor below it). Absolute rects cannot have a negative origin — the layout
   * engine clamps a negative `x` to `0` — so a column scrolled partly off the left is placed at the
   * viewport's left edge with its width shrunk by the clipped amount, rather than at a negative `x` that
   * would pin to `0` and overlap the next column. The band's bounds clip the right edge, and a column
   * scrolled entirely off the left collapses to width `0` (renders nothing). The `dividers` flag only
   * selects the apportionment, keeping the band aligned with a normal or compact header/body.
   */
  private reposition(): void {
    const width = this.bounds.width;
    if (width <= 0) return;
    const geom = apportionColumns(this.columns, this.autoWidths(), width, this.dividers);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    this.inputs.forEach((input, c) => {
      if (!input) return; // non-filterable column: blank slot, nothing to place
      const left = geom.starts[c] - indent; // natural left edge, negative when scrolled off the left
      const x = Math.max(0, left); // clip to the viewport's left edge (no negative absolute x)
      const w = Math.max(0, left + geom.widths[c] - x); // shrink by the clipped amount; bounds clip the right
      input.layout = { position: 'absolute', rect: { x, y: 0, width: w, height: 1 } };
    });
  }

  /**
   * Paint the inter-column `│` divider at each column's right edge, so the band matches the header and
   * body (which draw the same divider). The inputs are composited over this layer by the render root and
   * cover only their columns' content cells; the reserved divider cell between them is left for this to
   * fill — without it that one cell shows the layer behind as a stray gap (the "empty block" between
   * columns). The shared `indent` is applied for symmetry with the header/body, and off-viewport cells
   * are clipped by the band bounds. Skipped in compact density, which reserves no divider cell.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    super.draw(ctx); // fill the group background if one is set (children composite above this layer)
    if (!this.dividers) return; // compact density: no reserved divider cell, so nothing to draw
    const width = ctx.size.width;
    const geom = apportionColumns(this.columns, this.autoWidths(), width, this.dividers);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const divider = ctx.color('listDivider');
    for (let c = 0; c < this.columns.length; c += 1) {
      const x = geom.starts[c] + geom.widths[c] - indent; // the reserved divider cell (right of the column)
      if (x >= 0 && x < width) ctx.text(x, 0, DIVIDER, divider);
    }
  }
}
