# Operation Lifecycle: Kanban Phase C Modern Interaction

> **Document**: 03-03-operation-lifecycle.md
> **Parent**: [Index](00-index.md)

## Overview

`KanbanBoardAuthority` evolves into the one board-level semantic operation coordinator. It owns request
admission, exact dispatch, lifecycle state, affected-entity conflict sets, abort/generation state,
retained IDs, pending semantic overlays, publication reconciliation, and undo integration. It never owns
application records or terminal rectangles (AR-C04/C05/C12–C14).

## Lifecycle model

```text
proposed
   ├─ ineligible ───────────────→ cancelled/rejected
   └─ admitted + dispatched ───→ pending
                                   ├─ dispatcher rejected ─→ rejected
                                   ├─ dispatcher cancelled ─→ cancelled
                                   ├─ dispatcher superseded → superseded
                                   └─ dispatcher accepted ──→ accepted
                                                               ├─ matching publication → committed
                                                               └─ contradictory/deletion → superseded
```

`pending` means application dispatch has started. `accepted` means the application accepted intent but
authoritative expectation-matched publication or exact operation-correlated reconciliation has not
confirmed it. Both retain a visible pending projection; neither is called committed. Terminal states release
affected-entity locks and AbortControllers. State transitions
publish immutable, payload-free snapshots and coalesce one board invalidation (AR-C05/C12/C13).

## Coordinator contracts

```ts
export interface KanbanOperationSnapshot {
  readonly operationId: KanbanOperationId;
  readonly kind: KanbanRequest['kind'];
  readonly state: 'proposed' | 'pending' | 'accepted' | 'committed' | 'rejected' | 'cancelled' | 'superseded';
  readonly affected: readonly KanbanOperationSubject[];
  readonly projection?: KanbanPendingProjection;
  readonly code?: string;
}
```

The coordinator exposes `commitProposal`, `request`, `cancel`, `reconcilePublication`, `undo`, `snapshot`,
`subscribe`, and idempotent `dispose` through board-owned wrappers. `commitProposal` validates and admits
one frozen proposal synchronously, publishes the pending semantic overlay, returns the operation identity,
then starts exact asynchronous dispatch. This is the atomic handoff required by SPEC-C-HANDOFF
(AR-C04/C12).

Direct public `board.request(proposal)` enters the same coordinator and receives coordinator-owned lifecycle
fields. The compatibility overload accepts the existing extension envelope and adopts its validated caller
ID/signal without rewriting them. Both return the typed terminal dispatcher result while lifecycle
observation remains available independently. Calls after disposal normalize to cancelled/unavailable without
reaching application code (AR-C04/C10/C13).

## Conflict and concurrency rules

- Each active operation owns a sorted type-preserving affected-subject set: card keys, column IDs, and
  swimlane IDs.
- Any overlap blocks a new conflicting operation before dispatcher invocation. Unrelated operations may
  run concurrently up to `limits.pendingOperations`.
- A card move locks all moved cards, target column/swimlane, and referenced neighbor cards/tokens for
  revision validation. Structural reorders lock the moved and neighboring structures.
- Relevant authoritative changes cancel pre-release drag and supersede admitted operations when they
  invalidate moved entities, target structure, anchors, token revision, or policy. Unrelated publication
  reconciles the scene without cancelling the operation (AR-C13/C14).
- Abort is best effort. Every continuation rechecks coordinator generation, operation generation, current
  state, and disposal before publishing.

## Dispatcher settlement

The existing exact native-Promise defense remains: arbitrary thenables, modified/cross-realm promises,
throwing getters, thrown callbacks, rejected promises, mismatched operation IDs, and malformed results
normalize to safe rejection without unhandled work or payload leakage. The expanded result validator
rejects partial atomic outcome shapes (AR-C10/C14/C20).

Accepted results may carry:

- a bounded publication expectation;
- one optional exact `undo` descriptor: either an opaque bounded token or a trusted inverse-request builder.

Neither token nor builder enters observations, saved state, or rendering. The application still publishes
data before the operation becomes committed (AR-C12/C20).

```ts
export interface KanbanConfirmationContext {
  readonly operationId: KanbanOperationId;
  readonly proposal: KanbanRequestProposal;
  readonly affected: readonly KanbanOperationSubject[];
  readonly expected: KanbanRequestExpectedRevisions;
  readonly eligibility: Extract<KanbanEligibility, { readonly kind: 'warning' }> | { readonly kind: 'destructive' };
  readonly signal: AbortSignal;
}

export type KanbanConfirmer = (context: KanbanConfirmationContext) => boolean | Promise<boolean>;

export interface KanbanInverseRequestContext {
  readonly prior: KanbanOperationSnapshot;
  readonly undo: KanbanUndoDescriptor;
  readonly expected: KanbanRequestExpectedRevisions;
  readonly capabilities: KanbanCapabilities;
  readonly signal: AbortSignal;
}

export type KanbanInverseRequestBuilder = (
  context: KanbanInverseRequestContext,
) => KanbanRequestProposal | Promise<KanbanRequestProposal>;

export type KanbanUndoDescriptor =
  | { readonly kind: 'token'; readonly token: KanbanUndoToken }
  | { readonly kind: 'inverse-builder'; readonly build: KanbanInverseRequestBuilder };
```

Contexts are exact-key snapshotted and deeply frozen except for the intentionally live readonly
`AbortSignal`. `KanbanUndoToken` is a branded opaque string bounded by `limits.tokenBytes`. The accepted
result exact-key union permits optional `publication` and optional `undo`; the undo descriptor is one
discriminated plain data object, so token and builder are mutually exclusive. A builder is validated and
retained as a direct function reference without invocation at result settlement.

### Application callback boundary

Warning and destructive confirmation runs once in the coordinator after admission reserves the operation ID
and affected subjects but before dispatcher invocation. The confirmer must return an exact boolean or an
unmodified same-realm native `Promise<boolean>`; arbitrary thenables, subclasses/cross-realm promises,
throws, rejection, malformed values, or reentrant cancellation/disposal normalize to cancelled/rejected
without dispatch. After settlement, the coordinator revalidates operation/board generations, revisions,
eligibility, and affected-subject reservation before dispatch. Reentrant `request`, `cancel`, and `dispose`
cannot double-admit or double-dispatch the reserved operation.

A retained inverse-request builder uses the proposal-valued equivalent of the same exception-contained
settlement boundary: a direct proposal or unmodified same-realm native `Promise<KanbanRequestProposal>`.
Its output is hostile input and is treated as a fresh proposal: snapshot, exact-key/bounds validation,
current eligibility, new operation ID, confirmation when applicable, and dispatcher authorization all run
again. Late or reentrant output is inert (AR-C06/C12/C13/C20).

`limits.retainedUndoDescriptors` bounds whole committed undo descriptors. Accepted/pending descriptors are
not invocable until authoritative commit. The coordinator uses deterministic FIFO eviction of the oldest
whole committed descriptor and clears entries on rejection, cancellation, supersession, eviction, and
dispose. Eviction never exposes or invokes a token/closure and does not affect retained operation-ID
deduplication (AR-C12/C13/C20).

## Pending projection and publication

The semantic projection records ordered moved IDs, source addresses, target address/position, request
kind, and lifecycle state. It carries no full record. The viewport joins it with current resident
descriptors; absent/unloaded records use bounded identity/count markers instead of manufacturing content
(AR-C05/C12/C20).

Accepted results auto-reconcile only when they contain a validated operation-correlated publication
expectation. There is no universal derived matcher for application-owned create/update/delete, structural,
saved-view, or extension semantics. An accepted operation without an expectation stays visibly pending until
the application calls `reconcilePublication` with an exact operation-correlated confirmation,
contradiction/deletion notice, or explicit cancellation. A standard request family may later define a
derived matcher only when its public contract completely proves the authoritative result (AR-C05/C12).

Publication settlement:

| Input | Coordinator outcome |
|---|---|
| Publication matching a validated expectation | `committed`; remove projection and locks |
| Exact operation-correlated application confirmation without an expectation | `committed`; remove projection and locks |
| Dispatcher rejection | `rejected`; remove projection, restore authoritative scene, localized reason |
| Explicit cancellation | `cancelled`; abort, remove projection, restore scene |
| Contradictory authoritative placement/revision | `superseded`; authoritative scene wins, conflict feedback |
| External deletion of affected card/structure | `superseded`; remove missing projection, reconcile focus/selection |
| Accepted with no expectation/reconciliation | Remain `accepted` and visibly pending indefinitely; package invents no matcher or timeout |
| Late settlement after terminal state/disposal | Ignore completely; no frame/state/event mutation |

## Undo/redo seam

Undo or redo is an application operation, not a local rewind. Given a retained undo descriptor, the
coordinator creates a fresh operation ID, captures current revisions/capabilities, and asks the application
to build or authorize a fresh request. It follows normal eligibility/conflict/dispatch/publication rules and
may reject. Phase C exposes the programmatic seam and feedback; RD-12 later owns complete command/history
routing (AR-C02/C12/C15).

## Observations

Lifecycle observations include operation ID, request kind, state, safe reason code, duration bucket, and
bounded counts. They exclude card bodies, query values, placement/undo tokens, custom payloads, raw errors,
and application labels that have not passed the safe-label boundary. Observation callback failure is
isolated (AR-C20).

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Dispatcher throws/rejects/malformed result | Normalize `rejected` with safe code; clear projection/locks | AR-C10/C20 |
| Conflicting affected entities | Reject new operation synchronously; keep incumbent untouched | AR-C13 |
| Pending limit exceeded | Reject before ID retention/dispatch; no eviction of live operation | AR-C13 |
| Contradictory publication | Authoritative data wins; mark superseded and clear projection | AR-C12/C13 |
| Undo token/builder invalid or expired | Reject fresh undo request; current data remains unchanged | AR-C12/C20 |
| Dispose with active operations | Invalidate generation, abort all, synchronously clear projections/listeners/locks; late work inert | AR-C13 |

## Testing Requirements

- Deterministic lifecycle state transition tests, exactly-once dispatch, affected-entity concurrency,
  active/retained ID limits, abort/disposal, and late settlement.
- Expectation-matching/contradictory/deletion publication, explicit operation-correlated reconciliation,
  and accepted-without-expectation tests.
- Warning/destructive confirmation policy and hostile/reentrant/late confirmer cases.
- Atomic bulk/structure result validation and fresh-request undo/redo tests, including hostile/reentrant/
  late inverse builders whose output re-enters full proposal validation, exact accepted-result undo keys,
  and bounded FIFO descriptor eviction/disposal.
- Payload/token/error redaction tests and observation callback isolation.
