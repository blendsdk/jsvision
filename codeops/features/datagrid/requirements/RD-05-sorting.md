# RD-05: Sorting

> **Document**: RD-05-sorting.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01, RD-04
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

Column sorting — single-column (already shipped in `@jsvision/ui`'s read-only grid via header-click
▲/▼), extended to multi-column priority sort, type-aware value-based ordering, custom comparators,
null ordering, a tri-state header cycle, and server-side push-down. The load-bearing rule: **sorting
orders by the column's `value` (RD-01), never the formatted display string** — so `"$1.000,00"`
sorts *above* `"$9,00"` numerically, not lexically.

---

## Functional Requirements

### Must Have

- [ ] **Single-column header-click sort** — clicking an unsorted column header sorts it ascending
      (`▲`); re-clicking the same single-sorted column toggles ascending↔descending (`▼`). This
      two-state asc/desc toggle matches the shipped read-only grid; the third "none" state is the
      Should-Have tri-state cycle below, not part of v1's toggle.
- [ ] **Multi-column priority sort** — `Ctrl`+click on a header adds it as a secondary/tertiary key;
      each sorted header shows its priority index (`1`, `2`, `3`) next to the arrow. Plain click
      resets to a single key.
- [ ] **Type-aware, value-based** — comparison uses `column.value(row)` with a type-appropriate order:
      numbers numerically, strings by locale (`Intl.Collator`), dates chronologically. Never compares
      the formatted string.
- [ ] **Stable sort** — equal keys retain their prior relative order (the engine's `sortRows` is
      already stable).
- [ ] **Server-side push-down** — when the data source implements `setSort(keys)`, the grid delegates
      ordering to the source (re-query) instead of sorting client-side; an in-memory source sorts
      client-side via `sortRows`.
- [ ] **Sort model API** — `grid.sortBy(columnId, dir?)`, `grid.addSort(columnId, dir?)`,
      `grid.clearSort()`, and a reactive `grid.sort(): SortKey[]` readout.

### Should Have

- [ ] **Custom comparator** — `GridColumn.compare?(a: V, b: V): number` overriding the default order.
- [ ] **Null ordering** — `GridColumn.nulls?: 'first' | 'last'` (default `last`).
- [ ] **Tri-state header cycle** — click cycles asc → desc → none.

### Won't Have (Out of Scope)

- Grouping/aggregation-driven sort — grouping is out of scope (AR #5).
- Drag-to-reorder sort priority UI — Phase C.

---

## Technical Requirements

### Sort model

```ts
// `SortKey` already exists as a forward-declared placeholder on the data-source seam; this release
// finalizes that same interface (do not declare a second one). `SortDir` may be extracted from its
// current inline `'asc' | 'desc'` union.
export type SortDir = 'asc' | 'desc';
export interface SortKey { readonly columnId: string; readonly dir: SortDir; }

// The datagrid's own ordered multi-key comparator (a single-column sort is a one-element key list).
export function sortRowsMulti<T>(
  rows: readonly T[],
  keys: readonly SortKey[],
  columns: ReadonlyMap<string, GridColumn<T>>,
): T[];
```

- Comparison per key: resolve `value`, pick the comparator (`column.compare` → number/string/date
  default), apply `dir`, then `nulls` ordering; fall through to the next key on a tie; stable at the end.
- String default uses a memoized `Intl.Collator` (locale-aware, case-insensitive by default);
  documented as overridable via `compare`.

### Push-down vs client-side

- If `source.setSort` exists: the grid calls it with the current `SortKey[]`, clears any client-side
  ordering, and lets `rowAt`/`length` reflect the re-queried order. Otherwise the in-memory source
  applies `sortRowsMulti` and exposes the sorted view.
- The two paths are behind one `applySort(keys)` seam so header interactions are identical regardless
  of backend.

### Header indicators

- The header shows `▲` (asc) / `▼` (desc) on each sorted column and, for multi-sort, a small priority
  digit (`1`/`2`/`3`) beside the arrow; unsorted columns show no indicator. Title clipping preserves the
  indicator (never truncated away).
- The exposed `@jsvision/ui` `GridHeader` renders only a single arrow for one column (its `SortState` is
  single-column and index-based). The multi-column, `columnId`-keyed indicator with priority digits is a
  datagrid concern; the rendering surface (own the header vs. extend the engine) is a plan decision.

---

## Integration Points

### With RD-01 / RD-04
- The functional dependency is **RD-01**: sorting reads `GridColumn.value` and relies on the value/format
  split RD-01 established — that split is what makes numeric/date order correct.
- **RD-04 is not a functional prerequisite** (sorting consumes no `fmt`/`render`/`cellStyle`); it matters
  only so formatted columns can *demonstrate* value-based (not display-string) ordering in the showcase.

### With RD-11 (data at scale)
- `setSort` push-down is the same seam a windowed/server source uses; large datasets never sort
  client-side.

### With RD-06 (filtering)
- Sort and filter compose: filter narrows the row set, sort orders it; both push down through the same
  source when supported.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Sort key source | Display string / value | `value` | Correct numeric/date order | AR #31 |
| Multi-sort | Single-only / multi | Multi (Ctrl+click) | Enterprise expectation | AR #10 |
| Large-data sort | Always client / push-down | Push-down when supported | 100k-row scale | AR #14 |
| Comparator/nulls/tri-state | v1 / Should | Should | Core first, refinements next | AR #10 |

---

## Security Considerations

- **Data sensitivity**: sorting reorders in-memory rows or issues a source re-query; no new data
  exposure.
- **Input validation**: `columnId` in the sort model is validated against the known columns; an
  unknown id is ignored (no throw, no injection into a query).
- **Injection risks**: for push-down, the source builds the `ORDER BY` — the grid passes structured
  `SortKey[]` (columnId + dir enum), never raw SQL; the source MUST map columnId → a safe column
  reference (caller responsibility, documented).
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] Clicking a numeric column header sorts ascending and shows `▲`; the row with value `9` appears
       above the row with value `1000` (numeric, not lexical, order).
2. [ ] `Ctrl`+clicking a second header adds it as key 2; headers show `1` and `2`; rows are ordered by
       key 1 then key 2, and equal-key-1 rows fall back to key 2.
3. [ ] A plain click after a multi-sort resets to a single key on the clicked column.
4. [ ] With a source exposing `setSort`, sorting calls `setSort(keys)` and does NOT run
       `sortRowsMulti` client-side (verified by a spy); with an in-memory source, `sortRowsMulti`
       produces the ordered view.
5. [ ] A string column sorts by `Intl.Collator` order (locale-aware, case-insensitive), and a
       `compare` override changes the order accordingly.
6. [ ] A tri-state header click cycles asc → desc → none, and `none` restores the source's natural
       order.
7. [ ] `nulls: 'first'` places null/undefined `value` rows before non-null in ascending order.
8. [ ] A `datagrid` kitchen-sink story demonstrates multi-column sort and passes the smoke test.
9. [ ] Security verified: an unknown `columnId` in a sort request is ignored, not forwarded to a source
       query.
