# Aggregate Model: Footer, Aggregation & Master-Detail

> **Document**: 03-01-aggregate-model.md
> **Parent**: [Index](00-index.md)

## Overview

The pure, view-free aggregate model — `aggregate.ts`, the twin of `sort.ts`/`filter.ts`/`selection.ts`.
It owns the aggregate **descriptor** (`AggregateSpec`), the edge-safe **fold** (`foldAggregate`), and
the **cell-text renderer** (`formatAggregate`, including the honesty qualifier). No signals, no views —
the footer controller (03-02) invokes these **lazily** over `displayedRows()`; the reactive memo lives in
the `FooterBand` view's data-bound repaint, not in an owned `computed` (03-02).

## Architecture

### Proposed Changes

New file `packages/datagrid/src/aggregate.ts` (~120 lines). Pure functions + types only. Exported from
the barrel so a bespoke grid can fold its own totals.

## Implementation Details

### New Types

```ts
/** The built-in reductions a footer aggregate can apply to a column. */
export type AggregateFn = 'sum' | 'avg' | 'min' | 'max' | 'count';

/**
 * A per-column footer aggregate. `fn` reduces the column's typed `value` across the displayed rows.
 * `format` renders the numeric result (e.g. a currency `Intl` formatter); `label` is an optional
 * static prefix (e.g. `'Σ'`, `'Avg:'`). Cell text is `"[label ][formatted result][ (loaded)]"`.
 */
export interface AggregateSpec {
  readonly fn: AggregateFn;
  readonly format?: (v: number) => string;
  readonly label?: string;
}
```

Design note (AR-5): a **static `label` string** + a numeric `format` function — not the RD's literal
dual `(v)=>string` functions. The common footer case is "prefix + formatted number"; this is the same
RD-faithful-behavior / cleaner-shape divergence RD-08 made for the null fields.

### New Functions

```ts
/**
 * Reduce `values` (one per displayed row, the column's typed `value(row)`) by `fn`.
 * Numeric folds (`sum`/`avg`/`min`/`max`) include a value only when it is a finite number
 * (`typeof === 'number' && Number.isFinite`) — `null`/`undefined`/`NaN`/`±Infinity`/non-number are
 * skipped. `count` counts every row (all `values`), null or not.
 *
 * @returns the numeric result, or `undefined` for an empty numeric contributor set on
 * `avg`/`min`/`max` (rendered as a blank cell). `sum`/`count` of an empty set return `0`.
 */
export function foldAggregate(fn: AggregateFn, values: Iterable<unknown>): number | undefined;

/**
 * Render an aggregate cell's text: `"[label ][format(v) ?? String(v)]"`, with a trailing
 * `" (loaded)"` honesty qualifier appended when `partial` is true and the value is present.
 * A `v === undefined` (empty avg/min/max) renders just the label (or blank).
 */
export function formatAggregate(spec: AggregateSpec, v: number | undefined, partial: boolean): string;

/** Type guard: whether `fn` is a known `AggregateFn` (config-time validation, AR-12). */
export function isAggregateFn(fn: string): fn is AggregateFn;
```

### Fold semantics (AR-6) — the contract the ST-cases pin

| `fn` | Contributors | Empty result | Notes |
| ---- | ------------ | ------------ | ----- |
| `sum` | finite numbers | `0` | skips non-finite |
| `avg` | finite numbers | `undefined` (blank) | `sum / (finite count)` |
| `min` | finite numbers | `undefined` (blank) | |
| `max` | finite numbers | `undefined` (blank) | |
| `count` | **all rows** | `0` | ignores value/null entirely |

### Integration Points

- The `FooterController` (03-02) calls `foldAggregate(spec.fn, displayedRows().map(col.value))`
  **on demand** (no owned `computed`), then `formatAggregate(spec, result, partial)` where
  `partial = complete()===false`; the `FooterBand` view binds this read to its data deps for repaint (03-02).
- `column.value(row): V` (`column.ts:37`) supplies the typed values (may be null on a nullable column —
  the fold nil-guards).

## Code Examples

```ts
foldAggregate('sum', [10, 20, null, 30]);      // 60   (null skipped)
foldAggregate('avg', [10, 20, null]);          // 15   (30/2)
foldAggregate('max', []);                       // undefined  → blank cell
foldAggregate('count', [1, null, 3]);           // 3    (counts rows)
foldAggregate('sum', ['x', NaN, Infinity, 5]);  // 5    (non-finite skipped)

formatAggregate({ fn: 'sum', format: (v) => `$${v.toFixed(2)}`, label: 'Σ' }, 60, false); // "Σ $60.00"
formatAggregate({ fn: 'sum', label: 'Σ' }, 60, true);                                     // "Σ 60 (loaded)"
formatAggregate({ fn: 'max' }, undefined, false);                                         // ""
```

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| Non-numeric / null / NaN / ±Inf in a numeric fold | Skipped (finite-guard); never poisons the total | AR-6 |
| Empty contributor set (avg/min/max) | Return `undefined` → blank cell | AR-6 |
| Unknown `fn` in a spec | `isAggregateFn` guard at the controller boundary → ignore + `devWarn` (AR-12) | AR-12 |

> **Traceability:** design + edge decisions per [00-ambiguity-register.md](00-ambiguity-register.md)
> AR-5 (descriptor), AR-6 (fold semantics), AR-9 (reactive fold), AR-12 (validation).

## Testing Requirements

- Unit: each `fn` over mixed finite/null/NaN/±Inf/empty inputs; `count` counts rows incl. nulls;
  `formatAggregate` label/format/partial permutations (ST-7..ST-12). The reactive-render path (a
  `sum` over the displayed set) is exercised end-to-end in the controller spec (ST-1..ST-6), and the
  honesty qualifier at render time in ST-17/ST-18.
- Pure — no view, no signal; deterministic input→output (spec-oracle friendly).
