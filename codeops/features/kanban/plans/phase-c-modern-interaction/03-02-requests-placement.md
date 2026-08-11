# Requests and Placement: Kanban Phase C Modern Interaction

> **Document**: 03-02-requests-placement.md
> **Parent**: [Index](00-index.md)

## Overview

All mutation origins describe intent through one validated public request union. Placement names semantic
structure and stable neighbors rather than a visual index or package-generated rank. A pure synchronous
eligibility pipeline lets the board preview the exact policy outcome before the application repeats
current authorization and asynchronous validation (AR-C05/C06/C10/C14/C15).

## Standard proposals and dispatch envelopes

Public standard producers submit immutable `KanbanRequestProposal` variants without lifecycle-owned fields.
The coordinator validates and freezes a proposal, creates its operation ID and `AbortSignal`, captures the
current expected revisions, and produces the final `KanbanRequest` dispatch envelope. Variant payloads are
exact-key validated, deeply detached, bounded, and frozen before dispatcher invocation
(AR-C10/C13/C20).

The existing extension request shape remains a documented compatibility overload for
`board.request(legacyExtensionRequest)`. It retains its caller-provided operation ID and signal after exact
validation; the coordinator safely adopts them for that operation, rejects active/retained ID collision,
and treats either signal abort or coordinator cancellation as terminal. Generated standard producers never
use this exception. Packed consumers prove both input paths without rewriting caller values (AR-C10/C11).

| Family | Discriminators | Payload contract |
|---|---|---|
| Card | `card-create`, `card-update`, `card-duplicate`, `card-archive`, `card-delete` | Target identity/address as applicable plus bounded generic semantic draft/patch/reference data |
| Move | `card-move` | Ordered non-empty moved-card snapshots, target address, semantic position, projection revision; one card uses the same shape as bulk |
| Column | `column-add`, `column-update`, `column-reorder`, `column-delete` | Stable column IDs, bounded semantic draft, semantic structural placement/reassignment policy where applicable |
| Swimlane | `swimlane-add`, `swimlane-update`, `swimlane-reorder`, `swimlane-delete` | Stable swimlane IDs and equivalent structural payloads |
| Saved view | `saved-view-save`, `saved-view-rename`, `saved-view-delete` | Stable view ID plus bounded semantic data; defined now, produced by RD-09 later |
| Extension | `extension` | Existing namespaced `extensionId` plus bounded semantic payload; proposal form is coordinator-owned while the legacy envelope overload remains compatible |

No standard variant accepts an executable callback, raw card object, numeric target index, generated rank,
or partial-result identity list. Generic drafts use `KanbanSemanticValue`; application schema validation
remains authoritative (AR-C10/C14/C20).

## Semantic move proposal

```ts
export interface KanbanCardMoveProposal {
  readonly moved: readonly KanbanMovedCardSnapshot[];
  readonly target: KanbanCellAddress;
  readonly position: KanbanMovePosition;
  readonly viewRevision?: KanbanRevision;
}

export type KanbanMovePosition =
  | { readonly kind: 'start'; readonly cursorRevision: KanbanRevision }
  | { readonly kind: 'end'; readonly cursorRevision: KanbanRevision }
  | {
      readonly kind: 'between';
      readonly beforeCardKey: CardKey | null;
      readonly afterCardKey: CardKey | null;
      readonly cursorRevision: KanbanRevision;
    }
  | {
      readonly kind: 'window-edge';
      readonly edge: 'before' | 'after';
      readonly neighborCardKey: CardKey;
      readonly token: PlacementToken;
      readonly cursorRevision: KanbanRevision;
    };
```

Each moved snapshot contains key, source address, source placement/revision, and entity revision. Ordered
IDs are source order for selection moves and remain deterministic across pointer/keyboard/programmatic
origins. `window-edge` is dispatchable only with a current source-issued token; unavailable placement is
an eligibility result and never a request member (AR-C06/C10/C13/C14).

`start`/`end` require cursor completeness proving the logical edge. `between` accepts one or two stable
neighbors but not both null or the same identity. Hidden cards may make visible neighbors non-adjacent;
the application resolves or rejects that interval. Sorted within-cell manual ranking is blocked. Filtered
within-cell ranking requires an unambiguous source resolver/token; cross-column movement may still be
allowed (AR-C06).

## Synchronous eligibility

```ts
export type KanbanEligibility =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'warning'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'blocked'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'unavailable'; readonly code: string; readonly params?: KanbanSemanticValue };
```

The pure pipeline evaluates in this fixed order:

1. exact structural/card existence and unique moved identities;
2. current board/source/query/entity/cursor/placement revisions and token provenance;
3. application capability presentation state (never authorization);
4. selection/server-selection representability and atomic limit;
5. sorted/filtered/manual-placement policy;
6. column transition and definition-of-done policy;
7. WIP/count authority and proposed count delta;
8. semantic no-op/unchanged rules.

First terminal result wins. `warning` remains dispatchable only after the application-provided confirmation
seam resolves affirmatively; without a confirmer, it behaves as blocked with localized warning feedback.
The dispatcher repeats authorization and may reject an allowed preview (AR-C06/C20).

## Confirmation classification

The pure request-policy classifier identifies every warning proposal and destructive standard kind:
`card-archive`, `card-delete`, `column-delete`, `swimlane-delete`, and `saved-view-delete`. It returns whether
confirmation is required but never invokes application code. The board-level coordinator owns the one
pre-dispatch confirmation gate described in 03-03. There is no bypass/force field in a public request;
programmatic callers use the same policy unless the application explicitly configures its confirmer to
approve (AR-C06/C20).

## Operation ID factory

`KanbanBoardOptions.operationId` optionally supplies a trusted factory returning a value accepted by
`createKanbanOperationId`. The package fallback combines a process-local board sequence and per-board
monotonic operation counter; predictability is explicitly not an authorization mechanism. Duplicate active
or retained IDs reject before application dispatch, and wrap/exhaustion reports unavailable instead of
reusing an ID (AR-C11/C13).

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Unknown/excess request key or unsafe draft | Throw/normalize bounded invalid-request rejection before application callback | AR-C10/C20 |
| Duplicate moved identity or over-limit selection | Reject atomically; no partial projection or dispatch | AR-C13/C14 |
| Stale placement/token/revision | `unavailable` during preview or reject before dispatch; zero application calls | AR-C06/C13 |
| Sorted/ambiguous filtered within-cell move | `blocked` with localized reason; cross-cell policy still evaluated independently | AR-C06 |
| Warning without confirmation | No dispatch and warning feedback | AR-C06 |
| Duplicate retained operation ID | Reject before callback and keep existing operation untouched | AR-C11/C13 |

## Testing Requirements

- Exact union validation for every standard family plus existing extension compatibility.
- Proposal-to-envelope construction and legacy extension adoption cases, including caller abort, collision,
  and proof that standard producer lifecycle fields are coordinator-owned.
- Semantic placement cases for complete/unknown edges, anchors, tokens, sorted/filtered views, stale
  revisions, no-op, WIP/DoD/transition, warnings, and atomic selection ordering.
- Hostile getters/proxies/thenables, control text, oversized data, token/observation redaction, and duplicate
  identity/ID cases in dedicated security specification tests.
