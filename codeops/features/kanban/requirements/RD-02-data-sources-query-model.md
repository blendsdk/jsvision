# RD-02: Data Sources and Query Model

> **Document**: RD-02-data-sources-query-model.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Kanban must expose one observable read contract for small reactive arrays and very large remote or
windowed collections. A revisioned query session provides board-wide metadata and creates sparse cell
cursors only for visible or prefetched column×swimlane intersections. This prevents full-data scans,
N×M object allocation, dishonest counts, and stale range publication.

---

## Functional Requirements

### Must Have — Complexity XL

- [ ] Define public `KanbanDataSource<TCard>`, `KanbanQuerySession<TCard>`,
  `KanbanCellCursor<TCard>`, query, address, count, state, revision, and placement contracts.
- [ ] Provide an eager helper over reactive application cards and a documented custom/windowed source
  contract with identical observable semantics.
- [ ] Open a new query session when filter, grouping, sort, or relevant view semantics change; cancel
  and suppress stale session work.
- [ ] Create cell cursors lazily for visible/prefetched addresses and dispose them when no longer retained.
- [ ] Distinguish authoritative total, matching, loaded, visible, selected, and WIP counts.
- [ ] Represent ready, loading, refreshing, partial, empty, and error/retry states independently per
  session/cell while keeping unaffected cells usable.
- [ ] Support bounded range acquisition, unloaded reads, source completeness, and reactive revisions.
- [ ] Expose semantic placement anchors/tokens that distinguish logical start/end from a loaded-window edge.

### Should Have — Complexity L

- [ ] Batch metadata/count acquisition for visible columns/swimlanes to avoid request waterfalls.
- [ ] Support application-provided numeric summaries and honest loaded-versus-authoritative labels.
- [ ] Provide deterministic eager fixtures and controllable windowed fixtures in the testing entry.

### Won't Have (Out of Scope)

- Built-in REST, database, GraphQL, or filesystem adapters — applications adapt their own services.
- Inferring authoritative counts from loaded pages — a partial count must be labeled partial.
- Whole-array operations on a windowed source — these would hide 100,000-card scans.

---

## Technical Requirements

### Query/session lifecycle — Complexity L

A query is a validated semantic value containing active search/filter IDs and values, one optional
grouping field, sort directives, visible structure IDs, and a view revision. Opening it returns a
session with a unique revision and an owned abort/disposal boundary. Equivalent queries may reuse
application caches, but stale sessions may not publish into the active board.

The session shall provide:

- board/source state and revision;
- ordered column metadata and current optional swimlane metadata;
- exact or explicitly unknown/truncated authoritative counts;
- batch header/WIP/summary information; and
- an optional bounded, abort-aware `locateCard(key, { signal? })` identity lookup for imperative
  reveal, returning `found`, `unloaded`, `unknown`, or `unsupported` with the originating revision; and
- `cell(address)` producing a sparse cursor on demand.

The locator never returns a card body. A found or unloaded result carries a validated cell address and
optional projection index or placement anchor. Eager sessions resolve from their identity index;
windowed sources perform at most one bounded application lookup or report `unsupported`. Absence or an
unsupported result never permits a whole-source or whole-cursor scan. Cancellation and revision checks
suppress stale results.

Changing a query shall retain logical focus/selection IDs for later reconciliation but cancel active
range loads and drop prior session cursors after their consumers release them.

### Sparse cell cursor — Complexity XL

Each cursor addresses `{ columnId, swimlaneId?: string }` and exposes:

| Member | Required behavior |
|---|---|
| `state()` | Reactive cell state and sanitized retry metadata |
| `counts()` | Distinct authoritative/matching/loaded values with completeness flags |
| `length()` | Best-known display length; never passed off as authoritative when unknown |
| `cardAt(index)` | Loaded card or `undefined` for out-of-range/not-loaded |
| `ensureRange(start,end,{signal})` | Half-open bounded prefetch; coalesces overlap; honors abort |
| `revision()` | Reactive value changed when visible data/state/placement semantics change |
| `placementAt(slot)` | Known anchors/logical edge/window edge and optional placement token |
| `retry()` | Optional bounded retry request; does not mutate application records |
| `dispose()` | Idempotent release; prevents late publication |

Indices are projection-local and never mutation tokens. The viewport may read only the visible range
plus configured finite overscan and drag-prefetch bands. Cursor methods must remain side-effect free
except explicitly named acquisition/retry/dispose operations.

### Eager helper — Complexity L

The eager adapter shall accept a reactive card collection and stable adapters for key, column,
ordering/rank semantics, optional grouping values, and fields used by local filters/sort/summaries. It
shall build indexes incrementally or in one bounded derivation, preserve stable card references, reject
duplicate keys/unknown structural IDs, and publish a revision on structural/field changes.

The 5,000-card resident target permits O(n) query recomputation after a material filter/group/sort
change, but steady-state draw, focus, pointer movement, and scroll shall not repeat O(n) work.

### Windowed source — Complexity XL

- A source may report logical counts without loading cards.
- `cardAt` returns `undefined` for an in-range unloaded slot; the board renders a bounded loading/partial
  surface and may call `ensureRange`.
- Repeated/overlapping range requests shall be coalesced or bounded by the source; the board shall not
  issue one request per card or theoretical cell.
- Late results carry the originating query/cursor revision and are ignored after supersession/disposal.
- Unloading a page does not remove selected identity. Authoritative deletion does.
- Placement at an unknown loaded boundary is `window-edge`; it is actionable only when the source
  supplies a revision-scoped token or resolves neighboring anchors.

### Counts and summaries — Complexity M

| Count | Definition |
|---|---|
| Total | All authoritative cards in the structural cell before view filters |
| Matching | Authoritative cards satisfying active filters/search |
| Loaded | Matching cards currently materialized in the cursor |
| Visible | Matching loaded descriptors inside the viewport after collapse/window clipping |
| Selected | Selected identities in the applicable declared scope |
| WIP | Authoritative workflow-policy count, unaffected by view filtering |

Unknown values use a typed unknown state, not `0`. Truncated/estimated values carry an explicit flag and
visible qualifier. Application summaries identify whether they are authoritative or loaded-only.

### Placement seam — Complexity L

For every visible insertion slot, the cursor returns one of:

- logical `start` or `end`, declared authoritative;
- `between` with stable nullable neighbor card keys;
- `window-edge` with its known neighbor and optional opaque `PlacementToken`; or
- unavailable with a localized reason and optional prefetch recommendation.

Tokens are bounded, opaque, revision-scoped strings. The component never decodes, persists, or reuses a
token after session/cursor revision change.

---

## Integration Points

- **RD-03** consumes only visible/overscan cursor ranges.
- **RD-05** consumes structural metadata, WIP counts, and swimlane groups.
- **RD-08** turns placement results/revisions into atomic requests.
- **RD-09** defines query construction and saved semantic state.
- **RD-14** verifies scale, cancellation, bounded work, and stale suppression.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Scale modes | Eager / windowed / both | Both, one read shape | Equal small/large support | AR #10 |
| Source topology | Flat / eager cell matrix / sparse session | Sparse query session | Batching without N×M subscriptions | AR #42 |
| Counts | Infer loaded / authoritative contract | Distinct honest counts | Prevent misleading WIP/totals | AR #15, #21, #37 |
| Placement | Index / anchors / token / hybrid | Anchors+edge+token+revision | Stable across windows/concurrency | AR #32 |

---

## Security Considerations

- Source callbacks are trusted application code but all returned IDs, counts, ranges, state messages,
  and descriptors are validated and bounded before rendering.
- Error diagnostics redact card values and opaque tokens; tokens must never be logged.
- Range arguments reject negative, non-integer, reversed, and over-bound spans before calling sources.
- Cancellation bounds resource use but is not authorization. Remote endpoints must validate, authorize,
  rate-limit, encrypt, and sanitize independently.
- Source failures are isolated to their session/cell and cannot inject ANSI control sequences.

---

## Acceptance Criteria

1. [ ] An eager 5,000-card fixture reports exact total/matching/loaded counts and returns every in-range
   card synchronously by stable identity.
2. [ ] A 100,000-logical-card windowed fixture can render an 80×24 board while reading only visible
   ranges plus configured finite overscan; a full-card scan fails the specification test.
3. [ ] No source cursor is created for an offscreen, collapsed, hidden, or unprefetched theoretical cell.
4. [ ] Overlapping `ensureRange(0,20)` and `ensureRange(10,30)` calls result in bounded/coalesced
   acquisition rather than forty independent card requests.
5. [ ] Changing the query aborts outstanding old-session signals; resolving those old promises does not
   change active cards, counts, state, or frames.
6. [ ] An unloaded in-range `cardAt` returns `undefined` and renders partial/loading state, not an empty
   card or a total-count decrement.
7. [ ] A cell can show an error/retry state while cards and source data in another ready cell remain
   usable. Navigation and editing behavior, when present, remain available under their owning RDs and
   are not disabled by the neighboring source error.
8. [ ] Filtering changes matching/visible counts but leaves authoritative WIP and total counts unchanged.
9. [ ] An unknown authoritative count renders an explicit unknown/partial qualifier, never `0`.
10. [ ] A last-loaded-card placement remains `window-edge` whenever completeness is unknown, including
    when it carries a valid placement token; only an authoritative source completeness declaration can
    produce logical `end`.
11. [ ] Reusing a placement token after cursor revision change is rejected before dispatch.
12. [ ] Disposing a cursor twice is safe, aborts owned acquisition once, and suppresses all later results.
13. [ ] Selection identity survives page unload/reload but is pruned after an authoritative deletion event.
14. [ ] Duplicate card keys or unknown column IDs reject the affected source publication without partially
    replacing the last valid active session.
15. [ ] Negative, fractional, reversed, and configured-over-limit ranges never call application source code.
16. [ ] Source errors and observations contain source/cell IDs and codes but no card body or placement token.
17. [ ] Locating an unloaded key in a 100,000-card session performs at most one bounded source lookup,
    returns a revision-bound discriminated result, honors cancellation, and never scans loaded cells or
    card bodies; unsupported lookup remains an explicit result.
