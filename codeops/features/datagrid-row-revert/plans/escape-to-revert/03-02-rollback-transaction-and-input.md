# Rollback Transaction and Input: Data Grid Escape-to-Revert

> **Document**: 03-02-rollback-transaction-and-input.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the public atomic persistence seam, optimistic apply/compensation flow,
body-level key action, race blocking, dirty presentation, and localized message states. It consumes
a prepared session from [03-01](03-01-row-edit-sessions.md) and either commits the row rollback or
returns the same session to a retryable trapped state (AR-4, AR-5, AR-8, AR-10, AR-13, AR-14).

## Architecture

### Current Architecture

`commitCell` applies one cell, awaits `beforeSave` then `onCommit`, and restores `previous` on veto.
`EditableGridRows.runAction` routes body actions, while an open editor's host consumes Escape before
the body sees it. The dirty registry can mark pending cells, and the error registry has a single
transient message channel. There is no row transaction callback or body Escape action.

### Proposed Changes

Add an additive `onRevertRow` option and public payload types in `commit.ts`, export them from the
package barrel, and add `revertRow` to the keymap vocabulary. A trapped body Escape prepares the
session, applies every baseline through its captured setter, marks all cells pending, publishes the
pending message, and invokes at most one host callback. Acceptance clears all rollback state;
false/throw/rejection reapplies each pre-revert committed value and restores the trapped hint
(AR-5, AR-10, AR-14).

## Implementation Details

### Public Transaction Contract

```ts
/** One cell in an atomic row rollback. */
export interface RowRevertCell {
  readonly columnId: string;
  /** Restored baseline, already applied to `row` when the callback runs. */
  readonly value: unknown;
  /** Committed value immediately before this rollback attempt. */
  readonly previous: unknown;
}

/** The complete optimistic row rollback described to the host. */
export interface RowRevert<T> {
  readonly rowKey: string | number;
  /** Original row object with every `cells[].value` already applied. */
  readonly row: T;
  /** Frozen first-commit-ordered list; descriptors are frozen too. */
  readonly cells: readonly RowRevertCell[];
}

/** Accept or veto one atomic row rollback. Rejection is a veto, not an event-loop error. */
export type OnRevertRow<T> = (change: RowRevert<T>) => boolean | Promise<boolean>;
```

`EditableDataGridOptions<T>` gains `readonly onRevertRow?: OnRevertRow<T>`. Every exported entity
receives complete junior-readable JSDoc and a practical `@example`. The `value`/`previous` timing is
the row-level mirror of `CellCommit`: the requested value is already applied when trusted callback
code runs (AR-10, AR-14).

### Transaction Flow

For an eligible trapped session:

1. Select authority before any write: use callback mode when `onRevertRow` is supplied; use
   internal mode only when it is absent and both `beforeSave` and `onCommit` are absent;
   otherwise exit through the persistence-unavailable flow without calling `prepare` (AR-5, AR-8).
2. Prepare the session, assign an opaque presentation owner token, freeze one descriptor per
   change, and freeze the cells array (AR-7, AR-10, AR-11, AR-14).
3. Add every affected `cellKey` to an attempt-owned slice of the existing dirty registry and
   publish `datagrid.revert.pending` (AR-10, AR-13).
4. Before invoking each captured setter, add that cell to the attempted prefix, then apply its
   `value` baseline. If a setter mutates and then violates the documented synchronous/non-throwing
   precondition, do not call `onRevertRow`: catch the failure, best-effort restore every attempted
   cell (including the failing cell) to `previous` in reverse order while containing any secondary
   setter failure, detach pending/dirty ownership, invalidate the session, and publish only
   `datagrid.revert.failed`. Otherwise bump the grid version once so no normal render observes an
   intentionally mixed row (AR-9, AR-10, AR-11).
5. In callback mode, call `onRevertRow` exactly once regardless of
   `beforeSave`/`onCommit` presence; false/throw/rejection is a veto. Internal mode accepts
   without a callback (AR-5, AR-8).
6. Before UI/session settlement, re-check attempt token, row key, object identity, source identity,
   and disposal. Staleness suppresses replacement-row data, focus, retry/session state, and
   unrelated messages; it does not cancel data settlement or idempotent cleanup owned by the
   captured transaction (AR-7, AR-10).
7. On acceptance, leave the captured original row at its baselines. If the attempt is still live,
   clear its dirty keys, changed-cell error entries, transient message, and session, and keep body
   focus on the restored row. A live stale attempt detaches dirty/message state only while its owner
   token still matches, then bumps once if settlement first discovered a source identity change;
   it never mutates replacement data, focus, or session state (AR-3, AR-4, AR-7, AR-10).
8. On veto, reapply every `previous` committed value in reverse apply order to the captured
   original row even when it has been detached or the grid disposed. If compensation succeeds and
   the attempt is still live, bump once, clear its dirty keys, retain the trapped session, and
   publish `datagrid.revert.failed` so Escape can retry. If a compensation setter violates its
   contract, contain it, continue best-effort recovery, clear pending ownership, invalidate the
   untrustworthy session, and show only bounded failure text. A live stale veto idempotently
   detaches presentation owned by the attempt. It bumps once only if the captured original remains
   displayed and was compensated, or if settlement first discovered a source identity change.
   It never publishes stale failure, mutates replacement data/focus/session state, or performs any
   grid work after disposal (AR-7, AR-9, AR-10, AR-13).

Document `GridColumn.set` as synchronous, deterministic, and non-throwing for editable columns.
Row-level atomicity is guaranteed only for conforming setters; best-effort recovery bounds a host
contract violation but cannot promise strong atomicity if a recovery setter also throws. Grid-owned
input is serialized while steps 3–8 run; application code retains the existing commit contract
obligation not to concurrently mutate the same fields inside a pending trusted callback (AR-7,
AR-10, AR-11).

### Persistence-Unavailable Flow

When `beforeSave` or `onCommit` exists but `onRevertRow` does not, an eligible Escape is consumed,
no setter or dirty state changes, the trapped session remains, and the band displays
`datagrid.revert.unavailable`. This deterministic refusal prevents UI/storage divergence and can be
documented before deployment (AR-5, AR-8, AR-13).

### Keymap and Event Routing

Add `'revertRow'` to `GridAction` and `GRID_ACTIONS`, then add `escape: 'revertRow'` to
`DEFAULT_KEYMAP` and its documented table (AR-12). `EditableGridRowsConfig` gains controller
delegates for eligibility, pending state, and rollback start.

`runAction('revertRow')` follows these rules:

- while an editor is open, the editor host already consumes Escape and cancels only that editor;
- while idle with an eligible trapped session, consume the action and start rollback;
- while rollback is pending, consume the action without starting another attempt;
- when no trapped session is eligible, return false so Escape retains its prior bubble/fallthrough
  behavior, including parent-dialog handling (AR-3, AR-4, AR-12);
- caller keymap entries keep existing chord precedence: remapping `escape` suppresses the default,
  and binding another chord to `revertRow` invokes the same eligibility rules (AR-12).

### Pending Input Guards

While `reverting` is true, grid-owned handlers consume without mutation:

- begin-edit, printable type-to-edit, value help, and filter opening;
- row/column/page/grid navigation and Tab traversal;
- selection gestures, cross-row/body clicks, and row mutation entry points;
- duplicate `revertRow` attempts.

The host remains free to dispose or replace its data. Identity/token guards detach stale grid state
and protect replacements, while the captured transaction still settles its original row on veto.
This does not broaden the grid into an application-level focus or transaction manager (AR-7,
AR-10).

### Localized Message Contract

Add these canonical keys and exact English values (AR-13):

| Key | English value | Use |
|-----|---------------|-----|
| `datagrid.validation.row-trapped` | ``${message} · Esc reverts row changes`` | Failed leave; `${message}` is the bounded caller/generic validation message |
| `datagrid.revert.pending` | `Reverting row…` | Async or synchronous attempt presentation |
| `datagrid.revert.failed` | `Could not revert row changes` | False/throw/rejection with retryable session |
| `datagrid.revert.unavailable` | `Row changes cannot be reverted` | Persistence/policy callbacks lack `onRevertRow` |

Add the trapped placeholder to the manifest and provide reviewed entries for every official locale.
The full translated template, rather than concatenated English, owns locale ordering. Rendering
continues through the existing sanitize boundary; host exception text and row values are never
inserted (AR-11, AR-13).

## Integration Points

- `commit.ts` owns the public types alongside `CellCommit`/`OnCommit`.
- `row-revert.ts` owns prepared state and apply/compensation orchestration.
- `grid.ts` supplies options, dirty/errors/version/i18n dependencies and row-mutation guards.
- `editable-grid-rows.ts` routes actions and blocks pending input.
- `keymap.ts` owns the action/chord contract.
- `validation.ts` asks the container to compose the trapped message from the caller result.
- `i18n/catalog.ts` and `i18n/locales.ts` own all package text.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Escape with no eligible session | Return false and preserve prior bubbling behavior | AR-3, AR-12 |
| Persistence callbacks but no rollback callback | No write; retain trap; show unavailable message | AR-5, AR-8, AR-13 |
| Supplied rollback callback without per-cell callbacks | Invoke it exactly once; do not bypass explicit host authority | AR-5, AR-8 |
| Duplicate Escape during pending rollback | Consume without another callback or write | AR-10 |
| Callback returns false, throws, or rejects | Compensate all cells, retain retryable session, show bounded failure | AR-10, AR-11, AR-13 |
| Row removed/replaced, then callback accepts | Keep the captured original row restored; detach attempt-owned presentation and reconcile a live newly discovered replacement; suppress unrelated/replacement writes | AR-7, AR-10 |
| Row removed/replaced, then callback vetoes | Compensate the captured original row; detach attempt-owned presentation; repaint a live visible original or newly discovered replacement; suppress unrelated/replacement writes | AR-7, AR-9, AR-10 |
| Grid disposed before callback settles | Settle only captured-row data; perform no registry, message, focus, session, or repaint work | AR-7, AR-10 |
| Setter throws during apply or compensation | Contain the error, best-effort restore the attempted prefix, end pending state, invalidate the session, and show bounded failure | AR-10, AR-11 |
| Callback or row contains sensitive/control text | Never log it; only package-owned sanitized feedback is drawn | AR-11 |
| Custom keymap replaces Escape | Caller chord wins; `revertRow` may be rebound elsewhere | AR-12 |

## Testing Requirements

- Specification-test editor/body priority, untouched fallthrough, default/remapped chords, atomic payload,
  in-memory acceptance, unavailable persistence, pending blocking, accepted completion, and all veto forms.
- Implementation-test frozen payloads, callback call count/order, dirty keys, one version bump per apply or
  compensation stage, retry tokens, attempt-owned error/dirty transitions, apply-setter failure,
  and secondary compensation-setter failure.
- Security-test sanitization and absence of raw row/error logging.
- Exercise synchronous and controllable deferred promises with real grid/controller objects rather than
  mocking internal state.
