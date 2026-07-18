/**
 * The footer's configuration surface and its controller — the summary-layer twin of the selection and
 * row-mutation controllers.
 *
 * {@link GridFooter} is what the caller declares on the grid's `footer` option: the column aggregates,
 * the free-form widget row, and the (reserved) sticky flag. {@link FooterController} is the internal
 * glue: it validates the declared aggregates against the real columns at construction (dropping unknown
 * columns and invalid reductions with a dev warning) and folds each surviving aggregate **lazily** over
 * the grid's displayed rows. Like the selection/row-mutation controllers it holds **no** reactive
 * `computed`; the reactive memo lives in the footer band's data-bound repaint, so this stays pure state.
 */
import type { View } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import type { AggregateSpec } from './aggregate.js';
import { foldAggregate, formatAggregate, isAggregateFn } from './aggregate.js';
import { devWarn } from './dev.js';

/**
 * The footer configuration a caller passes to the grid's `footer` option: a row of column-aligned
 * aggregates and/or a row of free-form widgets.
 */
export interface GridFooter {
  /**
   * Keep the footer visible while the body scrolls. Defaults to `true`; v1 footers are always sticky (the
   * fixed-band layout gives it for free), so a `false` here is reserved — it is treated as `true` with a
   * dev warning until a non-sticky/inline footer ships.
   */
  readonly sticky?: boolean;
  /**
   * Per-column aggregates, keyed by `columnId`. Each renders a total aligned under its column, folded
   * over the displayed rows. An entry whose key is not a known column, or whose `fn` is not a built-in
   * reduction, is ignored (with a dev warning).
   */
  readonly aggregates?: Record<string, AggregateSpec>;
  /**
   * A free-form widget row — any `View`s (totals `Text`, command `Button`s, the reactive "N of M" and
   * selection-count read-outs), laid out in a flow row spanning the footer band.
   */
  readonly widgets?: readonly View[];
}

/** Construction config for {@link FooterController}. */
export interface FooterControllerConfig<T> {
  /** The caller's declared footer configuration. */
  readonly footer: GridFooter;
  /** The grid's typed columns, keyed by id — the aggregate keys are validated against this set. */
  readonly columns: ReadonlyMap<string, GridColumn<T>>;
  /** The reactive displayed-rows accessor the folds run over. */
  readonly displayedRows: () => readonly T[];
  /** The source completeness predicate (absent ⇒ complete) — feeds the `"(loaded)"` honesty qualifier. */
  readonly complete?: () => boolean;
  /**
   * Whether the source is windowed. A windowed aggregate cell renders **blank** (the live loaded-window
   * fold is deferred: there is no cheap loaded-range seam, and folding via `rowAt` would page-fault). The
   * eager partially-loaded `"(loaded)"` fold is unaffected.
   */
  readonly windowed?: boolean;
}

/**
 * The footer's internal controller: validated aggregate specs plus the lazy per-column fold. It owns no
 * reactive state — `cell` reads the live displayed rows on demand, and the footer band binds that read to
 * its data dependencies for a memo-equivalent repaint.
 */
export class FooterController<T> {
  private readonly columns: ReadonlyMap<string, GridColumn<T>>;
  private readonly displayedRows: () => readonly T[];
  private readonly complete?: () => boolean;
  private readonly windowed: boolean;
  /** Whether the one-time windowed-footer warning has fired (de-duped across columns). */
  private warnedWindowed = false;
  /** The surviving aggregate specs, keyed by column id (unknown columns / invalid fns dropped). */
  private readonly specs = new Map<string, AggregateSpec>();

  /** @param cfg The declared footer, the columns to validate against, the displayed rows, and completeness. */
  constructor(cfg: FooterControllerConfig<T>) {
    this.columns = cfg.columns;
    this.displayedRows = cfg.displayedRows;
    this.complete = cfg.complete;
    this.windowed = cfg.windowed ?? false;
    for (const [columnId, spec] of Object.entries(cfg.footer.aggregates ?? {})) {
      if (!this.columns.has(columnId)) {
        devWarn('footer', `aggregate for unknown column "${columnId}" ignored`);
        continue;
      }
      if (!isAggregateFn(spec.fn)) {
        devWarn('footer', `aggregate for column "${columnId}" has an unknown fn "${spec.fn}" — ignored`);
        continue;
      }
      this.specs.set(columnId, spec);
    }
    if (cfg.footer.sticky === false) {
      devWarn('footer', 'a non-sticky footer is not available yet — the footer is rendered sticky');
    }
  }

  /** Whether any valid aggregate survived validation (⇒ the grid builds the aggregate row). */
  get hasAggregates(): boolean {
    return this.specs.size > 0;
  }

  /**
   * The rendered aggregate text for a column, folded on demand over the displayed rows: `''` when the
   * column has no valid aggregate, otherwise `formatAggregate(spec, foldAggregate(...), partial)` with the
   * `"(loaded)"` qualifier when the source is not fully loaded. Reading it inside a reactive scope
   * subscribes to the displayed rows (the footer band does exactly that).
   *
   * @param columnId The column to fold.
   * @returns The aggregate cell text, or `''` when the column has no aggregate.
   */
  cell(columnId: string): string {
    const spec = this.specs.get(columnId);
    if (spec === undefined) return '';
    if (this.windowed) {
      // The live fold is deferred for a windowed source — render blank (never a folded '0'), warning once.
      if (!this.warnedWindowed) {
        devWarn('windowed-footer', 'aggregates over a windowed source are not computed yet — the cell is left blank.');
        this.warnedWindowed = true;
      }
      return '';
    }
    const col = this.columns.get(columnId)!;
    const values = this.displayedRows().map((row) => col.value(row));
    const result = foldAggregate(spec.fn, values);
    const partial = this.complete?.() === false;
    return formatAggregate(spec, result, partial);
  }
}
