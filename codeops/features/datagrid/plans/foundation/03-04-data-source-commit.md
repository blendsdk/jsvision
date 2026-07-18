# Data Source & Commit: Foundation

> **Document**: 03-04-data-source-commit.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 §"Row identity & data source" + §"Commit sink" · AC-4, AC-5, AC-6 · req AR-14, AR-15, AR-16, AR-02 · AR #3 (plan)
> **Files**: `packages/datagrid/src/data-source.ts`, `packages/datagrid/src/commit.ts`

## Overview

Two contracts + their v1 realizations. `GridDataSource<T>` is the read/mutate seam the grid body binds to —
one shape satisfied by both an in-memory array and a windowed/server source, so the body is source-agnostic.
`OnCommit<T>` is the per-cell veto sink; `commitCell` is the tested primitive that applies an edit to the
in-memory record immediately, calls `onCommit`, and reverts on veto — making AC-6 real in RD-01 (AR #3, plan).

## Architecture

### Current Architecture

None — no source or commit abstraction exists. `@jsvision/ui`'s `DataGrid` binds directly to a `Signal<T[]>`.

### Proposed Changes

- `data-source.ts`: the `GridDataSource<T>` interface + `fromRows` (the in-memory source over `Signal<T[]>`).
- `commit.ts`: `CellCommit<T,V>` / `OnCommit<T>` types + `commitCell`.

## Implementation Details

### `GridDataSource<T>` (RD-01 contract, verbatim intent)

```ts
export interface GridDataSource<T> {
  rowKey: (row: T) => string | number;    // REQUIRED (req AR-15 / AC-5)
  length(): number;                        // total (or best-known for windowed)
  rowAt(index: number): T | undefined;     // display-ordered; undefined = not yet loaded
  ensureRange?(start: number, end: number): void | Promise<void>; // windowed prefetch (RD-11)
  setSort?(keys: SortKey[]): void;         // push-down (RD-05); omit → client-side
  setFilter?(model: FilterModel<T>): void; // push-down (RD-06); omit → client-side
  distinct?(columnId: string): Promise<string[]>; // value-list (RD-06)
}
```

- In RD-01 only `rowKey`/`length`/`rowAt` are exercised; the optional push-down/windowing members are declared
  (so the type is stable for RD-05/06/11) but not implemented here. `SortKey`/`FilterModel` are **forward
  type placeholders** owned by RD-05/RD-06 — RD-01 declares minimal local aliases (or `unknown`-shaped stand-ins)
  documented as "shaped by RD-05/06", so no premature commitment. *(This is the only forward-typing seam; it is
  additive and does not change in RD-01.)*

### `fromRows` — the in-memory source (Should folded in; the contract block names it)

```ts
export function fromRows<T>(
  rows: Signal<T[]>,
  opts: { rowKey: (row: T) => string | number },
): GridDataSource<T>;
```

- `length()` = `rows().length`; `rowAt(i)` = `rows()[i]` in display order; `rowKey` = `opts.rowKey`. Reactive:
  reading `rows()` inside a container's `derived` re-runs on change. `distinct(columnId)` is computed
  client-side by later RDs; RD-01 leaves it undefined on the in-memory source (RD-06 adds it).
- `opts.rowKey` is **required** → constructing `fromRows(sig, {})` is a compile error (AC-5, 07 ST-5).

### `CellCommit` / `OnCommit` + `commitCell`

```ts
export interface CellCommit<T, V = unknown> {
  readonly rowKey: string | number; readonly columnId: string;
  readonly value: V; readonly previous: V; readonly row: T;
}
export type OnCommit<T> = (change: CellCommit<T>) => boolean | Promise<boolean>;

/** Apply `next` to the record immediately, call onCommit, revert to `previous` on false/reject. */
export async function commitCell<T, V>(args: {
  row: T; columnId: string; rowKey: string | number;
  previous: V; next: V;
  apply: (row: T, columnId: string, v: V) => void;   // immediate in-memory write (req AR-02)
  onCommit?: OnCommit<T>;
}): Promise<{ committed: boolean; value: V }>;
```

- **Behavior (AC-6):** `apply(row, columnId, next)` runs first (the in-memory record updates immediately, req
  AR-02). Then `onCommit({rowKey,columnId,value:next,previous,row})` is awaited. On `true` → `{committed:true,
  value:next}` (new value stays). On `false` or a rejected promise → `apply(row, columnId, previous)` reverts →
  `{committed:false, value:previous}`; the caller (RD-02's editor) keeps the editor open. `onCommit` absent →
  treated as `true` (commit succeeds; persistence is the caller's concern).
- **Async concurrency (req PF-008):** `commitCell` is a single awaited round-trip; RD-02/RD-12 own the policy
  of locking the cell during an in-flight commit + serializing overlapping per-cell commits. RD-01 exposes the
  primitive; it does not itself queue.
- `commitCell` is the seam RD-02 wires the editor's stay-open-on-veto onto and RD-12 layers the per-row gate +
  BeforeSave veto above.

## Integration Points

- The read-only container (03-05) binds `GridRowsConfig.display` to a source; RD-01 exercises `fromRows` **and**
  a hand-written windowed test double (`test/` fixture) implementing the same interface (AC-4, 07 ST-7).
- RD-02 consumes `commitCell` for the editing flow; RD-11 supplies windowed `GridDataSource` implementations.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `onCommit` returns `false` | Revert to `previous`; report `committed:false` (editor stays open) | req AR-16 / AC-6 |
| `onCommit` rejects | Same as `false` — revert + `committed:false` (rejection is a veto, not a crash) | req AR-16 / AC-6 |
| `onCommit` absent | Commit succeeds (`true`); persistence is the host's job | RD-01 §Commit sink |
| `rowAt(i)` out of range / not loaded (windowed) | Returns `undefined`; the body renders a placeholder — RD-11 (RD-01's double loads eagerly) | req AR-14 |
| Overlapping in-flight commits | Out of RD-01 scope; policy owned by RD-02/RD-12 (cell locked + serialized) | req PF-008 |
| Source built without `rowKey` | Compile error (required field) | req AR-15 / AC-5 |

> **Traceability:** two-tier source = req AR-14; required `rowKey` = req AR-15; `onCommit` veto = req AR-16;
> immediate in-memory apply = req AR-02; `commitCell` inclusion = AR #3 (plan); async policy deferred = req PF-008.

## Testing Requirements

- Spec: `fromRows` `length`/`rowAt` mirror the signal; a **shared** spec asserts identical results against the
  in-memory source and the windowed double (07 ST-6, ST-7).
- Spec: `commitCell` calls `onCommit` with the exact change; `false`/reject reverts + `committed:false`; `true`
  keeps the new value (07 ST-8).
- Impl: `commitCell` with no `onCommit`; async `onCommit` resolving late; `fromRows` reactivity on `rows.set`.
