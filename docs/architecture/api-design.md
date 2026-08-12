# Kanban API design

> **Last Updated**: 2026-08-12
> **Status**: Phase C modern interaction API implemented; commands, editors, saved-view codecs, and consumer course planned

## API style

`@jsvision/kanban` is a browser-neutral, typed in-process SDK. Its main barrel exposes models,
adapters, presentation, scene, interaction, requests, operations, the board, and viewport. Locale catalogs use explicit
locale subpaths, and deterministic fixtures use a `/testing` subpath. Commands and package-owned
dialogs remain deferred; the design deliberately avoids separate `/model` or `/dialogs` subpaths.

## Public topology

| Surface                        | Purpose                                                | Authority                                       |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------- |
| `KanbanBoard<TCard>`           | DSL-composed board component                           | Component session state                         |
| `KanbanDataSource<TCard>`      | Open a coherent query session                          | Application/data adapter                        |
| Query session and cell cursor  | Bounded lazy acquisition and edge/count knowledge      | Data adapter                                    |
| Card adapter/descriptors       | Map arbitrary records to safe visual content           | Application/package adapter                     |
| Structure/grouping policy      | Normalize columns and one optional swimlane axis       | Application policy; component projection        |
| Workflow evaluators            | Report WIP, DoD, and transition eligibility            | Pure presentation logic; never authorization    |
| Swimlane presentation          | Resolve bounded built-in or custom header chrome       | Component with validated application extension  |
| Scene and hit-map contracts    | Project final clipped geometry and semantic targets    | Viewport; application extensions remain bounded |
| `KanbanInteractionFacade`      | Programmatic focus, selection, activation, context     | Stable board session surface                    |
| Interaction controller factory | Replace the mount-owned semantic state controller      | Ownership transfers to one board                |
| Interaction intents            | Notify open-card, context, and scoped application UI   | Identity-only; never mutation authority         |
| `KanbanRequest` dispatcher     | Carry every requested mutation atomically              | Application                                     |
| Operation coordinator          | Validate, reserve, dispatch, reconcile, cancel, undo   | Board session; source remains authoritative     |
| Drag controllers/drop map      | Card and structural pointer movement                   | Viewport-local semantic geometry                |
| `/testing`                     | Fake clock, host trace, dispatcher/lifecycle harnesses | Development-only public SDK surface             |
| Commands, dialogs, saved views | Planned application-facing layers                      | Deferred; not exported in Phase C               |

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

Data-operation requests use this dispatcher. Card moves, selected-card moves, column/swimlane reorder,
programmatic move, and undo proposals already preserve that boundary; future create/edit/configuration
dialogs and commands must reuse it. A move uses destination column/swimlane identity plus a semantic
placement snapshot or bounded opaque edge token. The component never writes rank fields or guesses
persistence semantics.

The implementation exposes exact standard proposal and coordinator-owned envelope unions plus the
compatible namespaced extension envelope, captured board/source/query/entity revisions, four
operation-correlated result variants, bounded publication expectations, cancellation, fresh-proposal
undo, and pure reconciliation. Requests, contexts, results, and publication notices are
copied through descriptor-only exact-shape validation before application data is retained or used.
Capability descriptions control presentation only and are never treated as authorization.

## Interaction protocol

```mermaid
sequenceDiagram
    participant I as Mounted or programmatic input
    participant F as KanbanInteractionFacade
    participant C as KanbanInteractionController
    participant H as Application interaction handler

    I->>F: Closed transition
    F->>C: Serialized transition
    C-->>F: Valid immutable snapshot/result
    opt Activation, context, or scoped action
        F->>H: Identity-only semantic intent
    end
    F-->>I: Handled or bounded unavailable outcome
```

`KanbanBoard.interaction()` returns the same stable facade throughout construction, mount, and
disposal. `accept()` provides synchronous event-loop admission; `transition()` provides serialized
settlement; `activate()`, `openContext()`, and `invokeScopedAction()` deliver semantic application
intents after required selection/focus work. The default controller comes from
`createKanbanInteractionController`; an injected factory transfers one controller exclusively to the
mounted board.

A standalone `KanbanViewport` may subscribe to `board.interaction()` as a read-only projection mirror.
That adapter transfers neither controller ownership nor keyboard/pointer input authority; only the
owning `KanbanBoard` attaches the facade's synchronous input seam during its mount transaction.

Keyboard and pointer routing operate on final semantic scene targets. The routers are public only
from `@jsvision/kanban/testing`; production hosts use the mounted board path. Unknown gestures remain
unhandled. Click completion requires matching target/revision evidence. Threshold-crossing movement
acquires a generation-bound lease and routes through the density-aware drop map, one-cell hysteresis,
bounded prefetch/hover, and two-axis autoscroll before one valid release hands a semantic proposal to
the coordinator.

### Shared UI capture prerequisite

`@jsvision/ui` now exposes `EventLoop.acquireCapture(view, onLost)` and the matching
`DispatchEvent.acquireCapture` seam. A successful acquisition returns a generation-bound lease. Its
`active()` query reports whether that exact generation still owns capture, and `release()` ends only
that generation. Replacement and every lifecycle-loss path synchronously detach the lease before
invoking its callback, so callback code cannot accidentally act through stale capture state.

Loss reasons distinguish replacement, explicit release, modal transitions, host lifecycle loss,
unmount, stop, and disposal. An unmount boundary remains active until the removed subtree's reactive
owner is disposed, preventing a cleanup callback from reacquiring capture for a dying view. Stale
leases retain only their detached state cell rather than the event loop or captured view.

The legacy `setCapture()`, `hasCapture()`, and `releaseCapture()` methods remain supported for
existing controls. New cleanup-sensitive gestures should use the lease API and confirm that the
returned lease is still active before starting gesture-owned resources. Kanban card and structural
drag controllers use this lifecycle; see
[ADR-014](/decisions/ADR-014-generation-bound-pointer-capture).

## Operation and drag conventions

- Standard caller proposals are detached and validated before the coordinator allocates the final
  operation ID and dispatch envelope.
- Affected card, column, and swimlane subjects serialize conflicting operations while unrelated
  subjects may proceed concurrently within configured bounds.
- Pending visuals are projection-only. Accepted dispatch does not mutate records and becomes committed
  only through exact authoritative publication evidence.
- Card and structure drags keep capture, timers, prefetch, hover, and overlays under one generation;
  every cancellation path is idempotent and late continuations are inert.
- Keyboard `Ctrl+Shift+Left/Right` and `board.moveFocusedCard()` use the same move authority without
  synthesizing pointer-only ghost geometry.

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
- The main entry exports the typed foundation, Phase B, and Phase C inventories plus isolated English
  fallback services. Each explicit locale subpath preserves its foundation symbol and adds reviewed
  `kanbanPhaseB*` and `kanbanPhaseC*` overlays; the locale helper composes them in deterministic order.

## Error conventions

Errors and results are typed and bounded by category: invalid input, unavailable capability, stale
revision, policy rejection, source failure, cancellation, and internal degradation. Interaction
setup/settlement failures become unavailable results over the last valid snapshot. User-facing text
comes from localized package messages; observations contain identifiers and categories rather than
record data.

## Stability boundary

The package publishes ESM declarations and JavaScript with `sideEffects: false`. Public API changes
follow package semantic versioning. Locale keys, saved-view schemas, discriminants, defaults, and
testing utilities are supported SDK surfaces and require compatibility evidence.
