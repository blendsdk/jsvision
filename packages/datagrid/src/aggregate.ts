/**
 * The pure, view-free aggregate model for `@jsvision/datagrid` — the twin of the sort and filter
 * models. It owns the aggregate **descriptor** ({@link AggregateSpec}), the edge-safe **fold**
 * ({@link foldAggregate}), the **cell-text renderer** ({@link formatAggregate}, including the honesty
 * qualifier), and a config-time **guard** ({@link isAggregateFn}).
 *
 * There are no signals and no views here: callers pass a plain snapshot of a column's values, so every
 * function is deterministic and directly unit-testable. The footer controller invokes these lazily over
 * the grid's displayed rows; the reactive repaint lives in the footer view, not in this module.
 */

/** The built-in reductions a footer aggregate can apply to a column. */
export type AggregateFn = 'sum' | 'avg' | 'min' | 'max' | 'count';

/**
 * A per-column footer aggregate. `fn` reduces the column's typed `value` across the displayed rows;
 * `format` renders the numeric result (e.g. a currency `Intl` formatter); `label` is an optional static
 * prefix (e.g. `'Σ'`, `'Avg:'`). The rendered cell text is `"[label ][formatted result][ (loaded)]"`,
 * where the trailing `" (loaded)"` appears only when the source is not fully loaded.
 */
export interface AggregateSpec {
  /** The reduction to apply. */
  readonly fn: AggregateFn;
  /** Render the numeric fold result to display text; defaults to `String(v)` when omitted. */
  readonly format?: (v: number) => string;
  /** An optional static prefix placed before the value (e.g. `'Σ'`). */
  readonly label?: string;
}

/** The known reductions, as a set, for the config-time guard. */
const AGGREGATE_FNS: ReadonlySet<string> = new Set<AggregateFn>(['sum', 'avg', 'min', 'max', 'count']);

/**
 * Type guard: whether `fn` names a known {@link AggregateFn}. Used at the footer config boundary to
 * drop an aggregate whose `fn` is not one of the built-in reductions (rather than fold with it).
 *
 * @param fn The candidate reduction name.
 * @returns `true` (narrowing `fn` to {@link AggregateFn}) when it is a known reduction.
 * @example
 * ```ts
 * import { isAggregateFn } from '@jsvision/datagrid';
 * isAggregateFn('sum');    // true
 * isAggregateFn('median'); // false
 * ```
 */
export function isAggregateFn(fn: string): fn is AggregateFn {
  return AGGREGATE_FNS.has(fn);
}

/**
 * Reduce `values` (one per displayed row — the column's typed `value(row)`) by `fn`.
 *
 * The numeric folds (`sum`/`avg`/`min`/`max`) include a value only when it is a finite number
 * (`typeof value === 'number' && Number.isFinite(value)`) — `null`/`undefined`/`NaN`/`±Infinity` and
 * any non-number are skipped, so one bad cell never poisons the total to `NaN`. `count` counts every
 * row (all `values`), null or not. `avg` divides by the count of the finite contributors only.
 *
 * @param fn The reduction to apply.
 * @param values The column's values across the displayed rows (any type; non-finite entries are skipped
 *   by the numeric folds).
 * @returns The numeric result, or `undefined` for an empty contributor set on `avg`/`min`/`max` (which
 *   the renderer paints as a blank cell). `sum` and `count` of an empty set return `0`.
 * @example
 * ```ts
 * import { foldAggregate } from '@jsvision/datagrid';
 * foldAggregate('sum', [10, 20, null, 30]);       // 60  (null skipped)
 * foldAggregate('avg', [10, 20, null]);            // 15  (30 / 2 finite)
 * foldAggregate('max', []);                        // undefined → blank cell
 * foldAggregate('count', [1, null, 3]);            // 3   (counts rows)
 * ```
 */
export function foldAggregate(fn: AggregateFn, values: Iterable<unknown>): number | undefined {
  if (fn === 'count') {
    let rows = 0;
    for (const _value of values) rows += 1;
    return rows;
  }
  // Numeric folds: only finite numbers contribute. One pass accumulates every reduction so the caller
  // pays a single traversal regardless of `fn`.
  let sum = 0;
  let contributors = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    sum += value;
    contributors += 1;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  switch (fn) {
    case 'sum':
      return sum; // empty set → 0
    case 'avg':
      return contributors > 0 ? sum / contributors : undefined;
    case 'min':
      return contributors > 0 ? min : undefined;
    case 'max':
      return contributors > 0 ? max : undefined;
  }
}

/**
 * Render an aggregate cell's text: `"[label ][format(v) ?? String(v)]"`, with a trailing `" (loaded)"`
 * honesty qualifier appended when `partial` is true and the value is present. A `v === undefined`
 * (an empty `avg`/`min`/`max`) renders a **blank** cell — even with a label — so a footer never shows a
 * bare prefix with no number.
 *
 * @param spec The aggregate descriptor supplying the optional `format` and `label`.
 * @param v The fold result, or `undefined` for an empty numeric contributor set.
 * @param partial `true` when the source is not fully loaded (the total is over the loaded set only); it
 *   appends the `" (loaded)"` qualifier so the number is never passed off as a whole-dataset grand total.
 * @returns The cell text, or `''` when `v` is `undefined`.
 * @example
 * ```ts
 * import { formatAggregate } from '@jsvision/datagrid';
 * formatAggregate({ fn: 'sum', format: (v) => `$${v.toFixed(2)}`, label: 'Σ' }, 60, false); // "Σ $60.00"
 * formatAggregate({ fn: 'sum', label: 'Σ' }, 60, true);   // "Σ 60 (loaded)"  (partial source)
 * formatAggregate({ fn: 'max' }, undefined, false);       // ""               (empty → blank)
 * ```
 */
export function formatAggregate(spec: AggregateSpec, v: number | undefined, partial: boolean): string {
  if (v === undefined) return '';
  const prefix = spec.label ? `${spec.label} ` : '';
  const body = spec.format ? spec.format(v) : String(v);
  const qualifier = partial ? ' (loaded)' : '';
  return `${prefix}${body}${qualifier}`;
}
