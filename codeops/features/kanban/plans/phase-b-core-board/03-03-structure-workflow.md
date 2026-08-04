# Structure and Workflow: Kanban Phase B Core Board

> **Document**: 03-03-structure-workflow.md
> **Parent**: [Index](00-index.md)

## Overview

This specification owns normalized workflow columns, zero-or-one swimlane grouping, visibility,
collapse, WIP/DoD/transition presentation, header summaries, and distinct structural states. It does
not authorize or persist application mutations (PAR-B04/PAR-B12).

## Structural presentation model

Phase B adds validated reactive `KanbanStructurePolicy<TCard>` input to the board/source adapter layer.
It projects, by stable ID:

- column width preference, visibility, collapse, WIP policy, DoD summary/details, capability labels,
  and optional semantic style;
- presentation for the zero-or-one grouping field selected solely by `KanbanQuery.groupBy`: explicit or
  registered derived resolver, unassigned-group policy, presentation variant, visible/collapsed group
  sets, ordering, disambiguator, counts/summaries, capabilities, and optional semantic style.

Source/session metadata stays authoritative for identities, counts, states, and revisions. View policy
may hide/collapse/reorder only through validated semantic configuration and never renames IDs. A label
change preserves placement, focus, selection, and saved semantic reference (PAR-B04/PAR-B27).

Hidden and collapsed are distinct. Hidden entities are absent from the scene and never auto-revealed.
Collapsed entities retain header/count/summary/actions while suppressing card regions and ordinary
cursor retention. Expansion is reversible view state, not structural creation/deletion (PAR-B27).

## Grouping normalization

At most one `KanbanQuery.groupBy` field is active. Structure policy never names or replaces a competing
active field; incompatible policy entries reject atomically. Explicit sessions publish ordered
swimlanes. The eager helper may
register pure derived group resolvers keyed by bounded field ID. Each card resolves to exactly one
semantic group before visibility projection:

1. a valid registered/explicit group ID;
2. configured `unassigned` only for missing/unmapped values;
3. a local fallback plus redacted observation when the resolver throws/returns invalid data.

Hiding a semantic group omits that group and its cards; those cards do not move to `unassigned`.
Derived structural capabilities remain disabled unless the application supplies an explicit mapping.
Duplicate normalized display names reject by default; when allowed, every colliding header requires a
distinct visible disambiguator (PAR-B16/PAR-B27).

The eager source incrementally indexes only occupied `{columnId, swimlaneId?}` membership and lazily
synthesizes an empty cell result when an absent semantic address is requested. It reuses the Phase A
bounded query/session contract and never initializes a column×swimlane address matrix. A windowed source
publishes the same normalized semantics and opens only requested cells (PAR-B05/PAR-B07).

For arbitrary grouped windowed sources, a session may expose an additive, abort-aware, revision-bound
layout-hint method. A bounded request for a swimlane-axis window returns payload-free row extent/count
summaries with exact/lower-bound/unknown quality, source/session revision, and query generation. It never
publishes a full per-cell matrix. Without the optional hint, the board progressively projects known
rows and reports distant reveal/navigation as unavailable rather than enumerating preceding cells or
claiming exact scrolling.

## WIP policy evaluator

`evaluateKanbanWip` is a pure snapshot evaluator (PAR-B12):

```ts
export type KanbanWorkflowEvaluation =
  | { readonly kind: 'allowed'; readonly violation?: KanbanWorkflowViolationEvidence }
  | { readonly kind: 'warning'; readonly code: string; readonly label?: string }
  | { readonly kind: 'blocked'; readonly code: string; readonly label?: string }
  | { readonly kind: 'unavailable'; readonly code: string; readonly retryable: boolean };
```

It accepts validated min/max non-negative integers, mode, authoritative WIP count quality, explicit done
count policy, and proposed delta. Filters/matching counts never substitute for authoritative WIP.
Informational mode reports violation while allowing; advisory returns warning; blocking returns blocked
when exact evidence proves violation and unavailable when authority is unknown. The evaluator is UI
advice only; RD-08's dispatcher must revalidate against current authoritative state.

## Definition of done and transitions

Headers show a compact semantic DoD indicator when configured; complete safe text is available through
the focused help/interaction snapshot, not permanently expanded chrome. A pure transition evaluator
receives source/target IDs, ordered card keys, revisions, count/DoD context, and one application resolver.
It returns the same four-outcome union. Forward/backward direction has no built-in policy. Resolver
failure returns unavailable with a payload-free observation; it never authorizes a move (PAR-B12/PAR-B16).

Phase B renders eligibility/violation feedback and exposes evaluators programmatically but produces no
move request or insertion placement (PAR-B01/PAR-B18).

## Swimlane presentation contract

The semantic structure is identical for every variant. Presentation is a reactive enum
`'hybrid' | 'separator' | 'band' | 'rail'` or a bounded custom descriptor:

| Variant | Geometry responsibility |
|---|---|
| Hybrid | Compact titled separator plus themed card region |
| Separator | Dividing row with safe title/count, no region fill |
| Band | One header row plus themed group region |
| Rail | Bounded left label rail; degrades to hybrid when any card column would fall below 18 cells |
| Custom | One validated chrome descriptor within PAR-B28's complete budget |

Custom descriptors may choose bounded rows, rail width, safe roles/text, and header actions/regions, but
cannot create card/insertion/drop targets or change semantic membership. They execute once per visible
swimlane presentation revision, not once per card/cell (PAR-B28).

## Structural states

The canonical scene distinguishes board/column/swimlane/cell scope and these semantic state codes:

- true empty;
- filtered empty with clear-filter semantic action only when filters exist;
- loading and refreshing;
- partial/unknown;
- collapsed;
- hidden (absent, observable only in detached structure state);
- error with scoped retry capability;
- no columns and minimum geometry.

Counts and completeness never infer state from currently loaded cards. Retry stays scoped to the owning
session/cursor and invokes that source seam directly. Clear Filters, capable header collapse/
configuration, custom header action, and Add Card emit bounded scoped application intents; application
query/policy republication is the only way visible structure changes. Add Card remains an inert intent
hook until the later creation/mutation phase; Phase B does not advertise a working creator
(PAR-B01/PAR-B25).

## Temporary hover expansion hook

`KanbanCollapsedHoverController` accepts begin/leave/cancel operations for one visible collapsed
swimlane. A generation-safe 500 ms timer (from central limits) exposes temporary expansion, one lease at
a time. Leave/cancel/dispose restores the underlying collapsed state; success never persists it. RD-07
will call the hook from real drag hover; Phase B tests the controller only (SPEC-B-HOVER-HOOK).

## Testing requirements

- Rename/ID stability, visibility versus collapse, final-column/zero-column state, source reorder, and
  bounded cursor retention.
- Exact/unknown WIP across informational/advisory/blocking modes and filtered versus authoritative count.
- Arbitrary transition results, resolver failure, DoD compact/full evidence, and no mutation.
- Explicit/derived/unassigned grouping, hidden restoration, duplicate display names, all presentation
  variants, rail degradation, custom descriptor rejection, and hover lease timing/cancellation.
- Distinct state codes/actions and sanitized hostile structural text.
