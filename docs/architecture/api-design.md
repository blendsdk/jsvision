# Kanban API design

> **Last Updated**: 2026-08-04
> **Status**: Contracts, sources, card presentation, workflow structure, theme, and Phase B catalog APIs implemented; canonical scene and dialogs planned

## API style

`@jsvision/kanban` is a browser-neutral, typed in-process SDK. Its main barrel exposes models,
adapters, the board, commands, and package-owned dialogs. Locale catalogs use explicit locale
subpaths, and deterministic fixtures use a `/testing` subpath. The design deliberately avoids
separate `/model` or `/dialogs` public subpaths.

## Public topology

| Surface                       | Purpose                                             | Authority                                         |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| `KanbanBoard<TCard>`          | DSL-composed board component                        | Component session state                           |
| `KanbanDataSource<TCard>`     | Open a coherent query session                       | Application/data adapter                          |
| Query session and cell cursor | Bounded lazy acquisition and edge/count knowledge   | Data adapter                                      |
| Card adapter/descriptors      | Map arbitrary records to safe visual content        | Application/package adapter                       |
| Structure/grouping policy     | Normalize columns and one optional swimlane axis    | Application policy; component projection          |
| Workflow evaluators           | Report WIP, DoD, and transition eligibility         | Pure presentation logic; never authorization      |
| Swimlane presentation         | Resolve bounded built-in or custom header chrome    | Component with validated application extension    |
| `KanbanRequest` dispatcher    | Carry every requested mutation atomically           | Application                                       |
| Commands and keymap           | Keyboard/menu/programmatic actions                  | Component, gated by capabilities                  |
| Card/configuration dialogs    | Collect validated request inputs                    | Package UI; application decides whether to invoke |
| Saved-view codec              | Validate and migrate durable semantic configuration | Package codec; application storage                |

## Request protocol

```mermaid
sequenceDiagram
    participant U as User or command
    participant K as Kanban component
    participant A as Application dispatcher
    participant S as Authoritative source

    U->>K: Invoke action
    K->>K: Validate capability and normalize input
    K->>A: Dispatch discriminated request
    A->>A: Authorize and apply atomically
    alt accepted
        A-->>K: Accepted result + publication expectation
        A->>S: Publish new revision
        S-->>K: Updated query/session data
        K-->>U: Reconciled committed state
    else rejected
        A-->>K: Bounded rejection
        K-->>U: Restore stable state and announce reason
    end
```

Create, edit, move, reorder, configure, bulk, and undo/redo intents all use this dispatcher. A move
uses destination column/swimlane identity plus an opaque placement token. The component never writes
rank fields or guesses persistence semantics.

The implemented foundation currently exposes a namespaced extension request envelope, captured
board/source/query/entity revisions, four operation-correlated result variants, bounded publication
expectations, and pure reconciliation. Requests, contexts, results, and publication notices are
copied through descriptor-only exact-shape validation before application data is retained or used.
Capability descriptions control presentation only and are never treated as authorization.

## Query and pagination conventions

- A board-wide query session freezes one semantic query and revision.
- Each column/swimlane intersection exposes a sparse cursor independently.
- Cursors distinguish exact, lower-bound, unknown, loading, and failed count/edge states.
- Range requests are cancellable, deduplicated, concurrency-bounded, and safe when completed stale.
- Eager sources adapt to the same contract so small and large boards share one component path.

The main entry now exports the source/session/cursor contracts, validation helpers, eager source, count
snapshots, cell addresses, placements, and state unions. Deterministic eager/windowed fixtures,
deferred controls, revision controls, and black-box contract harnesses live only under
`@jsvision/kanban/testing`; production modules never import that testing graph.

Eager query adapters register an explicit search predicate, filter operators, and exact three-way
sort comparators. An optional reactive application revision invalidates a stable outer card array when
in-place fields used by those adapters change.
Summary adapters declare `authoritative` or `loaded-only` scope and use the package-owned `sum`,
`min`, `max`, or `average` aggregation vocabulary. Empty numeric summaries remain unknown rather than
being silently reported as zero.

## Workflow and grouping conventions

- `snapshotKanbanStructurePolicy()` validates complete immutable column and optional grouping
  policy without retaining hostile caller shapes.
- Pure WIP, definition-of-done, and transition evaluators return localized reason keys and never
  dispatch, persist, or authorize an operation.
- `resolveKanbanGrouping()` accepts either registered derived grouping or explicit source
  memberships for the one field selected by the query. Visible and detached projections remain
  separate.
- Applications configure distinct unassigned and resolver-fallback groups. Resolver failures are
  contained locally and observed without card data.
- Swimlane presentation supports `hybrid`, `separator`, `band`, and `rail` variants plus bounded
  custom header-only chrome. Custom results are cached by complete semantic and geometry input under
  a fixed retention ceiling.
- `KanbanCollapsedHoverController` owns one temporary, cancellable, generation-safe expansion lease;
  it never changes the underlying collapsed policy.

## Card presentation conventions

- `KanbanCardAdapter<TCard>` reads stable identity and optional standard fields from an opaque
  application record without taking ownership of it.
- `KanbanCardRenderer<TCard>` returns a renderer-neutral descriptor constrained by an exact width and
  row budget.
- Descriptor validation snapshots caller data once, rejects accessors and non-plain shapes, enforces
  collection and UTF-8 limits, and verifies terminal-cell geometry before publication.
- Renderer failures degrade to a sanitized, deterministic title/status fallback instead of escaping
  application payloads through diagnostics.
- Semantic Kanban theme roles resolve through mapped Core roles, family fallbacks, and emergency
  styles while retaining non-color cues.
- The main entry exports the typed message inventory and isolated English fallback service. Authored
  non-English values remain internal until their generated locale wrappers and registry reviews close
  atomically.

## Error conventions

Errors are typed and bounded by category: invalid input, unavailable capability, stale revision,
policy rejection, source failure, cancellation, and internal degradation. User-facing text comes from
localized package messages; observations contain identifiers and categories rather than record data.

## Stability boundary

The package publishes ESM declarations and JavaScript with `sideEffects: false`. Public API changes
follow package semantic versioning. Locale keys, saved-view schemas, discriminants, defaults, and
testing utilities are supported SDK surfaces and require compatibility evidence.
