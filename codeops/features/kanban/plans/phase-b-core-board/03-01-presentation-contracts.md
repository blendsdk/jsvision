# Presentation Contracts: Kanban Phase B Core Board

> **Document**: 03-01-presentation-contracts.md
> **Parent**: [Index](00-index.md)

## Overview

This specification owns the Phase B public configuration and state contracts. It extends the Phase A
API additively, centralizes validation/normalization, and prevents later dialogs/commands from needing
to replace a temporary surface (PAR-B08/PAR-B20). Application records and policy remain authoritative;
presentation and interaction contracts carry detached identities, revisions, safe semantic values, and
bounded budgets only (PAR-B04/PAR-B17).

## Public presentation policy

`KanbanCardDensity` remains the stable three-name preset union. A custom configuration is a structured
input rather than a hidden side object attached to a `'custom'` literal (PAR-B09):

```ts
export type KanbanPresentationInput = KanbanCardDensity | KanbanCustomPresentation;

export interface KanbanCustomPresentation {
  readonly revision: KanbanRevision;
  readonly cardRows: number;
  readonly cardGap: number;
  readonly metadataFields: number;
  readonly labelRows: number;
  readonly summarySections: number;
  readonly checklistMode: 'hidden' | 'progress' | 'preview';
  readonly checklistPreviewItems: number;
  readonly degradationOrder?: readonly KanbanCardSectionKind[];
}

export interface ResolvedKanbanPresentationBudget {
  readonly preset: KanbanCardDensity | 'custom';
  readonly revision: KanbanRevision;
  readonly cardRows: number;
  readonly cardGap: number;
  readonly metadataFields: number;
  readonly labelRows: number;
  readonly summarySections: number;
  readonly checklistMode: 'hidden' | 'progress' | 'preview';
  readonly checklistPreviewItems: number;
  readonly degradationOrder: readonly KanbanCardSectionKind[];
}
```

`resolveKanbanPresentation` snapshots unknown input, applies the existing centralized Kanban limits,
returns a deeply frozen budget, and rejects invalid revisions, non-integers, duplicate/mandatory
degradation entries, or values above the caller's lowered ceilings. Comfortable remains the default.
Preset budgets are deterministic and exported for testing/documentation; their numeric values come
from `KANBAN_LIMITS`, not duplicated literals (PAR-B09/PAR-B24).

An optional per-card selection may reorder or omit configured optional field/summary/checklist IDs but
cannot increase any resolved view maximum. The public pure intersection contract is:

```ts
export interface KanbanCardPresentationSelection {
  readonly fieldIds?: readonly KanbanFieldId[];
  readonly summaryIds?: readonly KanbanFieldId[];
  readonly checklistIds?: readonly KanbanChecklistId[];
}

export interface KanbanCardPresentationMaximum {
  readonly budget: ResolvedKanbanPresentationBudget;
  readonly limits: KanbanResolvedLimits;
  readonly availableFieldIds: readonly KanbanFieldId[];
  readonly availableSummaryIds: readonly KanbanFieldId[];
  readonly availableChecklistIds: readonly KanbanChecklistId[];
}

export interface ResolvedKanbanCardPresentationSelection {
  readonly budget: ResolvedKanbanPresentationBudget;
  readonly limits: KanbanResolvedLimits;
  readonly fieldIds: readonly KanbanFieldId[];
  readonly summaryIds: readonly KanbanFieldId[];
  readonly checklistIds: readonly KanbanChecklistId[];
}

export function resolveKanbanCardPresentationSelection(
  selection: KanbanCardPresentationSelection | undefined,
  maximum: KanbanCardPresentationMaximum,
): ResolvedKanbanCardPresentationSelection;
```

Both inputs must be closed plain data without accessors or unknown keys. `limits` is the active frozen
result of `validateKanbanLimitOptions`. Configured and requested IDs are validated and duplicate-free;
configured field, summary, and checklist universes must respectively fit `limits.cardFields`,
`limits.summarySections`, and `limits.checklistGroups`, and every numeric budget value must fit the
corresponding active limit. An omitted category retains configured order; an explicit category requests
a reordered subset. Well-formed requested IDs absent from the configured universe are ignored before
cardinality truncation so one selection can serve heterogeneous cards. Fields cap to `metadataFields`,
summaries cap to `summarySections`, and hidden checklist mode yields no checklist IDs. Otherwise
checklist IDs intersect independently of the checklist-item preview count. The detached result and
arrays are frozen and retain the same resolved budget and limits objects, so selection never creates or
enlarges numeric maxima. Invalid data raises one payload-free `KanbanInvalidPresentationError` before
publication. The standard renderer consumes this result; custom renderers receive only the resolved
maximum and remain subject to descriptor validation (PAR-B09/PAR-B16/PAR-B30).

## Card presentation adapters

The generic adapter remains identity/title/status-first. Phase B adds optional pure getters rather
than requiring record conversion:

```ts
export interface KanbanCardPresentationAdapter<TCard> {
  readonly fields?: readonly KanbanCardField<TCard>[];
  readonly summaries?: readonly KanbanCardSummary<TCard>[];
  readonly checklistOf?: (card: TCard) => readonly KanbanChecklistGroup[];
  readonly selectionOf?: (card: TCard) => KanbanCardPresentationSelection;
  readonly styleOf?: (card: TCard, state: KanbanCardVisualState) => KanbanCardStyleSelection;
  readonly revisionOf?: (card: TCard) => KanbanRevision;
}
```

Field and summary descriptors have bounded stable IDs, labels, priorities, semantic roles, pure value
getters, and optional injected formatters. Standard fields cover type, priority, assignees, labels,
start/due dates, estimate/value text, and counts without imposing property names. A failed getter or
formatter affects only its field/section, produces one redacted observation, and does not expose the
value or record (PAR-B16/PAR-B17).

`StandardCard` adds the optional requirement-owned fields and checklist/summary values, and
`createStandardKanbanCardAdapter` returns the complete standard adapter. No runtime Zod/Forms schema is
added in Phase B (PAR-B11/PAR-B21).

## Single-owner interaction contract

Focus, selection, range anchor, preferred row, and pending navigation change atomically through one
controller (PAR-B06):

```ts
export type KanbanFocusTarget =
  | { readonly kind: 'board-state' }
  | { readonly kind: 'column-header'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane-header'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'card'; readonly cardKey: CardKey; readonly address: KanbanCellAddress };

export interface KanbanInteractionSnapshot {
  readonly revision: number;
  readonly focused: KanbanFocusTarget;
  readonly selectedCardKeys: readonly CardKey[];
  readonly rangeAnchor?: { readonly cardKey: CardKey; readonly address: KanbanCellAddress };
  readonly preferredCenterRow?: number;
  readonly pendingNavigation?: KanbanPendingNavigation;
  readonly feedback?: KanbanInteractionFeedback;
  readonly serverSelection?: KanbanServerSelectionReference;
}

export interface KanbanInteractionController {
  snapshot(): KanbanInteractionSnapshot;
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> | KanbanInteractionResult;
  subscribe(invalidate: () => void): () => void;
  dispose(): void;
}
```

`createKanbanInteractionController` is the bounded default. `KanbanBoardOptions.interactionFactory`
may inject a factory that receives one mount-scoped `KanbanInteractionEnvironment` and returns one
complete controller; direct controller instances and per-field mixtures are rejected. Ownership of the
returned controller transfers to that board, reuse across boards rejects, and board disposal disposes it.
`KanbanBoard.interaction()` returns a stable board-owned facade before and after mount. The facade owns
transition serialization, subscriptions, semantic intent delivery, and settlement generation checks;
the default or injected controller owns state transitions only and never calls application handlers.
Returned state is detached/frozen; callers never mutate an exposed set (PAR-B06/PAR-B14).

The existing `identity` getter remains accepted only as a deprecated one-time seed for the default
controller. Source `identityChanges` remains authoritative for deletion. Supplying both `identity` and
`interactionFactory` rejects at construction. After construction, interaction changes flow only through
the facade/controller; the legacy getter cannot overwrite them (PAR-B29).

`KanbanFocusedDetailSnapshot` is a separate detached, deeply frozen, centrally bounded projection for
the currently focused target. It may contain safe complete field/checklist values omitted from the card,
full safe DoD text, available semantic actions, current key hints, and selection count/scope. It retains
no application record or host handle and caps strings, rows, actions, and collection cardinality. The
board uses this same model for conditional help/status chrome and inspection, so complete values are
available without dialogs or permanently expanded cards.

## Semantic interaction intent

Phase B exposes one final-shaped, non-mutation intent boundary (PAR-B08):

```ts
export type KanbanInteractionIntent =
  | KanbanOpenCardIntent
  | KanbanOpenContextIntent
  | KanbanScopedActionIntent;

export interface KanbanInteractionIntentBase {
  readonly origin: 'keyboard' | 'pointer' | 'programmatic';
  readonly selection: KanbanSelectionSnapshot;
}

export type KanbanActionScope =
  | { readonly kind: 'board' }
  | { readonly kind: 'column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'cell'; readonly address: KanbanCellAddress }
  | { readonly kind: 'card'; readonly cardKey: CardKey; readonly address: KanbanCellAddress }
  | { readonly kind: 'state'; readonly state: KanbanStructureStateCode; readonly address?: KanbanCellAddress };

export interface KanbanSelectionSnapshot {
  readonly entries: readonly KanbanSelectionEntry[];
  readonly sessionRevision: KanbanRevision;
  readonly queryGeneration: number;
  readonly viewRevision?: KanbanRevision;
}

export interface KanbanSelectionEntry {
  readonly cardKey: CardKey;
  readonly address: KanbanCellAddress;
  readonly entityRevision: KanbanRevision;
}
```

`KanbanBoardOptions.onInteraction` is optional and synchronous. One user gesture emits at most one
frozen intent. Scoped actions use a closed scope union and allowlisted built-in action kinds; custom
action IDs remain bounded and application-namespaced rather than forming an arbitrary envelope. Collapse,
clear-filter, add-card/configuration, and custom header actions emit intents and change no component
state until the application republishes authoritative policy/query data. Cursor retry remains source-
owned and calls the existing cursor retry seam directly, so it is never also delivered through the
handler. Handler exceptions are isolated and observed without leaking payload. Open/context intents do
not imply that a dialog/menu exists. Mutation requests continue through `KanbanRequestDispatcher`;
interaction intent never bypasses application authorization (PAR-B04/PAR-B08/PAR-B16).

## Board options and standalone viewport

`KanbanBoardOptions<TCard>` gains reactive getters for presentation, renderer, structure presentation,
and read-only/capability state plus the interaction factory and handler. `KanbanQuery.groupBy` remains
the sole semantic active-grouping authority; structure policy controls visibility, collapse, order,
disambiguation, and chrome for that selected field and rejects incompatible entries.
`KanbanViewportOptions<TCard>`
accepts the resolved read/presentation inputs required for a standalone viewport but does not create a
second interaction owner or emit application intents. A standalone viewport may receive the facade's
bounded state/transition adapter; without one it is focusable and scrollable but does not manufacture
board-level selection state (PAR-B05/PAR-B06).

## Validation and compatibility

All new public snapshots pass closed-key, type, length, cardinality, terminal-text, revision, and
semantic-role validation. Numeric `1` and string `'1'` are never stringified into the same identity.
New contracts are additive; existing Phase A construction remains valid with comfortable presentation,
no grouping, default controller, no handler, and the standard renderer (PAR-B14/PAR-B20).

## Testing requirements

- Packed NodeNext consumer coverage for every new public type/factory and unchanged Phase A usage.
- Property/edge tests for presentation normalization, per-card subset enforcement, frozen snapshots,
  key-type preservation, duplicate IDs, hostile text, invalid revisions, and handler exceptions.
- Package-boundary tests proving internal controllers/projectors remain private.
