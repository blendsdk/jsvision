# Kanban architecture

> **Last Updated**: 2026-08-11
> **Status**: Phase B core board and shared capture prerequisite implemented; Kanban drag/drop, editors, commands, and product documentation planned

## Boundary and ownership

`@jsvision/kanban` is a specialist JSVision package for presenting application-owned work records.
It owns bounded query, projection, scene geometry, layout, viewport, localization, and transient
interaction state. It does not own durable records, persistence, authorization, workflow policy,
saved-view storage, or window management.

Applications provide a `KanbanDataSource<TCard>` and `KanbanCardAdapter<TCard>`. They may also provide
a request dispatcher, semantic interaction handler, or replacement interaction-controller factory.
The optional `StandardCard` model is a convenience, not a required storage schema. A board may be
placed directly on an application surface or inside an application-owned window; both hosts use the
same projection, input, and lifecycle path.

## Package topology

```mermaid
graph LR
    App[Application records and policy] --> Kanban[@jsvision/kanban]
    Kanban --> Core[@jsvision/core]
    Kanban --> I18n[@jsvision/i18n]
    Kanban --> UI[@jsvision/ui]
    UI --> Core
    App --> Host[Surface or window host]
    Host --> Kanban
```

| Public entry point                  | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `@jsvision/kanban`                  | Production sources, presentation, scene, interaction, board, viewport |
| `@jsvision/kanban/testing`          | Deterministic source, scene, input, and contract fixtures             |
| `@jsvision/kanban/locales/{locale}` | Stable foundation catalog plus reviewed Phase B overlay per subpath   |

The package depends only on the public Core, I18n, and UI packages. Testing helpers are isolated from
the production module graph, and undeclared private subpaths are not part of the SDK surface.

## Read lifecycle

One mounted `KanbanBoard<TCard>` owns one `KanbanViewport<TCard>` and one read coordinator. The
coordinator opens a revisioned query session, then retains cell cursors only for visible, overscan,
or explicit prefetch owners. A cell is the intersection of a workflow column and the optional single
swimlane dimension.

```mermaid
sequenceDiagram
    participant B as Board and viewport
    participant S as Query session
    participant C as Cell cursor
    participant A as Application source

    B->>A: Open immutable query
    A-->>B: Revisioned session
    B->>S: Retain visible and overscan cells
    S-->>B: Sparse cursors
    B->>C: Request bounded ranges
    C-->>B: Cards plus count and edge knowledge
    B->>B: Project bounded descriptors and damage
    alt query replacement or disposal
        B->>B: Invalidate generation
        B->>C: Abort outstanding ranges
        B->>S: Release cursors and dispose session
    end
```

Loaded range boundaries are never treated as logical board edges. Counts and edges remain exact,
lower-bound, estimated, truncated, loading, failed, or unknown according to source evidence. Query
replacement invalidates the generation before cancellation, so late work cannot publish into a new
session. Disposal is idempotent and cannot remount the source lifecycle.

## Responsive board and bounded viewport

The board uses the public layout DSL for ordinary composition and owns one measured viewport leaf for
exact terminal-cell projection. This isolates clipping, sticky headers, scrolling, hit testing,
damage, and stable anchors without duplicating responsive layout across the entire component.

The width solver degrades monotonically through wide, compact, focused-column, and minimum modes.
The viewport supports horizontal and vertical scrolling, preserves stable card and column anchors
across resize and reorder, and renders only visible plus bounded overscan ranges. Descriptor caching
is bounded, keyed by complete presentation semantics, and evicts work that loses all visible or
overscan ownership. Invalid or throwing application projections degrade to sanitized, non-color-only
fallbacks rather than leaking record content.

The canonical scene contains clipped column/swimlane headers, variable-height cards, state surfaces,
and final semantic action targets. A sparse height index and immutable retained-row projection keep
vertical work bounded. Action regions are translated through card crop offsets before clipping, so
pointer targets agree with the final cells even when a descriptor is partially visible. Scene damage
is computed from semantic identity and geometry changes instead of repainting the complete board.

## Workflow structure and grouping

Phase B normalizes application-owned workflow policy before scene construction. Column visibility,
collapse, widths, WIP limits, definition-of-done text, capabilities, and semantic styles are copied
into immutable snapshots. WIP and transition evaluators are pure eligibility checks: their result
can explain what the component should present, but it never authorizes a mutation.

One query-selected grouping field may create one horizontal swimlane dimension. Derived resolvers
and explicit source memberships both produce stable semantic groups, while hidden membership stays
detached from the visible projection. Missing or unmapped values use an application-configured
unassigned group. Resolver failures use a separately configured local fallback and emit only
payload-free observations. Invalid structures retain the caller's previous complete result.

Built-in `hybrid`, `separator`, `band`, and `rail` chrome strategies share the same semantic
membership. Custom chrome is exact-shape validated, bounded, and prevented from creating card or
drop targets. Its resolver cache keys every output-affecting semantic and geometry input and has a
fixed FIFO bound. Collapsed-swimlane hover expansion is a temporary generation-owned lease: it does
not mutate saved collapse state, and scheduler failure, cancellation, leave, or disposal safely
restores the underlying projection.

## Request authority

The board's request dispatcher carries application-authorized data-operation requests and tracks
bounded publication expectations. Capability metadata may hide or disable controls, but only the
application authorizes and applies a request. The component never mutates an application record
optimistically and reconciles only from dispatcher results and authoritative source publication.

## Interaction and input lifecycle

Each `KanbanBoard` owns one stable `KanbanInteractionFacade`. On mount, the board creates or receives
one `KanbanInteractionController`, then transfers exclusive lifecycle ownership to the facade. The
controller owns immutable focus, bounded selection, range anchor, pending navigation, server-selection
reference, and feedback state. It receives bounded scene/source services rather than records, host
objects, or application handlers.

Standalone viewports can mirror the facade's immutable publications, but their non-owning adapter is
read-only. The owning board attaches synchronous keyboard/pointer authority through a separate
internal mount seam, so passing `board.interaction()` to another viewport cannot create a second input
owner.

```mermaid
sequenceDiagram
    participant H as Keyboard and pointer host
    participant V as Viewport input router
    participant F as KanbanInteractionFacade
    participant C as Interaction controller
    participant A as Application handler

    H->>V: Normalized key, click, context, or wheel report
    V->>F: Accept semantic transition
    F->>C: Serialize and validate transition
    C-->>F: Immutable snapshot or bounded unavailable result
    opt Activation, context, or scoped action
        F->>A: Immutable semantic intent and selection snapshot
    end
    F-->>V: Invalidate from published semantic state
```

Arrow/Home/End/Page navigation, Shift range extension, Space toggle, Ctrl+A loaded selection, Enter
activation, Escape cancellation, click/Ctrl-click/double-click/right-click, descriptor actions, retry,
and wheel scrolling share this mounted path. Unknown and Alt-modified keys propagate to the containing
application. Pointer release commits only when button, semantic target, and scene revision still match;
move or drag input cancels the pending click because drag/drop is not implemented in this phase.

The shared UI event loop now exposes a generation-bound pointer-capture lease with synchronous,
reasoned loss notification across replacement, modal, host, unmount, stop, and disposal boundaries.
That lifecycle is the prerequisite for Kanban's later mouse drag controller: it prevents a gesture
from surviving capture loss or retaining a dead view. It deliberately does not choose Kanban drag
thresholds, ghost geometry, insertion targets, or move semantics.

`open-card`, `open-context`, and `scoped-action` intents cross a synchronous application handler only
after required focus/selection work settles. They carry identities and closed scopes, never record
payloads or mutation authority. The stable facade also exposes the same operations programmatically.
Setup, transition, handler, and late-settlement failures retain the last valid detached snapshot and
degrade to bounded unavailable feedback.

Teardown first quiesces mounted input, then releases facade/controller subscriptions and cancellation,
viewport scene/session ownership, and finally board request authority. Disposal is idempotent, and a
released board cannot remount.

## Phase boundary

| Implemented Phase B core board                                           | Deliberately deferred                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Public contracts, validation, limits, and semantic defaults              | Drag ghosts, insertion targets, and card movement          |
| Eager and sparse revisioned read sources                                 | Command registry and user-remappable keymap                |
| Configurable rich cards with bounded checklist/summary sections          | Card and lane-configuration dialogs                        |
| Theme roles, English fallback, and ten locale entry points with overlays | Application authorization, persistence, and saved-view UI  |
| Responsive board/viewport, sparse scene, scrolling, and host parity      | Component teaching page, live labs, kitchen sink, showcase |
| Workflow structure, WIP/DoD eligibility, and one swimlane axis           | Nested grouping                                            |
| Focus, bounded selection, mounted keyboard and pointer clicks            | Pointer drag/drop                                          |
| Semantic interaction intents and request reconciliation                  | Package-owned record mutation                              |
| Shared generation-bound UI pointer-capture lifecycle                     | Kanban drag controller, ghost, and insertion/drop behavior |

This boundary is intentionally publishable and testable, but it is not presented as a complete
Kanban application. Later phases add drag/drop, commands, and package-owned input UI while retaining
the application authority, query lifecycle, bounded rendering, localization, and responsive-layout
decisions documented here.

## Related architecture

- [Kanban data model](/architecture/data-model)
- [Kanban API design](/architecture/api-design)
- [Kanban security architecture](/architecture/security)
- [Kanban architecture decisions](/decisions/)
