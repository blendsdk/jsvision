# Kanban data model

> **Last Updated**: 2026-08-03
> **Status**: Accepted design; implementation pending

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
    BOARD ||--o{ SAVED_VIEW : restores
    QUERY_SESSION ||--|{ CELL_CURSOR : exposes
    CELL_CURSOR ||--o{ CARD_PROJECTION : windows
```

## Entities and value objects

| Entity           | Identity and key fields                                             | Ownership                                                 | Invariants                                                               |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Board definition | Board ID, ordered columns, optional swimlane dimension              | Application                                               | IDs are stable; column order is explicit                                 |
| Column           | ID, name, order, workflow metadata, WIP/DoD policy                  | Application                                               | Deletion of non-empty columns requires atomic reassignment or rejection  |
| Swimlane         | ID, label, order, visibility/collapse state                         | Application for structure; session for transient collapse | At most one grouping dimension; no nested swimlanes                      |
| Card record      | Application-defined `TCard`                                         | Application                                               | Package never mutates or persists the record directly                    |
| Card projection  | Stable ID, title/status descriptors, summaries, semantic styles     | Adapter/package                                           | Descriptor output is bounded and safe to render                          |
| Cell cursor      | Column/swimlane coordinate, revision, loaded window, edge knowledge | Query session                                             | Loaded boundaries are not assumed to be logical edges                    |
| Placement        | Destination coordinate and opaque rank token                        | Source/dispatcher contract                                | Token is semantic, bounded, and not interpreted by the view              |
| Saved view       | Version, query, grouping, order, density, visibility                | Application storage                                       | Semantic configuration only; transient focus/drag/load state is excluded |

## State ownership

| State                                                     | Owner                  | Lifetime                         |
| --------------------------------------------------------- | ---------------------- | -------------------------------- |
| Card records, workflow policy, authorization, persistence | Application            | Durable                          |
| Saved-view JSON                                           | Application            | Durable and versioned            |
| Query revision and loaded windows                         | Query session          | Until query replacement/disposal |
| Focus, selection, scroll, hover, open dialog              | Board instance         | Session                          |
| Drag ghost, insertion marker, validation request          | Board/dialog operation | Transient                        |

## Data flow

1. The application supplies a `KanbanDataSource<TCard>` and opens a revisioned query session.
2. The board asks sparse cell cursors only for visible and overscan ranges.
3. Card adapters derive bounded presentation descriptors from application records.
4. User interaction creates a normalized request carrying an expected revision and semantic
   placement where relevant.
5. The application authorizes and applies the operation, then publishes committed source state or a
   rejection. The component reconciles from that authoritative result.

## Compatibility and migration

Public TypeScript contracts follow package semantic versioning. Saved views use a separate explicit
schema version and package-provided decode/migration helpers. Unknown versions, oversized values, and
invalid nesting are rejected without partially applying configuration.
