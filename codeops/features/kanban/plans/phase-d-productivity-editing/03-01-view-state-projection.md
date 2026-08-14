# View State and Projection: Phase D

> **Document**: 03-01-view-state-projection.md
> **Parent**: [Index](00-index.md)

## Overview

RD-09 view behavior is implemented as pure immutable state plus a disposable reactive controller.
It derives the existing `KanbanQuery`, preserves application authority, and optionally supplies
responsive search/filter/view chrome to `KanbanBoard` (AR-D03/D12).

## Public model

```ts
export interface KanbanViewState {
  readonly searchPolicy: 'transient' | 'durable';
  readonly search: string;
  readonly filters: readonly KanbanFilterSelection[];
  readonly quickFilters: readonly KanbanQuickFilterSelection[];
  readonly sort: readonly KanbanSort[];
  readonly grouping?: KanbanGroupingSelection;
  readonly columns: KanbanColumnViewState;
  readonly swimlanes: KanbanSwimlaneViewState;
  readonly presentation: KanbanViewPresentation;
  readonly revision: KanbanRevision;
}

export interface KanbanViewController {
  readonly state: () => KanbanViewState;
  readonly query: () => KanbanQuery;
  readonly summary: () => KanbanViewSummary;
  apply(transition: KanbanViewTransition): KanbanViewTransitionResult;
  replace(state: unknown): KanbanViewTransitionResult;
  clearFilters(): KanbanViewTransitionResult;
  subscribe(subscriber: KanbanViewSubscriber): () => void;
  dispose(): void;
}
```

All constructors snapshot exact bounded input. Stable field/operator/quick-filter/comparator IDs select
only registered behavior. Each quick-filter registry entry maps declaratively to one ordinary source
field/operator filter with an optional fixed value or bounded parameter codec. Entries also include a
localized label ID, sensitivity, and applicability. The controller validates selections and derives the
ordinary `KanbanFilter` list; eager, remote, and windowed sources remain the sole record evaluators.
Functions never enter saved JSON (AR-D13/D27).

`KanbanViewPresentation` contains density, ordered card-field IDs, ordered summary IDs, and checklist
mode. Field and summary identities are unique and independently bounded. Standard checklist preview
shows at most two source-order items, further clamped by the active resource limits.

`KanbanSort` gains an optional comparator ID. Existing `KanbanSortField { fieldId, compare }` remains
valid and normalizes to the reserved default comparator. Additive `comparators` may register one or more
`{ comparatorId, compare, default? }` entries; a field cannot mix legacy `compare` with `comparators`,
and exactly one default is required when several exist. Omission resolves to that default so existing
source configuration and one-comparator query getters remain source-compatible. Remote/windowed
sources receive the resolved comparator ID. Equal comparisons use this total `CardKey` order: safe
integers precede strings; integers compare numerically; strings compare by Unicode code point with lone
surrogates ordered by their numeric code unit. Number `1` and string `'1'` remain distinct.

## Deterministic projection

The controller enforces the RD-09 order: authoritative structure/membership → search and jointly
active filters → sort → one grouping → visibility/collapse/presentation → viewport window.
One successful transition creates exactly one new immutable state and query revision. Search typed into
standard chrome is a view-bar draft until debounce expiry; meanwhile `state()`, `query()`, capture,
subscriptions, and view events expose the last committed projection. Expiry commits state/query/revision
once. Clear cancels pending input and commits its clear transition. A bound controller prepares state/
query privately and passes it to one projection participant; the source coordinator stages the candidate
through first valid publication, prospective composed presentation, and current geometry. One batched commit activates the prepared source,
viewport revision, controller state/query, and coherent source-count summary; the reactive activation and
identity reconciliation consume that prepared publication without a second source refresh. The exact old
generation retires before external subscribers run. The transition guard remains active through the whole
subscriber pass. This guard starts before registry callbacks or source preparation, callback disposal
aborts the candidate, and disposal by an earlier subscriber stops later delivery. Failure/supersession aborts
the candidate, so no observer sees it. An unbound controller commits pure transitions synchronously.

- Search is terminal-safe, byte-bounded, and scheduled with configurable default `150 ms`.
- Each scheduling generation cancels the prior pending search publication and disposes cleanly.
- Filters apply logical AND; internal OR belongs only to a registered filter implementation.
- Named quick filters derive ordinary filters and are jointly active with explicit filters; unknown,
  inapplicable, or invalid parameter selections reject without changing the committed pair.
- Sorting appends stable card identity as the final deterministic tie-break where the adapter permits.
- Grouping is singular; selecting another replaces the prior group atomically.
- Hidden/collapsed groups remain view-only and never change placement or WIP authority.
- Sorted cells block within-cell manual rank; filtered ambiguous placement requires an application/source
  resolver already consumed by operation eligibility. Package ordering policy snapshots the committed
  query around application eligibility, fails unavailable if it changes, and reapplies ordering afterward.

## Counts, empty state, focus, and selection

`KanbanViewSummary` retains total, matching, loaded, visible, selected, and WIP counts with their
existing quality labels. Filtered-empty is distinct from true empty and exposes Clear Filters without
stealing search focus. Query publication triggers existing focus/selection reconciliation after the
new projection is observable; hidden selected identities are pruned from destructive scope according
to RD-06/RD-09 (AR-D03). Candidate source counts are staged with the state/query pair before subscriber
delivery; projected visible and selected counts refresh after draw without mixing source revisions.

The board-view binding is the only effective getter composer. Controller ownership is all-or-nothing:

| Channel | Without controller | With controller |
|---|---|---|
| Query and density | Existing getter unchanged | Controller committed state/query |
| Global durable presentation | Existing getter unchanged | Legacy bounded budget with controller checklist mode and two-item preview |
| Record-dependent `cardPresentation(card)` callback | Existing callback | Visual state and checklist IDs preserved; non-empty controller field/summary order wins |
| Column order/visible/collapsed/width/alignment | Existing structure and collapsed getters | Controller facets over base columns by ID |
| Column WIP/DoD/capabilities/style | Existing structure | Always preserved from base structure |
| Group resolver/membership/unassigned/fallback | Existing structure | Always preserved from base structure |
| Group field/order/visible/collapsed/presentation/disambiguator | Existing structure/query | Controller facets over matching base grouping |
| Effective structure revision | Existing revision unchanged | Canonical type-tagged pair of base and controller revisions |

The controller state contains every owned facet; none falls back individually. Disposing a mounted
controller freezes the last committed effective snapshot and makes view actions unavailable until board
reconstruction; it never silently falls back. Board construction without a controller is behavior-compatible.

## Standard chrome

`KanbanViewBar` is optional and composed above the viewport by the board. It uses DSL rows/columns,
measured controls, and overflow menus rather than permanent dense rails. Wide mode shows search, active
quick filters, sort/view affordances, and honest result summary; compact/narrow mode collapses secondary
actions behind a keyboard/mouse-reachable menu while preserving search, active-state cues, and Clear.
Chrome owns no record or mutation authority.

## Failure handling

| Failure | Behavior | AR Ref |
|---|---|---|
| Unknown required registry ID | Reject transition/restore atomically with structured diagnostic | AR-D04/D13 |
| Inapplicable or invalid quick-filter parameter | Reject transition atomically; do not open a candidate source | AR-D27 |
| Throwing evaluator or candidate open | Candidate aborts before activation; prior session/cursors/state/query remain usable; safe diagnostic emitted | AR-D13/D17 |
| Subscriber attempts a nested transition | Return typed `view-transition-active`; finish or stop the current delivery first | AR-D27 |
| Application eligibility changes the view | Return typed `view-transition-stale`; do not dispatch against stale ordering | AR-D27 |
| Disposed controller | Return unavailable/no-op; no late scheduled publication | AR-D06/D12 |
| Filtered placement unresolved | Disable ambiguous manual reorder with localized reason | AR-D09 |
| Search scheduler failure | Publish safe unavailable feedback; input and prior projection remain usable | AR-D12 |

## Target modules

`src/view/types.ts`, `registry.ts`, `state.ts`, `controller.ts`, `query.ts`, `scheduler.ts`,
`summary.ts`, `view-bar.ts`; existing `source/{types,validation,eager-index,session-coordinator}.ts`
and remote/windowed contracts; plus a projection-participant/board binding that owns the prepare/commit/
abort handshake. Replacement stages a candidate through first valid publication before one batched
controller/viewport/session activation, atomic count evidence, and retirement of the old generation.
No view state is added to `KanbanViewport` beyond existing query consumption.

## Testing requirements

ST-DV-01…DV-16 cover atomic transitions, debounce, combined filters, deterministic sort/grouping,
counts, filtered empty, focus reconciliation, manual-order eligibility, responsive chrome, disposal,
hostile registries, and existing query-getter compatibility.
