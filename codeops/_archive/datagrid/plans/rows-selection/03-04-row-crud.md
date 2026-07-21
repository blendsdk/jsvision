# Row CRUD (`RowMutations` seam): Rows, Records & Selection

> **Document**: 03-04-row-crud.md
> **Parent**: [Index](00-index.md)

## Overview

Row create / delete / duplicate, routed through a data-source **mutation seam** so an in-memory source
splices its signal and a windowed/server source persists via callbacks. The caller owns key generation
(RD AR-15); `fromRows` implements the seam out of the box (AR-4).

## Architecture

### Current Architecture

`GridDataSource<T>` (`data-source.ts:21`) is read-only (`rowKey`/`length`/`rowAt` + optional push-down).
`fromRows` (`:59`) returns `length`/`rowAt` over a `Signal<T[]>`; the container's `display` derive
(`grid.ts:293`) reads them reactively, so any change to `rows` re-derives the display.

### Proposed Changes

Add an optional mutation seam to the interface and implement it in `fromRows`.

## Implementation Details

### The seam (`data-source.ts`)

```ts
export interface GridDataSource<T> {
  // …existing read members…
  /** Insert a row at a source-array index (append when `at` is omitted). Optional. */
  insert?(row: T, at?: number): void | Promise<void>;
  /** Remove rows by key. Optional. */
  remove?(keys: readonly Key[]): void | Promise<void>;
}
```

`fromRows` implements both by splicing the signal (a new array so the signal fires):

```ts
export function fromRows<T>(rows: Signal<T[]>, opts): GridDataSource<T> {
  return {
    rowKey: opts.rowKey,
    length: () => rows().length,
    rowAt: (i) => rows()[i],
    insert(row, at) {
      const next = rows().slice();
      next.splice(at ?? next.length, 0, row);
      rows.set(next);
    },
    remove(keys) {
      const drop = new Set(keys);
      rows.set(rows().filter((r) => !drop.has(opts.rowKey(r))));
    },
  };
}
```

### Grid API (`grid.ts`)

```ts
/** Insert a row via the source seam. `at` is a SOURCE index (append when omitted). No-op if the
 *  source has no `insert`. The row must already carry its `rowKey` (the caller owns key generation). */
insertRow(row: T, at?: number): void;

/** Remove rows by key via the source seam, and clear those keys from the selection. */
deleteRows(keys: readonly Key[]): void;

/** Insert a structured clone of the row `key` adjacent to it, with a fresh key from `assignKey`.
 *  No-op + devWarn when `assignKey` is not configured (never inserts a key-colliding row). */
duplicateRow(key: Key): void;
```

New option:

```ts
/** Mint the new key for `duplicateRow` (the caller owns key generation). Without it, duplicate is a
 *  no-op. `clone` is a structured clone of the original; return the row to insert. */
readonly assignKey?: (clone: T, original: T) => T;
```

### Semantics (AR-12)

- **`insertRow(row, at)`** — `at` indexes the **source array**; append when omitted. With an active
  **client** sort, the row re-sorts to its value-determined position on the next `display()` derive
  (the RD-08 AC-5 "display index 2" example assumes source order == display order). A push-down source
  owns its own ordering.
- **`deleteRows(keys)`** — removes via `source.remove`, then prunes `keys` from `selectedKeys` and
  clears `anchorKey` if its row is gone.
- **`duplicateRow(key)`** — finds the row by key in `display()`; `structuredClone` it; `assignKey(clone,
  original)`; `insertRow(newRow, sourceIndexOf(original) + 1)`. Missing `assignKey` ⇒ devWarn + no-op.
  `structuredClone` throws on a non-cloneable row (one holding functions, class instances, etc.), so
  either document "rows must be structured-cloneable" in the `duplicateRow` JSDoc, or wrap the clone in
  `try/catch` → `devWarn` + no-op (never a partial insert). Add an impl test for a non-cloneable row.

### Security (AR-9 / RD AR-16/25/26)

- CRUD **only** happens through the source seam — the grid never persists on its own; a source without
  `insert`/`remove` simply can't add/remove (a windowed source's callbacks own persistence + authz).
- Inserted/duplicated row values render through the `sanitize` boundary and are validated by the
  column validator on the edit/commit path (RD AR-26) before persistence.

## Integration Points

- **With `03-02`:** `deleteRows` prunes the selection (AR-12).
- **With RD-02:** an inserted row is immediately editable; its edits pass the `onCommit` veto.
- **With `display()`:** a splice re-derives the display (and re-applies the active filter/sort).

## Code Examples

```ts
const grid = new EditableDataGrid<Emp>({
  columns, source: fromRows(rows, { rowKey: (r) => r.id }),
  assignKey: (clone) => ({ ...clone, id: nextId() }),
});
grid.insertRow({ id: 10, name: 'New', dept: null });  // appended
grid.duplicateRow(10);                                 // clone with a fresh id, inserted after
grid.deleteRows([10]);                                 // removed + de-selected
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Source has no `insert`/`remove` | `insertRow`/`deleteRows`/`duplicateRow` are no-ops (read-only source) | AR-4 |
| `duplicateRow` without `assignKey` | No-op + `devWarn` (never a key collision) | AR-4 |
| `duplicateRow(key)` where `key` is absent | No-op (nothing to clone) | AR-12 |
| `deleteRows` with keys not present | Removes the ones that exist; prunes all named keys from the selection | AR-12 |

> **Traceability:** cites AR-4/AR-9/AR-12 and RD AR-15/16/25/26.

## Testing Requirements

- Spec (ST-16…ST-18): insert at a source index grows length; delete removes + de-selects; duplicate
  with `assignKey` inserts an adjacent fresh-key copy; duplicate without `assignKey` is a no-op+devWarn.
- Impl: insert under an active sort lands by value; delete of a non-selected key leaves selection
  intact; read-only source no-ops.
