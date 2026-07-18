/**
 * The pure, view-free filter model for `@jsvision/datagrid`: the per-column filter conditions, the
 * predicate each derives, and the pure `filterRows` evaluator every filter path (quick-filter row,
 * condition popup, value-list, imperative API, client re-filter) shares.
 *
 * Like the sort model this module holds no view state and no signals — callers pass a plain row
 * snapshot, so every function is deterministic and directly unit-testable. Most filters evaluate a
 * column's TYPED value (from `GridColumn.value`); the exceptions are text ops and the value-list,
 * which match the FORMATTED display label — what the user sees and types — so a "contains" search
 * behaves like a spreadsheet's quick filter rather than matching a raw object or number.
 */
import type { CalendarDate } from '@jsvision/ui';
import type { GridColumn } from './column.js';

/**
 * A single column's filter condition. `text` ops and `set` match the formatted display label;
 * `number`/`date` evaluate the typed value (and fail closed on a mismatch or nil); `custom` receives
 * the typed value directly. Date operands are civil {@link CalendarDate} values (the shape the
 * `DatePicker` and the `date` cell editor already use).
 */
export type ColumnFilter<V = unknown> =
  | { readonly kind: 'set'; readonly selected: ReadonlySet<string> }
  | { readonly kind: 'text'; readonly op: 'contains' | 'startsWith' | 'endsWith' | 'equals'; readonly value: string }
  | { readonly kind: 'number'; readonly op: 'gt' | 'lt' | 'between' | 'eq'; readonly a: number; readonly b?: number }
  | {
      readonly kind: 'date';
      readonly op: 'before' | 'after' | 'between' | 'on';
      readonly a: CalendarDate;
      readonly b?: CalendarDate;
    }
  | { readonly kind: 'custom'; readonly predicate: (value: V, row: unknown) => boolean };

/**
 * The active per-column filters, keyed by `GridColumn.id`. A row survives only if it satisfies every
 * entry (they combine with AND). Row-type-agnostic — each `ColumnFilter` reads its own column's value,
 * so the model itself carries no row type.
 */
export type FilterModel = ReadonlyMap<string, ColumnFilter>;

/**
 * The distinct-value enumeration a value-list popup consumes: the formatted labels plus whether the
 * source capped the list (so the popup can disclose truncation instead of silently under-reporting).
 */
export interface DistinctResult {
  /** The distinct formatted labels. */
  readonly values: readonly string[];
  /** `true` when the source truncated the list (a bounded/windowed distinct query). */
  readonly truncated?: boolean;
}

/** The filter type a column presents in the condition popup — its operator family. */
export type FilterType = 'text' | 'number' | 'date';

/**
 * The one case-insensitive collator the label sort uses, built lazily and memoized. `sensitivity:
 * 'accent'` makes letter case tie while keeping accents distinct — the twin of the sort model's
 * collator, kept local so the pure filter module stays independent of the sort module.
 */
let cachedCollator: Intl.Collator | undefined;
function collator(): Intl.Collator {
  return (cachedCollator ??= new Intl.Collator(undefined, { sensitivity: 'accent', numeric: false }));
}

/**
 * The formatted display label for a value — the single "what the user sees" string that text
 * matching, set membership, and distinct enumeration all agree on. A nil value maps to `''`, so a
 * distinct list carries one empty entry and selecting `''` keeps the nil rows.
 */
function displayLabel<T>(value: unknown, row: T, col: GridColumn<T>): string {
  if (value === null || value === undefined) return '';
  return col.format ? col.format(value, row) : String(value);
}

/** Whether a value is a civil-date record (`{ year, month, day }` with numeric fields). */
function isCalendarDate(v: unknown): v is CalendarDate {
  if (typeof v !== 'object' || v === null) return false;
  const rec = v as Record<string, unknown>;
  return typeof rec.year === 'number' && typeof rec.month === 'number' && typeof rec.day === 'number';
}

/**
 * A day key `year*10000 + month*100 + day` for a JS `Date` (local-time fields) or a `CalendarDate`,
 * or `null` for a nil / non-date value so a date filter fails closed rather than coercing. The key
 * compares two dates by calendar day, ignoring any time-of-day on a JS `Date`.
 */
function dateOrdinal(v: unknown): number | null {
  if (v instanceof Date) return v.getFullYear() * 10000 + (v.getMonth() + 1) * 100 + v.getDate();
  if (isCalendarDate(v)) return v.year * 10000 + v.month * 100 + v.day;
  return null;
}

/**
 * Derive a boolean predicate for one column filter. Text ops fold case and match the formatted label;
 * number/date read the typed value and fail closed on a mismatch or nil; set checks label membership;
 * custom calls the supplied predicate with the typed value and the row. A `between` with `b` omitted
 * is a degenerate one-point range (`b` defaults to `a`).
 */
function filterPredicate<T>(filter: ColumnFilter, col: GridColumn<T>): (row: T) => boolean {
  switch (filter.kind) {
    case 'text': {
      const needle = filter.value.toLowerCase();
      const { op } = filter;
      return (row) => {
        const hay = displayLabel(col.value(row), row, col).toLowerCase();
        if (op === 'contains') return hay.includes(needle);
        if (op === 'startsWith') return hay.startsWith(needle);
        if (op === 'endsWith') return hay.endsWith(needle);
        return hay === needle; // 'equals' — whole-label equality
      };
    }
    case 'number': {
      const { op, a } = filter;
      const b = filter.b ?? a;
      return (row) => {
        const v = col.value(row);
        if (typeof v !== 'number') return false; // fail closed on a non-numeric value
        if (op === 'gt') return v > a;
        if (op === 'lt') return v < a;
        if (op === 'eq') return v === a;
        return v >= a && v <= b; // 'between' — inclusive bounds
      };
    }
    case 'date': {
      const a = dateOrdinal(filter.a);
      const b = filter.b !== undefined ? dateOrdinal(filter.b) : a;
      const { op } = filter;
      return (row) => {
        const v = dateOrdinal(col.value(row));
        if (v === null || a === null) return false; // nil / non-date value or operand → no match
        if (op === 'before') return v < a;
        if (op === 'after') return v > a;
        if (op === 'on') return v === a;
        return b !== null && v >= a && v <= b; // 'between' — inclusive by day
      };
    }
    case 'set': {
      const { selected } = filter;
      return (row) => selected.has(displayLabel(col.value(row), row, col));
    }
    case 'custom': {
      const { predicate } = filter;
      return (row) => predicate(col.value(row), row);
    }
  }
}

/**
 * Keep the rows that satisfy EVERY active column filter (they combine with AND). Filters whose
 * `columnId` is absent from `columns` are dropped (never evaluated), matching the sort model. Never
 * mutates `rows`; an empty (or all-unknown) model returns a fresh copy in source order.
 *
 * @param rows The row snapshot to filter (not mutated).
 * @param model The active per-column filters, keyed by `GridColumn.id`.
 * @param columns The column model, keyed by `GridColumn.id`, providing each filter's `value` accessor
 *   and optional `format`.
 * @returns A new array of the surviving rows, in source order.
 * @example
 * ```ts
 * import { column, filterRows } from '@jsvision/datagrid';
 * import type { ColumnFilter } from '@jsvision/datagrid';
 * interface Sale { region: string; qty: number; }
 * const columns = [
 *   column({ id: 'region', title: 'Region', value: (r: Sale) => r.region }),
 *   column({ id: 'qty', title: 'Qty', value: (r: Sale) => r.qty }),
 * ];
 * const model = new Map<string, ColumnFilter>([
 *   ['region', { kind: 'text', op: 'contains', value: 'ea' }],
 *   ['qty', { kind: 'number', op: 'between', a: 100, b: 500 }],
 * ]);
 * const kept = filterRows(rows, model, new Map(columns.map((c) => [c.id, c])));
 * ```
 */
export function filterRows<T>(
  rows: readonly T[],
  model: FilterModel,
  columns: ReadonlyMap<string, GridColumn<T>>,
): T[] {
  const active: ((row: T) => boolean)[] = [];
  for (const [columnId, filter] of model) {
    const col = columns.get(columnId);
    if (col !== undefined) active.push(filterPredicate(filter, col)); // unknown column → dropped
  }
  if (active.length === 0) return [...rows];
  return rows.filter((row) => active.every((pass) => pass(row)));
}

/**
 * The sorted distinct formatted labels for a column over a row snapshot — the grid-owned client
 * distinct enumeration. Dedups `format(value)` across the rows (a nil value contributes one `''`
 * entry) and sorts by the shared case-insensitive collator. Never truncates; the caller wraps the
 * result as `{ values, truncated: false }`.
 *
 * @param rows The row snapshot to scan.
 * @param col The column whose distinct labels to enumerate.
 * @returns The distinct labels, sorted case-insensitively.
 * @example
 * ```ts
 * import { column, computeDistinct } from '@jsvision/datagrid';
 * interface Sale { region: string; }
 * const region = column({ id: 'region', title: 'Region', value: (r: Sale) => r.region });
 * const labels = computeDistinct(rows, region); // e.g. ['east', 'north', 'west']
 * ```
 */
export function computeDistinct<T>(rows: readonly T[], col: GridColumn<T>): string[] {
  const labels = new Set<string>();
  for (const row of rows) labels.add(displayLabel(col.value(row), row, col));
  return [...labels].sort((a, b) => collator().compare(a, b));
}

/**
 * The filter type a column presents in the condition popup: `col.filterType` when set, else inferred
 * from a sampled non-null value — `number` for a number, `date` for a JS `Date` or a `CalendarDate`,
 * otherwise `text`. Extends the sort model's runtime detection with the `CalendarDate → date` branch
 * a `DatePicker` operand needs.
 *
 * @param col The column to resolve a filter type for.
 * @param sample A representative non-null value from the column (used only when no explicit override).
 * @returns The resolved {@link FilterType}.
 */
export function resolveFilterType<T>(col: GridColumn<T>, sample: unknown): FilterType {
  if (col.filterType !== undefined) return col.filterType;
  if (typeof sample === 'number') return 'number';
  if (sample instanceof Date || isCalendarDate(sample)) return 'date';
  return 'text';
}
