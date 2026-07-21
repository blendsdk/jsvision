# Filter Model: Filtering

> **Document**: 03-01-filter-model.md
> **Parent**: [Index](00-index.md)

## Overview

The pure, view-free filter model — the structural analog of `sort.ts` (AR #6). Holds no view state
and no signals: callers pass a plain row snapshot, so every function is deterministic and directly
unit-testable. Owns `ColumnFilter`, `FilterModel`, `DistinctResult`, the per-filter predicate
derivation, `filterRows`, `computeDistinct`, and the `resolveFilterType` UI hint. Lives at
`packages/datagrid/src/filter.ts`.

## Architecture

### Current
`FilterModel<T>` is a `{ conditions?; rowType? }` placeholder in `data-source.ts` (`:16`); no
predicates, no evaluator.

### Proposed
Move the real `FilterModel` here; add the `ColumnFilter` union, predicate derivation, and the pure
`filterRows`. `data-source.ts` and `index.ts` import from here — exactly as `SortKey` moved to
`sort.ts` and was re-exported through the barrel. `DistinctResult` also lives here (AR #5) and
`data-source.ts` imports it for the `distinct` seam.

## Implementation Details

### New Types/Interfaces

```ts
/** A single column's filter condition. Text ops match the formatted display; the rest match value. */
export type ColumnFilter<V = unknown> =
  | { kind: 'set'; selected: ReadonlySet<string> }                                   // value-list (formatted labels)
  | { kind: 'text'; op: 'contains' | 'startsWith' | 'endsWith' | 'equals'; value: string }
  | { kind: 'number'; op: 'gt' | 'lt' | 'between' | 'eq'; a: number; b?: number }
  | { kind: 'date'; op: 'before' | 'after' | 'between' | 'on'; a: CalendarDate; b?: CalendarDate }
  | { kind: 'custom'; predicate: (value: V, row: unknown) => boolean };

/** The active per-column filters, keyed by `GridColumn.id`. Combine with AND (AR #8). */
export type FilterModel<T> = ReadonlyMap<string, ColumnFilter>;

/** The widened `distinct` return (AR #5): the labels plus whether the source capped the list. */
export interface DistinctResult {
  readonly values: readonly string[];
  readonly truncated?: boolean;
}

/** The filter type a column presents in the condition popup (AR #14). */
export type FilterType = 'text' | 'number' | 'date';
```

`CalendarDate` is imported from `@jsvision/ui` (the type the `date` cell editor / `DatePicker`
already use).

### New Functions/Methods

```ts
// The display label for a value — the SINGLE source of the "formatted display" (AR #4/#10). Used by
// text matching, set membership, and distinct enumeration so all three agree. A nil value → '' (an
// empty label), so distinct lists it once and selecting '' keeps the nil rows.
function displayLabel<T>(value: unknown, row: T, col: GridColumn<T>): string;

// Derive a boolean predicate for one column filter. Text ops fold case and match `displayLabel`;
// number/date coerce the typed value and fail closed on a type mismatch or nil; set checks
// `selected.has(displayLabel(...))`; custom calls `predicate(value, row)`. Returns (row) => boolean.
function filterPredicate<T>(filter: ColumnFilter, col: GridColumn<T>): (row: T) => boolean;

/**
 * Keep the rows that satisfy EVERY active column filter (AND — AR #8). Filters whose `columnId` is
 * absent from `columns` are dropped (AR #13 / AC-9). Never mutates `rows`; an empty (or all-unknown)
 * model returns a copy in source order.
 */
export function filterRows<T>(
  rows: readonly T[],
  model: FilterModel<T>,
  columns: ReadonlyMap<string, GridColumn<T>>,
): T[];

/**
 * The sorted distinct formatted labels for a column over a row snapshot (the grid-owned client path —
 * AR #9). `[...new Set(rows.map(displayLabel))]` sorted by the shared case-insensitive collator.
 * Never truncates (the caller wraps it as `{ values, truncated: false }`).
 */
export function computeDistinct<T>(rows: readonly T[], col: GridColumn<T>): string[];

/**
 * The filter type a column presents in the condition popup: `col.filterType` when set, else inferred
 * from a sampled non-null value (`number` → 'number', `Date`/`CalendarDate` → 'date', else 'text').
 * Extends `sort.ts`'s runtime type detection — it adds a `CalendarDate → date` branch that the sort
 * comparator (`compareValues`, `sort.ts:42`) has no need for (DatePicker operands are `CalendarDate`).
 */
export function resolveFilterType<T>(col: GridColumn<T>, sample: unknown): FilterType;
```

### Predicate semantics (per `kind`)

| `kind` | Target | Rule |
|--------|--------|------|
| `text` | `displayLabel(value)` folded to lower case | `contains`/`startsWith`/`endsWith` via `String.prototype`; `equals` = whole-label equality. Needle folded too (case-insensitive — AR #4). |
| `number` | the typed value | matches only when `typeof value === 'number'` (else fail closed): `gt` `>a`, `lt` `<a`, `eq` `===a`, `between` `a ≤ value ≤ (b ?? a)` inclusive (AC-2). |
| `date` | day ordinal of value | `dateOrdinal(value)` normalizes a JS `Date` or a `CalendarDate` to a `y*10000+m*100+d` day key; nil / non-date fails closed. `before` `<a`, `after` `>a`, `on` `=a`, `between` `a ≤ v ≤ (b ?? a)`. |
| `set` | `displayLabel(value)` | `selected.has(displayLabel(value))` — membership on the formatted label (AR #10). |
| `custom` | the typed value | `filter.predicate(col.value(row), row)`. |

`displayLabel` = `value == null ? '' : (col.format ? col.format(value, row) : String(value))`. The
string collator reused for `computeDistinct` sorting is the one already memoized in `sort.ts`
(exported for reuse, or a local twin — implementer's choice, cite `sort.ts` if reused).

## Integration Points

- `data-source.ts` imports `FilterModel` and `DistinctResult` from here (drops its placeholder).
- `index.ts` re-exports `filterRows`, `computeDistinct`, and the `ColumnFilter`/`FilterModel`/
  `DistinctResult`/`FilterType` types; `FilterModel` re-points here (like `SortKey`).
- `grid.ts` calls `filterRows` in `display` (before `sortRowsMulti`) and `computeDistinct` for the
  client value-list; the popups call `resolveFilterType`/`filterPredicate` indirectly via the model.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Filter references an unknown `columnId` | Dropped in `filterRows` (never evaluated) — matches `sortRowsMulti` | AR #13 / AC-9 |
| `number` filter on a non-numeric value | Predicate returns `false` (fail closed) — never coerces | AR #14 |
| `date` filter on a nil / non-date value | `dateOrdinal` returns a sentinel; predicate returns `false` | AR #14 |
| Nil value under text / set | `displayLabel` → `''`; a non-empty needle → no match; selecting `''` keeps nils | AR #4 / #10 |
| `between` with `b` omitted | Treated as `eq a` (degenerate range) — never throws | AR #8 |

> **Traceability:** every strategy above cites the resolving AR. See `00-ambiguity-register.md`.

## Testing Requirements
- Unit tests for each `kind` × op (text 4 ops case-insensitive; number 4 ops incl. inclusive between;
  date 4 ops across `Date` and `CalendarDate`; set membership on labels; custom).
- `filterRows` multi-column AND, empty model, unknown-column drop, non-mutation.
- `computeDistinct` dedup + sort + nil→`''`; `resolveFilterType` inference + override.
- ST cases: see `07-testing-strategy.md` (ST-1…ST-11).
