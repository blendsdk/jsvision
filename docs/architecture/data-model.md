# Kanban data model

> **Last Updated**: 2026-08-10
> **Status**: Phase B contracts, reads, structure, presentation, scene, and interaction state implemented

## Domain model

```mermaid
erDiagram
    BOARD ||--|{ COLUMN : orders
    BOARD ||--o{ SWIMLANE : groups
    COLUMN ||--o{ CELL : intersects
    SWIMLANE ||--o{ CELL : intersects
    CELL ||--o{ CARD_PROJECTION : contains
    CARD_PROJECTION ||--o{ SUMMARY_SECTION : presents
    SUMMARY_SECTION ||--o{ CHECKLIST_ITEM : previews
    BOARD ||--|| SCENE : projects
    SCENE ||--o{ ACTION_TARGET : exposes
    BOARD ||--|| INTERACTION_SNAPSHOT : owns
    INTERACTION_SNAPSHOT ||--o{ SELECTED_CARD : references
    BOARD ||--o{ SAVED_VIEW : restores
    QUERY_SESSION ||--|{ CELL_CURSOR : exposes
    CELL_CURSOR ||--o{ CARD_PROJECTION : windows
```

## Entities and value objects

| Entity             | Identity and key fields                                              | Ownership                                                  | Invariants                                                               |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Board definition   | Board ID, ordered columns, optional swimlane dimension               | Application                                                | IDs are stable; column order is explicit                                 |
| Column             | ID, name, order, workflow metadata, WIP/DoD policy                   | Application                                                | Deletion of non-empty columns requires atomic reassignment or rejection  |
| Swimlane           | ID, label, order, visibility/collapse state                          | Application for structure; board for temporary hover lease | At most one grouping dimension; no nested swimlanes                      |
| Card record        | Application-defined `TCard`                                          | Application                                                | Package never mutates or persists the record directly                    |
| Card projection    | Stable ID, title/status descriptors, summaries, semantic styles      | Adapter/package                                            | Descriptor output is bounded and safe to render                          |
| Cell cursor        | Column/swimlane coordinate, revision, loaded window, edge knowledge  | Query session                                              | Loaded boundaries are not assumed to be logical edges                    |
| Placement          | Destination coordinate and opaque rank token                         | Source/dispatcher contract                                 | Token is semantic, bounded, and not interpreted by the view              |
| Scene              | Revision, retained rows, clipped regions, semantic targets           | Viewport                                                   | Finite visible/overscan snapshot; no application record payloads         |
| Interaction        | Revision, focus, ordered selected keys, range/pending/feedback state | Board-owned controller                                     | Detached immutable snapshot with finite selection                        |
| Interaction intent | Kind, origin, closed scope, eligible selection snapshot              | Component to application handler                           | Identity-only evidence; never authorizes or performs mutation            |
| Saved view         | Version, query, grouping, order, density, visibility                 | Application storage                                        | Semantic configuration only; transient focus/drag/load state is excluded |

## State ownership

| State                                                     | Owner                 | Lifetime                         |
| --------------------------------------------------------- | --------------------- | -------------------------------- |
| Card records, workflow policy, authorization, persistence | Application           | Durable                          |
| Saved-view JSON                                           | Application           | Durable and versioned            |
| Query revision and loaded windows                         | Query session         | Until query replacement/disposal |
| Focus, selection, scroll, hover, pending navigation       | Board/controller      | Mounted board session            |
| Pending press and semantic interaction intent             | Viewport/facade       | One input or serialized action   |
| Open dialog, drag ghost, insertion marker                 | Later board/dialog UI | Not implemented in Phase B       |

## Data flow

1. The application supplies a `KanbanDataSource<TCard>` and opens a revisioned query session.
2. The board asks sparse cell cursors only for visible and overscan ranges.
3. Card adapters derive bounded presentation descriptors from application records.
4. Mounted or programmatic interaction updates immutable focus/selection state and may emit an
   identity-only semantic intent to the application.
5. When a data operation is requested, the application authorizes and applies its discriminated
   request, then publishes committed source state or a rejection. The component reconciles from that
   authoritative result.

## Implemented source invariants

- Source publications are validated as complete snapshots. Duplicate card keys, unknown columns, or
  invalid metadata retain the last complete eager index and emit only a bounded, payload-free
  observation.
- Card keys preserve JavaScript primitive identity, so numeric `1` and string `"1"` remain distinct.
- Sort directives are lexicographic and stable; ties retain source order.
- Counts explicitly distinguish exact, estimated, truncated, lower-bound, and unknown knowledge.
- A source reports viewport-visible count as unknown; only viewport projection can make it exact.
- Cursor ranges are normalized, coalesced, bounded, cancellable, and tied to a session generation.
- Application card objects are projected by reference; the source does not clone, mutate, or persist
  them.

## Implemented presentation invariants

- A card descriptor is an immutable snapshot containing exact-cell rows, semantic sections, bounded
  actions and hit regions, explicit degradation, and at least one non-color state marker.
- Adapter values and descriptor collections are captured once. Later caller mutation, custom array
  iteration, accessors, or changing array length cannot alter the validated snapshot.
- Text is bounded by UTF-8 bytes and terminal cells after control and bidirectional-control rejection.
- Application action IDs use a bounded namespaced grammar and cannot enter the package-reserved
  `jsvision.*` namespace.
- Theme tokens use an exhaustive package-local role inventory. Unknown roles cannot become renderable
  descriptor values.

## Implemented workflow-structure invariants

- Column and grouping policies are exact-shape, bounded, immutable snapshots with stable semantic
  identities and equality-only revisions.
- WIP, definition-of-done, and transition evaluators return presentation eligibility and reasons;
  the application remains the authorization boundary.
- Grouping follows only the query-selected field and supports no nested dimension. Hidden groups and
  memberships remain detached rather than being destroyed.
- Missing or unmapped values and resolver failures use distinct configured groups. Malformed or
  throwing resolvers cannot publish partial membership and produce only payload-free observations.
- Custom swimlane chrome is bounded and header-only. Collapsed hover expansion is temporary and
  generation-owned, so it never rewrites durable or saved-view collapse state.

## Implemented scene and interaction invariants

- One canonical immutable scene owns final clipped geometry and semantic hit targets for each
  viewport revision. Pointer code never reconstructs targets from stale rectangles.
- Sparse card heights distinguish exact measurements from estimates. Retained projection work is
  bounded to visible and overscan ownership, including variable-height gaps.
- Card action regions include descriptor crop offsets before final clipping, preserving alignment for
  partially visible cards.
- Focus uses semantic board/column/swimlane/card targets. Ordered selection contains only eligible
  card keys and is bounded by configured limits; application server selection remains an opaque
  separately identified reference.
- Async navigation carries generation and cancellation evidence. A later resize, query, structure,
  explicit scroll, new navigation, Escape, or disposal prevents stale completion from publishing.
- A click commits only on matching down/up semantic identity, button, and scene revision. Move/drag
  cancels the pending press; Phase B does not create drag state.
- Interaction intents contain stable identities, origin, closed scope, and a detached eligible
  selection. They never retain application records or imply mutation authorization.

## Compatibility and migration

Public TypeScript contracts, ten stable foundation catalogs, and ten additive Phase B overlays follow
package semantic versioning.
Saved-view codecs remain a later phase governed by the accepted application-owned semantic storage
decision; transient scene, focus, selection, press, and pending-navigation state is not a durable
saved-view model.
