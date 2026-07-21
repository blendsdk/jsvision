# Master-Detail: Footer, Aggregation & Master-Detail

> **Document**: 03-04-master-detail.md
> **Parent**: [Index](00-index.md)

## Overview

An **editable** master-detail link: a child `EditableDataGrid` whose rows are a reactive function of
the master's **focused** record, where cell edits *and* insert/delete on the detail persist into the
master's owned collection (AR-4). Three pieces: the new grid readouts `focusedRow()`/`focusedKey()`,
the reactive write-through source `fromReactiveRows` (the twin of `fromRows`), and the `masterDetail`
helper that wires + disposes the reactive link.

## Architecture

### Current Architecture

`selectedKeys()` is public (`grid.ts:1104`); the cursor is a **private** `focused` index (`:290`),
re-anchored by `rowKey` after sort/filter (`:1061`, `:1081`). `fromRows(Signal<T[]>)` reads via
`rows()` and writes via `rows.set` — a `computed` has no `.set`, so it cannot back an editable detail.
Reactive scope disposal is `createRoot((dispose)=>…)` (`ui reactive/owner.ts:73`) + `onCleanup` (`:141`).

### Proposed Changes

**1. New grid accessors (`grid.ts`, thin — AR-8):**

```ts
/** The filtered+sorted loaded rows currently displayed (reactive). The aggregate fold target. */
displayedRows(): readonly T[];              // return this.display();
/** The record under the row cursor, or undefined if the grid is empty (reactive). */
focusedRow(): T | undefined;                // clamp the cursor into range like focusAnchorKey (grid.ts:1042):
                                            //   const rows = this.display();
                                            //   return rows.length ? rows[Math.min(this.focused(), rows.length - 1)] : undefined;
/** The rowKey of the focused record, or undefined (reactive). */
focusedKey(): Key | undefined;              // reuse the existing clamped focusAnchorKey (make it public, or
                                            //   share one private helper) — do NOT re-derive un-clamped.
```

**2. `fromReactiveRows` (in `data-source.ts`, the twin of `fromRows`):**

```ts
/**
 * A reactive, write-through {@link GridDataSource}. `read` supplies the current rows (evaluated inside
 * the grid's reactive scope, so the grid re-derives when its dependencies change). `insert`/`remove`
 * delegate to caller writers that mutate the OWNING collection — so structural edits on this source
 * persist. Omit them for a read-only-structural source (cell edits still work via the in-place +
 * `version` path). `complete` feeds the footer honesty label (AR-2).
 */
export function fromReactiveRows<T>(
  read: () => readonly T[],
  opts: {
    rowKey: (row: T) => Key;
    insert?: (row: T, at?: number) => void;
    remove?: (keys: Key[]) => void;
    complete?: () => boolean;
  },
): GridDataSource<T>;
```

Implementation: `length: () => read().length`, `rowAt: (i) => read()[i]`, and `insert`/`remove`
present only when the corresponding writer is given (so `EditableDataGrid.insertRow`/`deleteRows`
no-op gracefully when absent, per the existing read-only-source contract, `data-source.ts` doc). Reads
are reactive because `read` is invoked inside the grid's `display`/`materialize` derivation.

**3. `masterDetail` helper (in `master-detail.ts`):**

```ts
/**
 * Link a detail grid to `master`'s focused record. `buildDetail` receives a reactive `focused`
 * accessor and returns the detail grid (typically backed by `fromReactiveRows(() => …focused()…)`).
 * The reactive wiring runs in a `createRoot` scope; `dispose()` tears it down, and it is also
 * registered on the ambient reactive owner (if any) so it is freed with the surrounding/master scope.
 */
export function masterDetail<M, D>(
  master: EditableDataGrid<M>,
  buildDetail: (focused: () => M | undefined) => EditableDataGrid<D>,
): { detail: EditableDataGrid<D>; dispose: () => void };
```

Implementation: `createRoot((dispose) => { const detail = buildDetail(() => master.focusedRow()); if
(getOwner()) onCleanup(dispose); return { detail, dispose }; })`. The detail's source `read` closes over
`master.focusedRow()`, so when the master cursor moves the detail re-derives; cell edits/insert/delete
route through `fromReactiveRows` into the master's owned data.

### Integration Points

- `focusedRow()`/`focusedKey()` read the private `display`/`focused` — reactive, re-anchored after
  sort/filter for free. **They clamp the cursor into range** (mirroring `focusAnchorKey`, `grid.ts:1042`,
  and `GridSelection.focusedKey`, `grid-selection.ts:163`) so a transiently-stale cursor never returns
  `undefined` while rows exist; `focusedKey()` **reuses** `focusAnchorKey` rather than re-deriving (DRY — PF-003).
- `fromReactiveRows` plugs into the unchanged `EditableDataGrid` source contract; sort/filter/selection/
  aggregates all work on the detail too.
- Disposal grounds in `createRoot`/`onCleanup`/`getOwner` (`owner.ts:73/141`, `scheduler.ts`).

## Code Examples

See [00-index.md](00-index.md) §Usage — orders→lines, with `fromReactiveRows` insert/remove writing
back into the `lines` signal.

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| `master.focusedRow()` undefined (empty master) | `read()` returns `[]` → empty detail (no throw) | AR-4 |
| Detail insert/delete with writers omitted | No-op (read-only-structural), per the source contract | AR-4 |
| Detail scope not disposed | `masterDetail` owns `createRoot`; `dispose()` + ambient `onCleanup` free it; ST-22 asserts teardown | AR-8 |
| Cell edit on a detail whose `read` returns fresh objects each call | Documented caller contract: `read` must return stable refs into the owned model for edits to persist | AR-4 |
| `read` re-run cost | `read` is invoked once per row per re-derive (`materialize` calls `rowAt(i)` for each `i`, `grid.ts:188`) → a filtering `read` over a large set is O(n²) per derivation. Documented caller contract: keep `read` cheap — small detail sets, or memoize the filter | AR-4 (PF-006) |

> **Traceability:** [00-ambiguity-register.md](00-ambiguity-register.md) AR-4 (write-through), AR-8
> (accessors). Grounded: `owner.ts:73/141`, `grid.ts:290/364/1104`, `data-source.ts`.

## Testing Requirements

- Spec: `focusedRow()`/`focusedKey()` track the cursor + re-anchor after sort (ST-19/20); master-focus
  change updates detail rows (ST-21); `dispose()` stops recompute (ST-22); `fromReactiveRows` reactive
  read (ST-23), write-through insert/remove persists into the owned collection (ST-24), omitted-writer
  read-only-structural (ST-25). (`master-detail.spec.test.ts`, `reactive-source.spec.test.ts`.)
- Impl: no scope leak; `read` invoked lazily/memoized; disposal idempotent.
