# Technical specification: eager source and validation

> **Document**: 03-03-eager-source-validation.md
> **Parent**: [Index](00-index.md)
> **Decision sources**: PAR-11, PAR-14, PAR-17, PAR-19–PAR-20, PAR-27–PAR-30
> **CodeOps Artifact Schema**: 1

## Eager helper API

```ts
export interface EagerKanbanSourceOptions<TCard> {
  readonly columns: () => readonly KanbanColumnMeta[];
  readonly keyOf: (card: TCard) => CardKey;
  readonly columnOf: (card: TCard) => KanbanColumnId;
  readonly compare?: (left: TCard, right: TCard) => number;
  readonly groupingFields?: readonly KanbanGroupingField<TCard>[];
  readonly filterFields?: readonly KanbanFilterField<TCard>[];
  readonly sortFields?: readonly KanbanSortField<TCard>[];
  readonly summaries?: readonly KanbanSummaryAdapter<TCard>[];
  readonly limits?: KanbanLimitOptions;
  readonly observe?: (observation: KanbanObservation) => void;
}

export function createEagerKanbanDataSource<TCard>(
  cards: () => readonly TCard[],
  options: EagerKanbanSourceOptions<TCard>,
): KanbanDataSource<TCard>;

export interface KanbanGroupingField<TCard> {
  readonly id: KanbanFieldId;
  readonly swimlaneOf: (card: TCard) => KanbanSwimlaneId | undefined;
}

export interface KanbanFilterOperator<TCard> {
  readonly operatorId: KanbanExtensionId;
  readonly matches: (card: TCard, value: KanbanSemanticValue) => boolean;
}

export interface KanbanFilterField<TCard> {
  readonly fieldId: KanbanFieldId;
  readonly operators: readonly KanbanFilterOperator<TCard>[];
}

export interface KanbanSortField<TCard> {
  readonly fieldId: KanbanFieldId;
  readonly compare: (left: TCard, right: TCard) => -1 | 0 | 1;
}

export interface KanbanSummaryAdapter<TCard> {
  readonly summaryId: KanbanFieldId;
  readonly scope: 'authoritative' | 'loaded-only';
  readonly aggregation: 'sum' | 'minimum' | 'maximum' | 'average';
  readonly valueOf: (card: TCard) => number | undefined;
}
```

Both cards and columns are reactive getters. `keyOf` and `columnOf` are required. If `compare` is
absent, the adapter preserves source order; if present, it applies a stable sort with source index as
the final tie-break. Cards retain their original object identity. Adapters are pure synchronous
callbacks; exceptions become a scoped invalid publication/observation rather than a partial index.
Filter fields explicitly register unique supported operator IDs, so unknown fields/operators reject
before a session opens. Filters are ANDed in query order. Query sorts apply lexicographically; each
sort callback returns exactly `-1 | 0 | 1`, followed by the optional source comparator and source
index. Summary callbacks return only finite numeric contributions or `undefined`; package-owned
aggregation publishes typed exact numeric summaries with declared authority scope, or typed unknown
when no card contributes.

## Derivation transaction

Each reactive recomputation builds a candidate snapshot off to the side:

1. validate and snapshot ordered column metadata;
2. scan resident cards once, validating key, column, optional swimlane, and queried field adapters;
3. reject duplicate keys and unknown structural IDs;
4. create keyed card metadata and per-address ordered card-reference arrays;
5. evaluate validated local filters and sort directives;
6. calculate exact total/matching/loaded counts and declared summaries; and
7. publish the complete candidate and new revision atomically.

On any failure, retain the last valid snapshot and publish a bounded sanitized source observation. On
first-publication failure, expose a board-level error. Never modify or clone application card records.
The 5,000-card target permits O(n) recomputation after material cards/query changes; steady draw and
scroll consume cached per-cell indexes.

## Query evaluation

Local filter/sort/grouping registries are keyed by validated stable IDs. Unknown filter/sort/grouping
IDs reject the query before a session is opened. A grouping field maps a card to a bounded semantic
swimlane ID. Values are already package-owned semantic snapshots. Field
adapters decide domain interpretation and return allowlisted comparison results; no expression parser,
dynamic import, `eval`, regex supplied without an explicit adapter, or implicit property traversal is
provided.

Source order remains authoritative for columns. A column rename with the same ID changes display
metadata without relocating cards. A published order change reorders columns while card object/key
identity remains stable. Phase A supports no active swimlane UI, but the eager data shape can assign an
optional semantic swimlane for cursor parity through a validated keyed grouping adapter.

## Counts and placement

For an eager cursor:

- total, matching, and loaded counts are exact;
- `length()` is exact matching length;
- every in-range `cardAt` is synchronous;
- `ensureRange` validates and resolves without loading;
- `placementAt(0)` is logical start, the exact final slot is logical end, and interior slots are
  `between`; and
- WIP and application summaries are reported only when their adapters declare authoritative scope.

Filtering never changes authoritative total or WIP. It changes matching, loaded, and eventually visible
counts. Unknown values remain typed unknown; they are never coerced to zero.

## Revision rules

The eager source owns a scalar revision and changes it when any published structure, card identity/
placement/order, queried field value, count, state, or placement semantic changes. A cell cursor also
changes revision when its visible cards or placement semantics change. The source must publish a
presentation revision when in-place card values used by the renderer change; descriptor caching relies
on this invariant.

Equality is the only operation promised for revisions. Tests must use an injected deterministic
revision factory; production must not use timestamps as uniqueness proof.

## Public testing helpers

`@jsvision/kanban/testing` exports deterministic, documented helpers only:

- an eager card/column fixture builder with controllable reactive publication;
- an instrumented 100,000-logical-card windowed source that materializes requested ranges only;
- deterministic revision and deferred-promise controllers;
- source-call counters and safe event records; and
- board/viewport inspection helpers returning identities, geometry, state codes, and counts, never
  private cache objects.

The testing entry also exports
`createKanbanQueryLifecycleHarness({ source, initialQuery, observationCapacity?, inspectedAddresses? })`.
The returned black-box harness exposes only `replaceQuery(query)`, `snapshot()`,
`locateCard(key, { signal? })`, `observations()`, and idempotent `dispose()`. Its detached snapshot
contains the active query, session revision, state, counts, columns, swimlanes, and bounded inspected
card keys/addresses. Replacing a query invalidates the old generation before abort/disposal; no old
continuation may change this snapshot or its observations.

The harness may use the package's private generation coordinator but never exposes its identity,
generation number, address map, retention owners, scheduler, cursor instances, or mutable internals.
Specifications can supply ordinary public `KanbanDataSource` fakes. Deterministic eager/windowed
fixture controllers and their deferred publication/locator/instrumentation operations remain part of
the helper implementation task; they do not widen the lifecycle harness.

`createKanbanCursorLifecycleHarness({ cursor, address, keyOf, limits?, observe? })` is the matching
black-box seam for one cursor. It exposes only bounded `ensureRange(start, end, { signal? })`,
`snapshot({ indices?, slots? })`, `retry()`, `observations()`, and idempotent `dispose()`. Range calls
exercise the private normalization/coalescing coordinator; invalid ranges reject before the supplied
cursor sees a callback.

`KanbanCursorInspection` contains detached state/count/length/revision values, requested card keys or
explicit unloaded markers, requested placement kinds/anchors with opaque token values redacted, and
safe call/disposal counters. It never exposes card bodies, cursor/coordinator identity, range maps,
queues, retention owners, scheduler state, or mutable internals. A controlled cursor fixture may supply
deferred range resolution/rejection/publication and safe instrumentation. Disposing invalidates the
harness before aborting work, delegates cursor disposal exactly once, and suppresses every late result
from subsequent snapshots and observations.

The deterministic windowed scale fixture has this minimum testing-only shape:

```ts
export function createWindowedKanbanFixture<TCard>(options: {
  readonly logicalCardCount: number;
  readonly columns: readonly KanbanColumnMeta[];
  readonly swimlanes?: readonly KanbanSwimlaneMeta[];
  readonly initialRevision?: KanbanRevision;
  readonly materialize: (request: {
    readonly address: KanbanCellAddress;
    readonly start: number;
    readonly end: number;
  }) => readonly TCard[];
  readonly keyOf: (card: TCard) => CardKey;
  readonly eventCapacity?: number;
}): KanbanWindowedFixture<TCard>;
```

The fixture returns a public `source`, a `controller`, frozen `metrics()`, and idempotent `dispose()`.
The controller exposes detached `pendingRanges()` and resolves or rejects a request by numeric
`requestId`; it may also publish an exact deterministic session snapshot. Each pending range carries
session ID, safe address, half-open bounds, session/cursor revisions, and no card/query data.

```ts
export interface KanbanWindowedFixtureController {
  pendingRanges(): readonly KanbanPendingRange[];
  resolveRange(requestId: number): void;
  rejectRange(requestId: number, error: { readonly code: string; readonly label?: string }): void;
  publishSession(publication: KanbanSessionPublication): void;
}

export interface KanbanWindowedFixtureMetrics {
  readonly logicalCardCount: number;
  readonly openedSessions: number;
  readonly disposedSessions: number;
  readonly createdCursors: number;
  readonly disposedCursors: number;
  readonly ensureRangeCalls: number;
  readonly requestedRanges: readonly KanbanMetricRange[];
  readonly materializedCards: number;
  readonly cardAtReads: number;
  readonly abortedRequests: number;
  readonly suppressedLateSettlements: number;
  readonly publications: number;
  readonly retainedEvents: readonly KanbanWindowedFixtureEvent[];
}
```

Metrics contain logical card count; opened/disposed sessions; created/disposed cursors; range calls and
bounded requested intervals; cards materialized and read; aborted requests; suppressed late
settlements; publications; and a fixed-capacity event ring. Event kinds are limited to open session,
create cursor, ensure/resolve/reject/abort range, publish, and cursor/session disposal. Events contain
only numeric IDs, addresses, bounds, revisions, and safe codes.

Construction retains only O(columns + swimlanes + bounded telemetry), never an array or index sized by
`logicalCardCount`. `cell(address)` creates a cursor only on explicit access. `ensureRange` records one
validated request and cannot call `materialize` until controller resolution. Resolution invokes it once
for that span and validates the complete returned publication atomically. Metrics/event work remains
proportional to actual requests. The fixture never exposes coordinator maps, queues, schedulers,
retention owners, private cursor registries, card bodies/keys, placement tokens, raw errors, callbacks,
or promises. Overlap coalescing remains owned by the private cursor coordinator; metrics record only
what reaches the source.

Fixtures must be useful to package consumers testing their adapters; they are not production imports.

## Validation/property coverage

Property tests generate boundary values for identity bytes, semantic JSON depth/entries/strings,
column counts, range arithmetic, duplicate keys, stable sort ties, unknown IDs, revision changes, and
hostile terminal text. Generators are deterministically seeded and shrink failures. Tests assert both
the result and the absence of callback invocation/partial publication where validation should stop.

The scale suite uses operation counters rather than shared-CI time:

- 5,000 eager cards: one bounded derivation per material publication and O(visible) steady reads;
- 100,000 logical windowed cards: no full scan, only retained address/range reads; and
- cursor/session disposal: no late publication and no retained card body in observations.
