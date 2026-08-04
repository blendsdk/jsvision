# Technical specification: query, session, and cursors

> **Document**: 03-02-query-session-cursors.md
> **Parent**: [Index](00-index.md)
> **Decision sources**: PAR-09–PAR-10, PAR-14, PAR-19–PAR-20, PAR-22, PAR-27–PAR-28
> **CodeOps Artifact Schema**: 1

## Semantic query values

`KanbanQuery` is an immutable semantic value, not UI state. It contains active search/filter IDs and
values, at most one grouping field, ordered sort directives, visible column/swimlane IDs, and a view
revision. Filter values use this recursive public domain:

```ts
export type KanbanSemanticValue =
  | null
  | boolean
  | number
  | string
  | readonly KanbanSemanticValue[]
  | { readonly [key: string]: KanbanSemanticValue };
```

The boundary walker validates and snapshots in one traversal:

1. reject cycles, accessors, symbols, functions, bigint, `undefined`, custom prototypes, sparse arrays,
   non-finite numbers, unsafe keys, and every configured depth/count/string/encoded-byte violation;
2. copy into package-owned arrays and ordinary null-prototype-free plain records;
3. order object keys lexicographically for deterministic traversal; and
4. deep-freeze before a source sees the query.

Semantic equality compares value kinds, array order, numeric value (`-0` normalized to `0`), and object
entries independent of caller insertion order. An internal canonical fingerprint may accelerate
equality/cache lookup, but serialized bytes are never the public query representation.

The public query representation is exact and immutable:

```ts
export interface KanbanFilter {
  readonly fieldId: KanbanFieldId;
  readonly operatorId: KanbanExtensionId;
  readonly value: KanbanSemanticValue;
}

export interface KanbanSort {
  readonly fieldId: KanbanFieldId;
  readonly direction: 'ascending' | 'descending';
}

export interface KanbanQuery {
  readonly search?: string;
  readonly filters?: readonly KanbanFilter[];
  readonly groupBy?: KanbanFieldId;
  readonly sort?: readonly KanbanSort[];
  readonly visibleColumnIds?: readonly KanbanColumnId[];
  readonly visibleSwimlaneIds?: readonly KanbanSwimlaneId[];
  readonly viewRevision?: KanbanRevision;
}
```

`snapshotKanbanQuery` validates identifiers, uniqueness, bounds, exact data-property shapes, and
semantic filter values; it returns a detached deeply frozen query. Omitted arrays normalize to frozen
empty arrays so downstream equality and iteration have one representation. Search is bounded semantic
input, not pre-rendered terminal text.

## Exact source values

Source state uses `{ kind: 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' }` or
`{ kind: 'error'; code: string; label?: string }`. Error codes use the package reason-code grammar and
labels are sanitized and bounded before publication.

Every count is one of:

```ts
export type KanbanCount =
  | { readonly quality: 'unknown' }
  | {
      readonly quality: 'exact' | 'estimated' | 'truncated';
      readonly value: number;
    };

export interface KanbanBoardCounts {
  readonly total: KanbanCount;
  readonly matching: KanbanCount;
  readonly loaded: KanbanCount;
  readonly visible: KanbanCount;
  readonly selected: KanbanCount;
  readonly wip: KanbanCount;
}
```

Known values are finite non-negative safe integers. `unknown` has no `value`, which makes accidentally
presenting unknown as zero structurally impossible. Column and swimlane metadata use exact
`{ columnId, label, revision }` and `{ swimlaneId, label, revision }` records. A cell address is exact
`{ columnId, swimlaneId? }`; canonical address keys preserve boundaries rather than concatenating raw
IDs.

`KanbanHeaderBatch` contains a revision plus exact column and swimlane header arrays. Each header has
its semantic ID, sanitized label, optional WIP count, and a bounded numeric summary map. Every summary
has explicit `authoritative | loaded-only` scope and count-like `unknown | exact | estimated |
truncated` quality; an unknown summary has no numeric value.
`KanbanIdentityChangeBatch` contains a revision and a bounded array of exact `deleted-card`,
`deleted-column`, or `deleted-swimlane` records carrying only the corresponding identity.

`KanbanSessionPublication` is the atomic detached snapshot of `revision`, `state`, `columns`,
`swimlanes`, `counts`, `headers`, and `identityChanges`. Validation accepts the complete publication or
rejects it without replacing the prior valid snapshot. Duplicate identities, unknown address columns,
malformed counts, accessors, unsafe prototypes, symbols, and out-of-bound collections reject the whole
publication.

## Source and session contract

```ts
export interface KanbanDataSource<TCard> {
  openQuery(query: KanbanQuery, options?: { readonly signal?: AbortSignal }): KanbanQuerySession<TCard>;
}

export interface KanbanQuerySession<TCard> {
  state(): KanbanSourceState;
  revision(): KanbanRevision;
  columns(): readonly KanbanColumnMeta[];
  swimlanes(): readonly KanbanSwimlaneMeta[];
  counts(): KanbanBoardCounts;
  headers(): KanbanHeaderBatch;
  identityChanges(): KanbanIdentityChangeBatch;
  cell(address: KanbanCellAddress): KanbanCellCursor<TCard>;
  locateCard?(
    key: CardKey,
    options?: { readonly signal?: AbortSignal },
  ): Promise<KanbanCardLocation> | KanbanCardLocation;
  dispose(): void;
}
```

`openQuery` is synchronous so the board owns cancellation/disposal immediately. A session may begin in
`loading`; asynchronous work belongs to the source's reactive publication and cursor operations.
Getter methods participate in JSVision reactivity. A source may reuse private caches across equivalent
queries but must return an independently disposable session boundary.

Source state distinguishes `ready`, `loading`, `refreshing`, `partial`, `empty`, and `error`; error
metadata uses stable localized reason codes and sanitized bounded labels. Counts distinguish
authoritative total, matching, loaded, visible, selected, and WIP, with explicit exact/estimated/
truncated/unknown quality. Phase A renders the applicable board/cell states without inventing missing
counts.

`identityChanges()` reports bounded authoritative deletion events separately from page unload. The
board reconciles its projection of optional focused/selected identity inputs against these events: an
unloaded key remains retained, while an authoritative deletion is pruned. Phase A exposes no command
that changes focus or selection; RD-06 later owns those interaction semantics.

`locateCard` is an optional bounded identity locator used by imperative reveal. Its exact discriminated
result is `found`, `unloaded`, `unknown`, or `unsupported`; every member carries `sessionRevision`.
`found` and `unloaded` also carry a validated `address` and may carry a non-negative safe `index` and
semantic `placement`. It never returns a card body. Implementations honor cancellation, and the board
suppresses a result after its generation/session revision changes. Eager sessions resolve from their
key index; a windowed source may perform one bounded application lookup or return `unsupported`.
Absence never permits a scan.

## Sparse cursor contract

```ts
export interface KanbanCellCursor<TCard> {
  state(): KanbanCellState;
  counts(): KanbanCellCounts;
  length(): KanbanKnownLength;
  cardAt(index: number): TCard | undefined;
  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void>;
  revision(): KanbanRevision;
  placementAt(slot: number): KanbanPlacement;
  retry(): Promise<void> | void;
  dispose(): void;
}
```

The cursor's public values are exact:

```ts
export type KanbanCellState =
  | { readonly kind: 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' }
  | {
      readonly kind: 'error';
      readonly code: string;
      readonly label?: string;
      readonly retry: 'available' | 'unavailable';
    };

export interface KanbanCellCounts {
  readonly total: KanbanCount;
  readonly matching: KanbanCount;
  readonly loaded: KanbanCount;
}

export type KanbanKnownLength =
  | { readonly kind: 'exact'; readonly value: number }
  | { readonly kind: 'at-least'; readonly value: number }
  | { readonly kind: 'unknown' };
```

Known count and length values are non-negative safe integers. Pure snapshot validators accept unknown
boundary input, enforce exact data-property shapes and active limits, sanitize error labels, and return
detached frozen values.

Every placement carries the cursor revision from which it was derived. `start` and `end` declare
authoritative logical edges. `between` carries `beforeCardKey` and `afterCardKey`, requires at least one
non-null neighbor, and rejects identical non-null neighbors. `window-edge` carries `edge: 'before' |
'after'`, a known `neighborCardKey`, and an optional opaque `token`. `unavailable` carries a safe `code`,
optional sanitized `label`, and an optional bounded half-open `prefetch` range.

`snapshotKanbanPlacement` validates that union without decoding tokens.
`assertKanbanPlacementCurrent(placement, currentRevision)` uses equality only and returns the placement
when its cursor revision is current; any stale start/end/anchor/window token/unavailable result raises a
typed sanitized source-publication error before future dispatch. An exact cursor length alone permits
logical `end`; an `at-least` or `unknown` final loaded slot remains `window-edge`, even with a token.

Identity changes are exact `deleted-card`, `deleted-column`, or `deleted-swimlane` records carrying
only their semantic identity. `KanbanIdentityChangeBatch` carries a revision and bounded changes.
`snapshotKanbanIdentityChangeBatch` rejects duplicate semantic identities and invalid/over-bound
records atomically. Unloading a page is never encoded as a deletion. Selection and focus reconciliation
remain owned by the Phase 4 board projection.

Ranges are half-open. Validate finite non-negative integers, `start <= end`, configured span, and safe
arithmetic before source application code runs. `cardAt` returning `undefined` for an in-range unloaded
slot never decrements counts or fabricates an empty card. `retry` is explicit and bounded; there is no
automatic unbounded loop. `dispose` is idempotent and suppresses all later publications.

Placement is a discriminated union for authoritative `start`/`end`, `between` nullable stable neighbor
keys, `window-edge` with known neighbor and optional revision-scoped token, or `unavailable` with a safe
reason/prefetch hint. Projection indices are never mutation tokens. Even though Phase A dispatches no
moves, the seam is complete now to prevent a later source rewrite.

## Read-projection generation coordinator

One private coordinator per `KanbanViewport` read projection owns:

```text
generation number
  └─ session + abort scope
      └─ Map<canonical cell address, entry>
          ├─ one cursor
          ├─ retention owners: visible | overscan | prefetch
          └─ descriptor reactive scopes
```

The address key encodes column and optional swimlane IDs without concatenation collision. `cell()` is
called only when the first retention owner appears. Owners are reconciled after projection; removing
the last owner disposes descriptor scopes and then the cursor.

On query change or viewport disposal:

1. increment/invalidate the generation before invoking cancellation;
2. abort viewport-owned loads;
3. dispose descriptor reactive scopes and release application card references;
4. dispose each cursor exactly once and clear the address map; and
5. dispose the session exactly once.

All asynchronous continuations capture the originating generation and resource identity; a late result
is ignored before it can change active state, counts, cards, observations, or damage. Cursor failure is
scoped to its cell. Invalid whole-source structural publication retains the last valid session
publication or shows a board-level error if none exists.

Locator continuations follow the same generation-before-abort rule and never create a cursor until a
validated result is retained for reveal. Unsupported/unknown results are normal typed outcomes, not
source errors.

## Acquisition and boundedness

- The viewport computes retained addresses/ranges from visible geometry plus finite configured
  overscan. Hidden, collapsed, and unprefetched cells receive no cursor.
- Overlapping ranges are normalized and coalesced by the package coordinator before delegating when
  possible; the source contract must also bound duplicate acquisition.
- Concurrent loads are limited by `KANBAN_LIMITS`; queued work is finite and canceled with the
  generation.
- No draw, scroll, damage, or hit-map path may enumerate all logical cards or theoretical cells.
- Source instrumentation in the testing entry records session, cursor, range, read, publication,
  cancellation, and disposal activity without card payloads/tokens.

## Failure matrix

| Failure | Required result |
|---|---|
| Invalid query | Typed sanitized throw before `openQuery` |
| `openQuery` throws | Board error state; no partial session retained |
| Duplicate/unknown structural ID | Reject publication atomically; retain prior valid structure |
| Cell load rejects | Local error/retry surface; other cells remain usable |
| Invalid range | Typed throw; application callback count remains zero |
| Stale completion | Suppressed by generation/resource identity |
| Reused stale placement token | Reject before any future dispatch boundary |
| Observation callback throws | Swallow/isolate after bounded internal recording |
