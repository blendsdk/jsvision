# Row Edit Sessions: Data Grid Escape-to-Revert

> **Document**: 03-01-row-edit-sessions.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the bounded state needed to recover a row after `validateRow` traps it. It
replaces the container's touched-key-only model with a dedicated controller in
`packages/datagrid/src/row-revert.ts`. The controller records accepted cell commits, tracks the
trap/pass lifecycle, validates stable row identity, and exposes an immutable rollback description
to the transaction flow in [03-02](03-02-rollback-transaction-and-input.md) (AR-3, AR-6, AR-7).

The controller is separate from `grid.ts` because that container already coordinates rendering,
sorting, filtering, selection, lifecycle, and mutation concerns. The new module keeps journal and
rollback invariants testable without expanding the oversized container further (AR-6, AR-12).

## Architecture

### Current Architecture

`EditableDataGrid` owns `Set<Key> touched`. After `commitCell` succeeds, `editing.ts` reports only
`rowKey`; `RowGate.tryLeave()` checks the set, clears it on pass, and otherwise reports a message.
There is no record identity, column identity, value baseline, trapped flag, or async attempt token.

### Proposed Changes

`createRowRevertController<T>()` owns active sessions keyed by `Key`. In the ordinary UI there is
one focused visit, but keying the registry explicitly prevents sort/filter display indices from
becoming identity. A focus reconciliation step retains the same key+object across sorting and
column layout changes, and removes sessions whose row disappeared, was replaced, or lost focus
through an external/source-driven transition (AR-7).

The cell editor reports a successful commit only after `commitCell` accepts it. A notification
contains the stable key, row reference, column id, earliest candidate, accepted value, and a typed
setter closure. The controller adds a change only once per column; later accepted commits update
`current` but never overwrite `previous` (AR-6).

`RowGate` remains stateless. Its dependencies gain lifecycle notifications:

- on a failing touched-row leave, `markTrapped(key, row)`;
- on a passing touched-row leave, `release(key, row)`;
- no validator, empty grid, and untouched rows preserve their existing fast paths.

## Implementation Details

### Internal Types

```ts
interface AcceptedCellCommit<T> {
  readonly rowKey: Key;
  readonly row: T;
  readonly columnId: string;
  readonly previous: unknown;
  readonly value: unknown;
  readonly apply: (row: T, value: unknown) => void;
}

interface RowSessionChange<T> {
  readonly columnId: string;
  readonly apply: (row: T, value: unknown) => void;
  readonly previous: unknown;
  current: unknown;
}

interface RowEditSession<T> {
  readonly rowKey: Key;
  readonly row: T;
  readonly changes: Map<string, RowSessionChange<T>>;
  trapped: boolean;
  reverting: boolean;
  attempt: number;
}
```

These types are internal and may be named differently during implementation only if their fields
and invariants remain unchanged. The public types are fixed by AR-14 and owned by 03-02.

### Controller Surface

```ts
interface RowRevertController<T> {
  recordCommit(change: AcceptedCellCommit<T>): void;
  isTouched(rowKey: Key, row: T): boolean;
  markTrapped(rowKey: Key, row: T): void;
  release(rowKey: Key, row: T): void;
  reconcileFocus(rowKey: Key | undefined, row: T | undefined): void;
  prepare(rowKey: Key, row: T): PreparedRowRevert<T> | undefined;
  finish(attempt: PreparedRowRevert<T>, outcome: 'accepted' | 'rejected' | 'invalidated'): void;
  invalidate(keys?: ReadonlySet<Key>): void;
  dispose(): void;
}
```

- `recordCommit` is a no-op when no `validateRow` is configured; grids without a row gate do not
  accumulate irrelevant touched history (AR-1, AR-12).
- A commit for an existing column changes only `current`. `previous` and `apply` remain the ones
  captured on the first accepted commit of that column (AR-6).
- `markTrapped` succeeds only for the same key and row object as the touched session (AR-3, AR-7).
- `release` deletes the session and cannot be undone by a later Escape (AR-3).
- `prepare` requires same key+object, `trapped === true`, `reverting === false`, and at least one
  change. It marks reverting and increments `attempt` before returning an immutable ordered snapshot
  (AR-3, AR-7, AR-10).
- Change iteration preserves first-commit insertion order for deterministic payloads and
  compensation; persistence must not depend on visible column order (AR-6, AR-14).
- A prepared transaction retains the captured original row, setters, baseline values, and committed
  pre-revert values until its callback settles. This data-settlement ownership is independent from
  the live grid/session registry (AR-7, AR-10).
- Each prepared attempt also receives an opaque presentation owner token. The container records
  exactly which dirty keys and transient pending message that token introduced, so invalidation or
  settlement can idempotently detach its own presentation without clearing newer state that happens
  to reuse the same row/cell key (AR-7, AR-10).
- `finish` owns only live UI/session settlement and mutates it when the attempt token and row
  identity still match. Accepted and invalidated outcomes delete the session; a live rejected
  outcome restores `reverting = false` and retains the trapped changes for retry. A stale finish
  never touches replacement-row data, focus, retry/session state, or unrelated messages. While the
  grid is live it may detach presentation still owned by that attempt and request reconciliation;
  disposal suppresses all grid work (AR-7, AR-10).

### Commit Notification

Replace `markRowTouched(rowKey)` in `EditHost<T>` with an accepted-commit notification carrying the
fields above. `editing.ts` calls it after `res.committed` and before closing the editor. Parse,
column validation, `beforeSave`, or `onCommit` failures never enter the journal because those paths
return before notification (AR-6).

The notification captures `apply` beside the typed column while its erased `GridColumn<T>` value is
still `unknown`; no `as any` or `as unknown` cast is needed. Hidden/reordered columns therefore
remain restorable without looking up their current visible index (AR-6, AR-11).

### Row-Gate Integration

Extend `RowGateDeps<T>` with explicit notifications rather than moving state into `validation.ts`:

```ts
readonly onBlocked?: (rowKey: Key, row: T) => void;
readonly onPassed?: (rowKey: Key, row: T) => void;
```

On a passing touched-row validation, call `onPassed` before clearing the transient message and
returning true. On failure, call `onBlocked` before publishing the localized trapped message. The
container's `isRowTouched` delegates to the controller. This preserves one leave decision across
keyboard, Enter, Tab, and click paths (AR-3, AR-9).

### Identity and Cleanup

- `reconcileFocus` runs from container-owned reactive/focus wiring. Same key+object survives a sort,
  filter, window refresh, or collection republication; a different key, missing row, or same key
  with another object invalidates the old session. The existing source API exposes no separate
  semantic reset event, so collection-container identity and `revision` are not reset signals
  (AR-7).
- `deleteRows(keys)` invalidates matching sessions before delegating removal; a pending attempt's
  token is made stale before the source can reuse a key. Dirty/error ownership is tied to the
  attempt, detached synchronously during known invalidation, and never inferred from the row key
  after a replacement appears. Settlement repeats the owned detach idempotently when it is the first
  observer of a custom/non-reactive source replacement (AR-7, AR-10).
- Source-driven disappearance/replacement is caught by reconciliation and by the identity check at
  both `prepare` and `finish` (AR-7).
- Grid disposal invalidates all attempts and clears the registry. A promise may settle afterward,
  but `finish` sees a stale token and performs no UI/session writes, messages, or repaint. If that
  promise vetoes, the transaction still compensates its captured original row without consulting
  or mutating the disposed grid (AR-7, AR-10).
- A live stale settlement bumps the grid version only when reconciliation must reveal a source
  identity change first observed at finish or when veto compensation changed the captured original
  row and that exact key+object is still displayed. It never repaints after disposal (AR-7, AR-9,
  AR-10).
- Successful leave and successful rollback remove all retained closures and values immediately;
  failed rollback retains only the same bounded session needed for retry (AR-10, AR-12).

## Integration Points

- `editing.ts` emits accepted commit details.
- `validation.ts` announces pass/trap outcomes.
- `grid.ts` constructs the controller, reconciles focus/source identity, and delegates cleanup.
- `row-revert.ts` hands a prepared immutable transaction to the flow specified in 03-02.
- `row-mutations.ts` owns mutation behavior; the public `EditableDataGrid.deleteRows` wrapper
  invalidates affected keys before delegating removal.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Commit vetoes or editor cancels | Do not record a session change | AR-4, AR-6 |
| Re-edit same column | Retain earliest `previous`, replace only `current` | AR-6 |
| Unknown/hidden column after commit | Use captured setter closure; visibility is irrelevant | AR-6, AR-7 |
| Same key now names another object | Invalidate; never restore into the replacement | AR-7 |
| Focus/source removes the active row | Invalidate UI/session ownership and idempotently detach attempt-owned presentation | AR-7 |
| Accepted completion after deletion/disposal | Leave the already-restored original row; if live, detach owned presentation/reconcile; never write replacement data or disposed UI | AR-7, AR-10 |
| Veto after deletion/disposal | Compensate the captured original row; if live, detach owned presentation and repaint only for visible-original compensation or newly discovered source identity; never write replacement data or disposed UI | AR-7, AR-9, AR-10 |
| `validateRow` throws | Existing blocking behavior remains; mark the session trapped and use bounded localized feedback | AR-3, AR-11 |

## Testing Requirements

- Unit-test earliest-value retention, repeated-column updates, insertion order, key+identity checks,
  pass cleanup, retry state, deletion, replacement, disposal, attempt-owned dirty/message cleanup,
  and accepted/vetoed stale settlement.
- Integrate with real `EditableDataGrid` objects for sorting/filtering/column-hiding behavior.
- Prove that republishing a collection with the same key+object identities preserves the session,
  while disappearance or object replacement invalidates it.
- Prove no session is recorded for parse/validate/veto/cancel paths or grids without `validateRow`.
- Prove state is released after pass, success, invalidation, and disposal.
