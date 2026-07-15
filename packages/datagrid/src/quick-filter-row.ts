/**
 * `QuickFilterRow<T>` — the opt-in, one-cell-tall band of live text inputs (one per column) that sits
 * between the sticky header and the body. Typing into a column's input drives a `contains` text filter
 * for that column; emptying the input clears it. The band shares the body's column geometry
 * (`apportionColumns`) and its horizontal-scroll `indent`, so each input stays under its column's title
 * and pans with the body — an input scrolled off the left edge is clipped away by the band's bounds.
 *
 * It is a passive `Group` whose only children are the inputs; the container owns the filter model that
 * `onQuickFilter` writes into.
 */
import { Group, Input, apportionColumns, signal, untrack } from '@jsvision/ui';
import type { Column, Signal } from '@jsvision/ui';

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
  /** One text input per column, parallel to `columns` (also this group's children, in column order). */
  private readonly inputs: Input[];

  /**
   * @param cfg The shared band configuration (columns, ids, geometry, indent, and the filter-text sink).
   */
  constructor(cfg: QuickFilterRowConfig<T>) {
    super();
    this.columns = cfg.columns;
    this.columnIds = cfg.columnIds;
    this.autoWidths = cfg.autoWidths;
    this.indent = cfg.indent;
    this.onQuickFilter = cfg.onQuickFilter;
    this.inputs = this.columns.map(() => new Input({ value: signal('') }));
    for (const input of this.inputs) this.add(input);

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
   * Place each input under its column: an absolute rect at `{ x: starts[c] - indent, y: 0, width:
   * widths[c] - 1 }` — one cell narrower than the column so the divider column shows through. A
   * negative x pans the input off the left edge, where the band's bounds clip it.
   */
  private reposition(): void {
    const width = this.bounds.width;
    if (width <= 0) return;
    const geom = apportionColumns(this.columns, this.autoWidths(), width);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    this.inputs.forEach((input, c) => {
      const x = geom.starts[c] - indent;
      const w = Math.max(0, geom.widths[c] - 1);
      input.layout = { position: 'absolute', rect: { x, y: 0, width: w, height: 1 } };
    });
  }
}
