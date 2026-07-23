# Component: Callback isolation (Should-Have, extends AC-7)

> **Implements**: RD-14 Should-Have (throwing formatter/comparator) · **Tests**: ST-6, ST-7 · **Decisions**: AR-3, AR-9
> **CodeOps Skills Version**: 3.9.0

Extends the AC-7 draw-error isolation guarantee (already true for the custom **renderer**,
`cell-draw.ts:120-125`) to the other two trusted callbacks. **Spec-first with real implementation** —
both call sites are unguarded today (AR-9).

## Files

- **New**: `packages/datagrid/test/callback-isolation.spec.test.ts` (ST-6, ST-7).
- **Edit**: `packages/datagrid/src/column.ts` (the on-screen formatter guard).
- **Edit**: `packages/datagrid/src/sort.ts` (the comparator guard).

## ST-6 — throwing on-screen formatter degrades one cell

Today `column.ts:242-248` `toEngineColumn` builds the on-screen `accessor`:

```ts
accessor: (row) => {
  const v = c.value(row);
  if (v === null || v === undefined) return c.nullDisplay ?? '';
  return c.format ? c.format(v, row) : String(v);   // :247 — UNGUARDED
},
```

**Guard** it to mirror the export-path guard (`grid.ts:1004-1005`): on throw, degrade to `String(v)`
so a bad formatter shows the raw value in its one cell and the row/frame still paints. Small,
comment the *why* (trusted-callback isolation), no ID references in the code.

Spec: a column whose `format` throws for one row → that cell shows the value's `String()` form, the
other cells/rows render normally. Assert via `rr.buffer().rows()` painted-cell content (the smoke
harness pattern), not by catching an exception.

## ST-7 — throwing comparator degrades to default order

Today `sort.ts:54-65` `compareOneKey` invokes the custom comparator:

```ts
const base = col.compare ? col.compare(va, vb) : compareValues(va, vb);  // :63 — UNGUARDED
```

A throwing `col.compare` propagates out of `Array.prototype.sort` → `sortRowsMulti` → the caller
(header click / keyboard / API), crashing the grid.

**Guard** it: on throw, fall back to `compareValues(va, vb)` (the module's type-aware default) so a
bad comparator degrades to a sensible order rather than tearing down the sort. This keeps
`sortRowsMulti` total and deterministic. Comment the *why*.

Spec: a column whose `compare` throws → `sortRowsMulti` returns all rows (in default-comparator
order) without throwing; the grid renders. Assert on the returned array (the model is pure and
directly unit-testable — see `sort.ts:5-9`) **and** at the grid level (a header-click sort on the bad
column does not crash).

## Note

Scope is exactly these two call sites (AR-9). The renderer path is already done; the *export*-path
formatter is already guarded — a quick regression assertion there is welcome but not required.
