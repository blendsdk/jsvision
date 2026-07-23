# Column Model & Adapter: Foundation

> **Document**: 03-03-column-model-adapter.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 §"`value`/`format`/`parse` column model" + §"Column adaptation" · AC-3, AC-5 · req AR-31, AR-15 · AR #3/#5/#6 (plan)
> **File**: `packages/datagrid/src/column.ts`

## Overview

The `value`/`format`/`parse` column contract — the set's central architectural decision (req AR-31) — plus
the adapter that makes "reuse the ui engine" actually work. The engine renders/sorts a **string** accessor;
`GridColumn<T,V>` carries a **typed** value. `toEngineColumn` bridges the two: the display string comes from
`format∘value`, and the sort comparator is synthesized from the typed `value`, so numeric/date columns order
by value, never by the formatted text.

## Architecture

### Current Architecture

`@jsvision/ui`'s `Column<T>` is `{ title, accessor:(row)=>string, width, align?, compare?, minWidth?, maxWidth? }`
(`columns.ts:20-35`); `sortRows` orders by `accessor` output unless `compare` is set. There is no typed column
model in the repo.

### Proposed Changes

Define `GridColumn<T,V>` (RD-01's contract), a per-column `column<T,V>()` authoring helper (Should), an
internal `toEngineColumn` adapter, and an internal `defaultCompare` value comparator.

## Implementation Details

### New Types

`GridColumn<T,V=unknown>` — exactly RD-01 §"Column model": `id`, `title`, `value:(row)=>V`, optional
`format:(v,row)=>string` (default `String(value)`), optional `parse:(text)=>V`, optional `width?:ColumnWidth`
/ `align?:ColumnAlign` (reused from `@jsvision/ui`). Editor/filter/sort hooks are added by later RDs; RD-01
declares only these. `format`/`parse` are inverse where the column is editable; a read-only column may define
`format` without `parse` (RD-01).

### New Functions

```ts
/**
 * Per-column authoring helper — infers `V` from `value` so `format`/`parse` are type-checked against
 * it, then returns the column with `V` erased to the uniform storage shape (`GridColumn<T>`) so
 * heterogeneously-typed columns collect into one `GridColumn<T>[]`. A per-ARRAY helper cannot do this:
 * each element would collapse to `GridColumn<T, unknown>`, which leaves a typed `format`/`parse`
 * uncheckable (and the naive annotate/variadic workarounds fail to compile) — so the authoring seam is
 * per-column, not per-array.
 */
export function column<T, V>(col: GridColumn<T, V>): GridColumn<T>;

/** Adapt a typed GridColumn to the ui engine's string-accessor Column (INTERNAL). */
function toEngineColumn<T, V>(c: GridColumn<T, V>): Column<T>;
//   accessor = (row) => c.format ? sanitize-free display (c.format(c.value(row), row)) : String(c.value(row))
//   compare  = (a, b) => defaultCompare(c.value(a), c.value(b))
//   width    = c.width ?? 'auto';  align = c.align

/** Value-aware default comparator: number→numeric, Date→chronological, string→locale compare,
 *  null/undefined→sorts last; mixed/other→String() locale compare (INTERNAL). */
function defaultCompare(a: unknown, b: unknown): number;
```

- `toEngineColumn` is the **load-bearing reuse seam** (req AR-31 note / RD-01 §Column adaptation). It is
  internal (not barrel-exported) — the container (03-05) adapts columns before building `GridRowsConfig`.
- The engine's promoted `sortRows` stays a single-key string/`compare` sort; the adapter's `compare` is the
  engine-render fallback for single-column engine sorting only. The datagrid's value-aware multi-key ordering
  (numeric/date/locale, nulls) is **RD-05's `sortRowsMulti`**, not a behavior of `sortRows` (AC-3 wording).
- `defaultCompare` covers number/string/`Date`/null only. Typed value comparators beyond these primitives
  (e.g. `CalendarDate` chronological ordering) are **RD-05's `sortRowsMulti`**, not this Foundation helper —
  so `defaultCompare` stays free of date-family coupling and ambiguous structural type-sniffing, and its impl
  test covers number/string/`Date`/null/mixed (no `CalendarDate` case). Its shipped JSDoc states this scope in
  plain language (no RD-/AR- ids per the repo docs ban).

### AC-5 — required `rowKey` as a compile error

`GridColumn` itself carries no `rowKey` (that is on the source/grid options, 03-04/03-05), but AC-5's
"missing `rowKey` is a compile error" is realized by declaring `rowKey` a **required** field on
`GridDataSource`/the grid options (03-04/03-05) and asserting it with a `// @ts-expect-error` negative type
test compiled by `tsconfig.typecheck.json` (07 ST-5). Recorded here because it is part of the column/identity
contract.

## Code Examples

### Example: value/format/parse + value-aware order

```ts
import { column } from '@jsvision/datagrid';

interface Person { name: string; balance: number; }
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

// `column` infers V per column from `value`, so `format`'s `v` is typed (number here) — not `unknown`.
const columns = [
  column({ id: 'name', title: 'Name', value: (r: Person) => r.name }),
  column({ id: 'balance', title: 'Balance', value: (r: Person) => r.balance, format: (v) => eur.format(v), align: 'right' }),
];
// Adapted: balance cell shows "€ 9,00" / "€ 1.000,00" but the comparator orders 9 before 1000.
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| No `format` supplied | Display `String(value)` (RD-01 default) | req AR-31 |
| A numeric column sorted by the engine | `toEngineColumn.compare` uses `defaultCompare(value(a),value(b))` — never the formatted string | AC-3 / req AR-31 |
| `value` returns `null`/`undefined` | `defaultCompare` sorts nullish last (documented) | RD-01 §value SoT |
| A `format` callback throws | Draw-error isolation is the container/renderer's concern (03-05); the adapter itself is pure | req AR-25 |
| Grid/source constructed without `rowKey` | TypeScript compile error (required field) | req AR-15 / AC-5 |

> **Traceability:** the value/format/parse split = req AR-31; required `rowKey` = req AR-15; the per-column
> `column<T,V>()` helper inclusion = AR #3 (plan); the file/name layout = AR #5 (plan).

## Testing Requirements

- Spec: `toEngineColumn` accessor returns `String(value)` with no formatter and `format(value,row)` with one;
  the synthesized comparator orders a numeric column by value (07 ST-3, ST-4).
- Spec: constructing a source/grid without `rowKey` fails typecheck (07 ST-5).
- Impl: `defaultCompare` across number/string/Date/null/mixed; `column` infers `V` from `value` and
  type-checks `format`/`parse` against it (a typed formatter compiles; a mismatched one is a compile error).
