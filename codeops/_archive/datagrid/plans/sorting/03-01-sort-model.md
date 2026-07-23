# Sort Model: Sorting

> **Document**: 03-01-sort-model.md
> **Parent**: [Index](00-index.md)

## Overview

The pure, view-free core of sorting — the multi-key data model and the one comparator that every sort
path (header click, keyboard, API, client re-sort) shares. Like `@jsvision/ui`'s `columns.ts`, this
module holds no view state and no signals: callers pass plain snapshots, so every function is
deterministic and directly unit-testable. New file: `packages/datagrid/src/sort.ts`. It also owns the
two additive `GridColumn` fields (`compare?`/`nulls?`) that live in `column.ts`.

## Architecture

### Current Architecture

Value-aware comparison exists only as the single-key engine adapter `defaultCompare`/`toEngineColumn.compare`
(`column.ts:151,164`), which the datagrid never calls (dead-for-sort — see [02](02-current-state.md)).
There is no multi-key comparator.

### Proposed Changes

`sort.ts` becomes the home of the sort model: `SortDir`, `SortKey` (moved from `data-source.ts`, same
public shape and barrel export — AR #11), the memoized value comparator, and `sortRowsMulti`. The
engine adapter `defaultCompare`/`toEngineColumn.compare` is left **untouched** (it remains a complete
adapter for the ui engine; the datagrid just doesn't use that path — PF-015). This deliberately keeps
the datagrid's one live string rule (a case-insensitive collator, AR #2) out of `defaultCompare` (whose
`localeCompare` is dead-for-sort), so there is no *live* second string rule.

## Implementation Details

### New Types/Interfaces (`sort.ts`)

```ts
/** A sort direction. */
export type SortDir = 'asc' | 'desc';

/** One directive in an ordered sort: which column, which way. A single-column sort is a one-element list. */
export interface SortKey {
  readonly columnId: string;
  readonly dir: SortDir;
}
```

`data-source.ts` drops its local `SortKey` declaration and does `import type { SortKey } from './sort.js'`
for the `setSort?(keys: SortKey[])` signature. The barrel re-points `SortKey`'s export to `sort.ts`
(same name, same shape → zero consumer change; plan AC-2).

### New `GridColumn` fields (`column.ts`) — AR #13

```ts
export interface GridColumn<T, V = unknown> {
  // …existing fields…
  /** Custom order for this column's values, overriding the type-aware default. Receives only non-null
   *  values (null ordering is governed by `nulls`). Returns <0 / 0 / >0 like `Array.prototype.sort`. */
  readonly compare?: (a: V, b: V) => number;
  /** Where null/undefined values sort, independent of direction (default `'last'`). */
  readonly nulls?: 'first' | 'last';
}
```

### New Functions (`sort.ts`)

```ts
/** Ordered multi-key sort. Stable (ties keep source order), never mutates `rows`. Keys whose `columnId`
 *  is absent from `columns` are ignored (AR #14). An empty (or all-unknown) key list returns source order. */
export function sortRowsMulti<T>(
  rows: readonly T[],
  keys: readonly SortKey[],
  columns: ReadonlyMap<string, GridColumn<T>>,
): T[];
```

**Algorithm:**
1. Filter `keys` to those whose `columnId ∈ columns` (AR #14 — unknown ids silently dropped). If none
   remain, return `rows` unchanged (source order).
2. `return [...rows].sort(cmp)` — the spread copy keeps `rows` unmutated; `Array.prototype.sort` is
   stable on Node ≥ 22, giving the required stable tie-break to source order.
3. `cmp(a, b)`: for each surviving key in order, `col = columns.get(key.columnId)`, compare
   `col.value(a)` vs `col.value(b)` via `compareOneKey`; return the first non-zero result; `0` if all
   keys tie.

**`compareOneKey(va, vb, col, dir)`** (the shared comparator):
- **Nulls first (absolute, independent of `dir`)** — matches SQL `NULLS FIRST/LAST` and AC-7: if either
  of `va`/`vb` is `null`/`undefined`, return `0` when both are, else place the nil per `col.nulls ?? 'last'`
  (`'first'` → nil sorts to the top, `'last'` → to the bottom) **without** applying the `dir` sign.
- **Otherwise**: `base = col.compare ? col.compare(va, vb) : compareValues(va, vb)`, then
  `return dir === 'desc' ? -base : base`. A custom `compare` never sees a nil (nulls are handled above).

**`compareValues(a, b)`** (the type-aware default, AR #2):
- both `number` → `a - b`; both `Date` → `a.getTime() - b.getTime()`;
- otherwise → `collator().compare(String(a), String(b))`, where `collator()` lazily builds and memoizes
  one `Intl.Collator(undefined, { sensitivity: 'accent', numeric: false })` (case-insensitive,
  accent-sensitive — honours AC-5). Strings hit this branch directly; mixed/other types stringify first.

### Integration Points

- The container ([03-02](03-02-header-and-wiring.md)) builds the `ReadonlyMap<string, GridColumn<T>>`
  once from its typed columns and feeds it, plus the current `SortKey[]`, into `sortRowsMulti` inside the
  pure `display` computed (client path). It also passes the same `SortKey[]` to `source.setSort` on the
  push-down path (a separate effect — AR #7).
- `GridColumn.value` is the sole key source (RD-05 §Must; never the formatted string).

## Code Examples

```ts
import { sortRowsMulti } from '@jsvision/datagrid'; // barrel-exported
// qty ascending, then region descending; nulls in `closed` would sort last by default.
const ordered = sortRowsMulti(
  rows,
  [{ columnId: 'qty', dir: 'asc' }, { columnId: 'region', dir: 'desc' }],
  new Map(columns.map((c) => [c.id, c])),
);
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `SortKey.columnId` not in `columns` | Drop that key; never throw; never forward to a source query | AR #14 |
| Empty / all-unknown key list | Return `rows` unchanged (source order) | AR #6 |
| `null`/`undefined` column value | Ordered by `col.nulls` (default `'last'`), absolute of `dir` | AR #13 |
| Custom `compare` throws | Not caught here — a column author's `compare` is trusted like `value`/`format`; a throw surfaces (consistent with the rest of `GridColumn`) | AR #13 |

> **Traceability:** design choices above trace to the register (AR #2, #6, #11, #13, #14). The
> stable-sort and value-key facts are RD-05 §Must (the owning requirements doc).

## Testing Requirements

- Unit tests for `sortRowsMulti`: single-key numeric (9 before 1000), multi-key priority + tie
  fall-through, stability, custom `compare` override, `nulls: 'first'`/`'last'`, case-insensitive string
  order, unknown-`columnId` drop, empty-key source order, non-mutation of the input. See
  [07-testing-strategy.md](07-testing-strategy.md) ST-cases.
