# RD-08: Requests, Placement, and Operation Lifecycle

> **Document**: RD-08-requests-placement-lifecycle.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-02, RD-05, RD-06, RD-07
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Every user or programmatic mutation is intent, not state. This document defines one typed atomic request
dispatcher, semantic card placement, synchronous eligibility, asynchronous outcomes, optimistic pending
projection, authoritative publication, cancellation/supersession, concurrency, and application-owned
undo integration.

---

## Functional Requirements

### Must Have — Complexity XL

- [ ] Define a discriminated `KanbanRequest` union and one application `dispatch(request, context)` seam
  used by all mutation producers.
- [ ] Correlate each request/result/event/projection through a unique operation ID and captured board,
  query, entity, and placement revisions.
- [ ] Support card create/update/duplicate/archive/delete/move, atomic bulk move, column/swimlane
  add/update/reorder/delete, application-store saved-view save/rename/delete, and namespaced custom
  requests without direct mutation; pure local saved-view apply/personalization is not a request.
- [ ] Describe move position by target structure, explicit edge kind, nullable stable neighbor anchors,
  optional placement token, and ordered moved IDs; never by authoritative numeric index.
- [ ] Run pure synchronous eligibility for preview and application authorization/async validation in the
  dispatcher.
- [ ] Represent proposed, pending, accepted, committed, rejected, cancelled, and superseded operation
  states distinctly.
- [ ] Show bounded pending projection while awaiting authoritative publication, then confirm, reject, or
  supersede deterministically.
- [ ] Require all-or-nothing results for multi-card and structural reassignment requests.
- [ ] Cancel or supersede stale work and ignore late outcomes.
- [ ] Integrate undo/redo through fresh application requests/tokens, never component-owned history rewind.

### Should Have — Complexity L

- [ ] Support application-provided confirmation for warning outcomes and destructive requests.
- [ ] Permit request deduplication/idempotency by operation ID at the application boundary.
- [ ] Expose normalized lifecycle observations without card payloads.

### Won't Have (Out of Scope)

- Component-owned persistence, retries after application failure, timeout policy, distributed conflict
  merging, or silent rank rebasing.
- Partial success for a bulk move/reassignment.
- Persisting placement tokens or optimistic data as saved views.

---

## Technical Requirements

### Request envelope — Complexity L

Every request contains:

- package request discriminator and optional namespaced extension discriminator;
- unique bounded string operation ID;
- captured board/source/query revisions and applicable entity revisions;
- immutable typed payload;
- application capability context for diagnostics only; and
- live `AbortSignal` owned by the component operation lifecycle.

The dispatcher returns/settles a typed result: accepted (optionally with pending/undo metadata), rejected
with bounded reason/field, cancelled, or superseded. It must not return partial accepted IDs for atomic
variants. Throwing/rejected promises normalize to rejected/cancelled error outcomes and never escape the
event loop unhandled.

### Semantic move proposal — Complexity XL

A card move contains ordered moved IDs, each captured source placement/revision, target column and
optional swimlane, and one target position:

- `start` or `end` only when logically known;
- `between` with `beforeCardId` and/or `afterCardId`;
- `window-edge` with known neighbor plus valid `PlacementToken`; or
- unavailable, which cannot dispatch.

It also contains view-projection revision so the application can distinguish a filtered/sorted intent.
If hidden cards make visible anchors non-adjacent, application policy resolves the interval or rejects.
The standard policy does not guess through an unknown window. The component does not create fractional,
LexoRank, database, or numeric rank values.

### Eligibility pipeline — Complexity L

The synchronous pure pipeline evaluates structural existence, source completeness/token validity,
capability, selection eligibility, transition, WIP/DoD, sorted/filter placement policy, and no-op rules.
It returns allowed, warning, blocked, or unavailable with reason code/parameters. Renderer/menu/dialog
paths share this function. The dispatcher repeats current authorization and may reject despite preview.

Sorted views disable within-cell manual ranking. Cross-column moves remain eligible when application
policy can define target order. Filtered within-cell ranking is enabled only with unambiguous
source/application placement resolution; otherwise it is disabled with reason.

### Pending projection and publication — Complexity XL

On dispatch, affected cards/structure enter pending state and conflicting operations on them are
disabled while unrelated work remains available. A move projection visually places the ordered block at
the proposal target, marked pending. Accepted result does not commit it; the application must publish
authoritative data.

Publication handling:

1. matching identities/placement/revision confirms and removes pending state;
2. explicit rejection restores authoritative layout and presents bounded reason;
3. contradictory authoritative data wins, removes/animates no false committed state, and reports
   superseded/conflict feedback;
4. external deletion removes projection and reconciles focus/selection;
5. application-owned timeout may dispatch cancellation/rejection; no package default invents one.

### Concurrency and cancellation — Complexity L

Unrelated source changes reconcile during grab/pending operations. A change to a moved card, its target
structure, placement anchors/token revision, or required policy cancels a pre-release drag and may
supersede a pending request. Abort is best effort; operation generations prevent late results/events from
publishing. Operation IDs cannot be reused while retained in the bounded deduplication window.

### Undo/redo integration — Complexity M

Accepted application outcomes may include an opaque bounded undo token or application-defined inverse
request builder. Invoking Undo/Redo creates a new operation ID, recaptures current revisions/capabilities,
and calls the dispatcher. It may be rejected if policy/data changed. The component owns command routing
and feedback, not durable history or record snapshots.

---

## Integration Points

- **RD-02** supplies revisions, anchors, tokens, counts, and publication.
- **RD-05** supplies structural/WIP/transition eligibility.
- **RD-07** builds pointer proposals; RD-12 builds command/programmatic requests.
- **RD-10/RD-11** submit editor/configuration drafts through the dispatcher.
- **RD-14** verifies stale work, resource bounds, security, and failure isolation.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Ownership | Direct mutate / request | Request | Application authority | AR #3, #9 |
| Dispatch | Callbacks / union | One union dispatcher | Consistent lifecycle and extensions | AR #42 |
| Placement | Index / rank / anchors-token | Semantic hybrid | Windows/concurrency | AR #32 |
| Optimism | None / component commit / projection | Pending projection | Responsive but honest | AR #31 |
| Bulk | Partial / atomic | Atomic | Predictable recovery | AR #15, #33 |
| Undo | Component history / app integration | Fresh app request | App owns records/history | AR #18, #27 |

---

## Security Considerations

- The dispatcher is the authoritative application validation/authorization boundary. UI capabilities,
  prior preview, and placement tokens never grant permission.
- Requests validate IDs, revisions, discriminator, payload bounds, placement consistency, and token
  provenance before application invocation; applications validate again against current data.
- Request/result/observation errors exclude card bodies and placement/undo tokens.
- Abort, concurrency caps, generation checks, and bounded retained operation IDs prevent unbounded async
  work/replay inside the component; server replay/rate limiting remains application-owned.
- Custom request namespaces and payload codecs are allowlisted; no dynamic code/eval is accepted.

---

## Acceptance Criteria

1. [ ] Card, column, swimlane, editor, dialog, context-menu, keyboard, and programmatic mutation fixtures
   all invoke the same dispatcher spy and none changes source records directly.
2. [ ] A move proposal contains operation ID, ordered moved IDs, captured source placements, target
   column/swimlane, explicit edge kind, anchors/token as applicable, and source/query revisions.
3. [ ] Numeric visual index is absent from authoritative placement interpretation; changing scroll/filter
   indices does not change a captured semantic proposal.
4. [ ] Logical `start`/`end` dispatches only when the cursor declared that edge authoritative; unknown
   window edge without token is unavailable and emits zero requests.
5. [ ] Sorted within-cell reorder is blocked with reason; an allowed cross-column move can still dispatch.
6. [ ] Filtered ambiguous within-cell placement is blocked unless the source/application supplies a
   current resolver/token.
7. [ ] A four-card request is one dispatcher call with deterministic order; a partial result shape is
   rejected and leaves all four authoritative cards unchanged.
8. [ ] Pending projection appears after dispatch, disables conflicting actions only on affected entities,
   and remains until authoritative publication/application cancellation.
9. [ ] An accepted result without source publication remains visibly pending and is not announced committed.
10. [ ] Matching publication clears pending; rejection restores authoritative layout; contradictory
    publication wins and reports superseded/conflict feedback.
11. [ ] A relevant revision change before pointer release cancels with zero request; an unrelated card
    publication does not cancel.
12. [ ] Aborting/disposal then resolving a dispatcher promise produces no late state/frame/event mutation.
13. [ ] Reusing an active operation ID or a stale placement token is rejected before application dispatch.
14. [ ] Undo creates a fresh operation with current revisions and application token/inverse; rejection
    leaves current data intact and reports feedback.
15. [ ] A capability-allowed preview followed by dispatcher authorization rejection displays rejection
    and never treats capability as security.
16. [ ] Normalized observations contain operation/entity IDs, kind, state, duration/error code, and counts
    but no card body, placement token, undo token, or custom payload.
