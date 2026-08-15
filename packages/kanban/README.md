# @jsvision/kanban

Responsive, data-source-driven Kanban board infrastructure for terminal applications built with
JSVision.

The package provides a generic board and standalone viewport, eager and sparse data sources, workflow
columns and swimlanes, bounded configurable cards, keyboard and pointer interaction, semantic themes,
localization, and application-owned request coordination. Application records remain
application-owned: adapt an existing domain model instead of copying it into a Kanban-specific store.

## Install

```sh
yarn add @jsvision/ui @jsvision/kanban zod
```

The package requires Node.js 22 or later and uses ESM. Zod 4 is a peer dependency used by the
optional standard card editor. Generic editor schema types remain Zod-free, so libraries can
describe application-specific editors without importing Zod types.

## Quick start

```ts
import { signal } from '@jsvision/ui';
import {
  KanbanBoard,
  createEagerKanbanDataSource,
  type KanbanCardAdapter,
  type KanbanColumnMeta,
  type KanbanQuery,
} from '@jsvision/kanban';
import { UNRECLAIMABLE_CHORDS } from '@jsvision/web';

interface WorkItem {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly status: string;
}

const cards = signal<readonly WorkItem[]>([
  { id: 101, columnId: 'todo', title: 'Document the release', status: 'To do' },
  { id: 102, columnId: 'doing', title: 'Verify the package', status: 'In progress' },
]);

const columns = signal<readonly KanbanColumnMeta[]>([
  { columnId: 'todo', label: 'To do', revision: 1 },
  { columnId: 'doing', label: 'In progress', revision: 1 },
  { columnId: 'done', label: 'Done', revision: 1 },
]);

const query = signal<KanbanQuery>({ filters: [], sort: [] });
const card: KanbanCardAdapter<WorkItem> = {
  keyOf: (item) => item.id,
  titleOf: (item) => item.title,
  statusOf: (item) => item.status,
};

const source = createEagerKanbanDataSource(cards, {
  columns,
  keyOf: card.keyOf,
  columnOf: (item) => item.columnId,
});

const board = new KanbanBoard({ source, query, card });
board.setLayout({ position: 'fill' });
```

Add `board` to an application content surface, a DSL-composed group, or a window. The same board
projection and scroll behavior is used in every host. Changes published through `cards`, `columns`, or
`query` are observed reactively after the board is mounted.

## Data ownership

`@jsvision/kanban` does not own or rewrite application records. A `KanbanCardAdapter<TCard>` provides
the mandatory stable key, title, and status used by the basic renderer. `StandardCard` is an optional
convenience type for common fields; it is not a required base class or runtime schema.

Use `createEagerKanbanDataSource` when the complete working set can reside in memory. Implement
`KanbanDataSource<TCard>` for windowed or remote data. Sparse sources publish honest exact,
lower-bound, or unknown extents and load only bounded visible and overscan ranges.

## Cards and presentation

The standard renderer always preserves a readable title and status. A presentation policy chooses
one of the built-in `compact`, `comfortable`, or `spacious` presets and may enable bounded metadata,
badges, feedback, definition-of-done text, and checklist summaries. Optional sections degrade in a
deterministic order when the assigned cells are too small. Long and untrusted display text is
sanitized, clipped, and ellipsized at the package boundary.

Use `resolveKanbanPresentation` to normalize a policy and `renderStandardKanbanCard` when the standard
descriptor is sufficient. Implement `KanbanCardRenderer<TCard>` for a custom visual structure. A
renderer returns immutable text rows, semantic roles, and bounded action regions; it does not receive
a terminal host or permission to mutate application records.

Status-based visual rules belong in the card adapter or renderer inputs. Semantic roles are resolved
reactively through the active Kanban theme, so a status, feedback, selection, or focus change can
update presentation without rebuilding the application record.

## Workflow columns and swimlanes

Workflow structure is application data. Columns have stable identities and source order, with
optional transition, WIP, and definition-of-done policies. WIP evaluation reports allow, warn, or
block outcomes without silently changing card placement. Transition resolution likewise returns a
proposal for application authorization.

Header labels default to start alignment. Set `headerAlignment: 'center'` on an individual column
policy when its lane name should be centered; the setting participates in the reactive structure
revision and does not change card alignment.

```ts
const structure = () => ({
  revision: 'centered-ready-v1',
  columns: [{ columnId: 'ready', headerAlignment: 'center' as const }, { columnId: 'doing' }],
});

const board = new KanbanBoard({ source, query, card, structure });
```

One optional horizontal swimlane grouping level can partition cards by team, project, epic, sprint,
or another registered field. Swimlanes support application-owned ordering, visibility, collapse,
summary, separator, background-role, and rail presentation. Nested grouping is deliberately absent:
one horizontal level remains legible and navigable in constrained terminals.

## Responsive layout and scrolling

The board uses JSVision layout composition and responds to its assigned terminal-cell rectangle:

- wide hosts show ordered workflow columns side by side;
- narrower hosts reduce column widths before switching to one focused column;
- geometry below the usable minimum shows localized guidance instead of clipping controls; and
- wheel and imperative scrolling operate in both axes while stable card and column identities
  preserve the visible anchor through resize and source reordering.

The usable board minimum is 18 × 5 cells, or 18 × 6 when the focused-column navigator is present.
Cards have a non-color focus cue and remain clipped to their assigned cells, including wide Unicode
glyphs.

The scene model retains only bounded visible and overscan geometry. Variable-height cards and sparse
data do not require materializing the complete board, and resize/reorder reconciliation uses semantic
card and column anchors rather than stale screen coordinates.

## Interaction and intents

`KanbanBoard` mounts a default interaction controller created by
`createKanbanInteractionController`. The stable `board.interaction()` facade is available before and
after mount for snapshots, navigation, selection, activation, context, and scoped actions. An
application may inject one `KanbanInteractionControllerFactory`; ownership of the returned controller
transfers to that mounted board.

Mounted input follows familiar board conventions while leaving unknown and Alt-modified gestures to
the containing application:

| Input                                | Behavior                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Arrow, Home, End, Page Up, Page Down | Move semantic focus; windowed navigation may acquire bounded source data                |
| Shift + navigation                   | Extend the selection range within the eligible semantic cell                            |
| Space                                | Toggle the focused card in the loaded selection                                         |
| Ctrl+A                               | Select loaded, visible, matching cards up to the configured bound                       |
| Enter or primary-button double-click | Emit an open-card intent for the focused card                                           |
| Primary click                        | Focus and select; Ctrl+click toggles the target card                                    |
| Primary drag                         | Move one card or the selected loaded block through a semantic resting-gutter target     |
| Right-click on a card                | Focus the card and emit an application-owned context intent                             |
| Escape                               | Cancel pending navigation, then clear progressively broader transient interaction state |
| Mouse wheel                          | Scroll the mounted viewport on the available axis                                       |

The pointer router commits a click only when button, semantic target, and scene revision still match
on release. Crossing the configured movement threshold instead acquires a generation-bound pointer
capture lease and starts a card or structural drag. The overlay keeps the source placeholder, bounded
ghost, warning/blocked state, insertion marker, and pending projection distinct. Drop placement is a
revision-bound semantic interval (`start`, `end`, `between`, or a source-issued window-edge token),
never a visual row index. Edge zones autoscroll in bounded steps and recompute the target after every
successful step.

Pass `onInteraction` to receive immutable `open-card`, `open-context`, and `scoped-action` intents.
They contain stable identities, closed semantic scopes, origin, and a bounded selection snapshot—not
application record payloads. The component never treats an intent as authorization to mutate data:
open editors, menus, lane configuration, or other application UI in the handler and publish accepted
changes through the source.

```ts
import type { KanbanInteractionIntent } from '@jsvision/kanban';

const observedIntents: KanbanInteractionIntent[] = [];
const board = new KanbanBoard({
  source,
  query,
  card,
  onInteraction: (intent) => observedIntents.push(intent),
});

await board.interaction().transition({ kind: 'navigate', direction: 'down' });
```

## Actions, keymaps, and read-only presentation

The action layer publishes stable IDs for navigation, selection, cards, structure, views, help, and
history. A bounded registry combines the package inventory with optional namespaced application
actions. Every keyboard, pointer, menu, context-menu, status, and programmatic invocation can then use
the same router, capability snapshot, and handler seam.

```ts
import {
  createKanbanActionInputAdapter,
  createKanbanActionKeymap,
  createKanbanActionRegistry,
  createKanbanActionRouter,
} from '@jsvision/kanban';

const registry = createKanbanActionRegistry({
  executePackageAction: (invocation) => executeBoardAction(invocation),
});
const keymap = createKanbanActionKeymap({
  registry,
  host: {
    kind: 'browser',
    platform: 'darwin',
    unavailableChords: UNRECLAIMABLE_CHORDS,
  },
  initial: {
    unbind: [{ chord: 'alt+m', actionId: 'kanban.card.grab' }],
    bindings: [{ chord: 'primary+m', actionId: 'kanban.card.grab' }],
  },
});
const router = createKanbanActionRouter({ registry });
const input = createKanbanActionInputAdapter({
  keymap,
  router,
  context: () => ({
    boardId: 'product-board',
    selection: { count: board.interaction().snapshot().selectedCardKeys.length },
    source: { state: 'ready', queryRevision: 'query-r4' },
    view: {},
  }),
});
```

`Primary` resolves to Command on a macOS browser that preserves Meta input and to Ctrl on native
terminals and other hosts. Pass the browser host's known unavailable chords so construction and runtime
replacement reject routes that cannot reach the application. Use `initial` to remap an unavailable
package default atomically during construction. Later runtime replacement follows the same contract: an
exact conflict requires an override naming both the chord and the currently bound action. To move a
route, use `unbind` with its exact current chord and action in the same request as the new binding.
Visible help reads only the successfully published snapshot. Destructive and board-configuration
actions are public but unbound by default.

Use `createKanbanReadOnlyCapabilityProvider()` for discoverable read-only presentation. It hides
mutation pointer hit targets and disables mutation keyboard/menu routes while retaining navigation,
selection, search, viewing, and help. This is a UX policy, not authorization: raw application requests
still reach the application's normal authority boundary.

## Events and application-owned history

`createKanbanEventHub()` publishes bounded board-scoped action, request, focus, selection, view, and
source events with dequeue-ordered sequence numbers. Nested publication is breadth-first; subscriber
and diagnostic failures are isolated. Event snapshots contain IDs, revisions, states, codes, and
counts only—never records, drafts, query values, placement tokens, undo tokens, or raw exceptions.

Pass the same hub to a board, action router, or authority adapter. Disposal clears queued and retained
events and prevents late asynchronous work from publishing. The optional retained snapshot is bounded
and disabled by default.

`createKanbanHistoryBinding()` observes application-owned undo/redo availability and asks the
application to build a fresh proposal for every invocation. The proposal enters normal board authority
with current revisions and a new operation ID. The package does not store history stacks or card
snapshots, and rejection never changes authoritative data.

## Hosting and lifecycle

`KanbanBoard` owns exactly one `KanbanViewport`. It does not create a window, dialog, shadow, or
application shell; the application chooses the host. A standalone `KanbanViewport` is available when
the board shell and its focused-column navigator are not wanted.

A mounted board owns one source/session/cursor lifecycle. Unmounting or calling `dispose()` releases
those resources in cancellation-first order. A disposed instance cannot be remounted; create a new
board for a new terminal lifecycle.

## Card editor core

Use `createKanbanCardEditorSchema` with a typed `KanbanCardEditorAdapter` when application records do
not match `StandardCard`. One disposable `createKanbanEditorSession` owns a detached draft, abortable
field validation, focus/error state, stale detection, and application-authorized submission. Subscribe
to its aggregate immutable snapshot so dialog rendering never observes torn submission state.

`createStandardKanbanEditorAdapter` provides configured mainstream fields and stable-ID checklist
groups/items. Its `createForm()` method returns a disposable `@jsvision/forms` store backed by a
consumer-supplied or generated Zod 4 object schema. Only selected fields enter the form and full-draft
proposal; optional application fields still use the same generic schema/session protocol.

```ts
import { createStandardKanbanEditorAdapter } from '@jsvision/kanban';
import { z } from 'zod';

const editor = createStandardKanbanEditorAdapter({
  fields: ['title', 'status', 'checklists'],
  schema: z.object({
    title: z.string().min(1),
    status: z.string().min(1),
    checklists: z.array(z.unknown()),
  }),
});
```

The component never writes the source record. An adapter returns a normal `card-update` proposal with
exact full-draft evidence; application authority returns the operation result, and the session commits
only after the resolver publishes the expected card revision. Dirty external changes become stale and
require explicit reload, cancel, or an application-owned merge policy.

## Localization

English is the safe fallback. Ten side-effect-free locale entry points are published so applications
can import only the catalogs they use:

```ts
import { createI18n } from '@jsvision/i18n';
import { kanbanNl, kanbanPhaseBNl, kanbanPhaseCNl } from '@jsvision/kanban/locales/nl';

const i18n = createI18n({ locale: 'nl', catalogs: [kanbanNl, kanbanPhaseBNl, kanbanPhaseCNl] });
const board = new KanbanBoard({ source, query, card, i18n: () => i18n });
```

Available locale tags are `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv`. Each
subpath exports the stable foundation catalog plus additive `kanbanPhaseB*` and `kanbanPhaseC*`
overlays. Passing all three preserves the original exact catalog contract while enabling the complete
core-board and modern-interaction vocabulary.
Applications may replace the `I18n` service reactively.

## Themes and terminal capabilities

Kanban presentation uses package-local semantic roles resolved from the active JSVision theme.
`createKanbanTheme` produces a complete immutable palette, and `resolveKanbanTheme` applies bounded
overrides with contrast and terminal-capability fallback. Color is never the only state cue;
monochrome and no-color terminals retain markers, borders, attributes, or text prefixes.

## Application requests

The board can publish typed data-operation requests through an optional application-owned dispatcher.
Every pointer, keyboard, programmatic, editor, menu, or structural producer enters the same
coordinator. The coordinator validates semantic placement, reserves affected identities, publishes
`proposed` then `pending`, optionally asks the application to confirm a warning/destructive proposal,
and invokes the dispatcher exactly once. Accepted work remains a pending visual projection until an
operation-correlated authoritative publication commits or supersedes it.

The board does not optimistically mutate cards, columns, or swimlanes. The application authorizes a
request, updates its own source, and calls `reconcilePublication` with exact correlation evidence.
Rejection, cancellation, capture loss, stale geometry, and contradictory/deleted publication release
the reservation without rewriting records. These requests complement non-mutation interaction intents:
intents describe which application UI the user requested, while dispatch requests coordinate a typed
data operation.

## Testing

Deterministic source fixtures and instrumentation are isolated from production imports:

```ts
import {
  createKanbanDeferred,
  createKanbanDispatcherHarness,
  createKanbanFakeClock,
  createKanbanStandardPointerTrace,
  createWindowedKanbanFixture,
  replayKanbanSemanticPointerTrace,
} from '@jsvision/kanban/testing';
```

The testing entry point also provides bounded operation lifecycle recording and real direct,
headless-xterm, PTY, or ConPTY semantic trace replay. Direct replay has no optional dependency.
Browser replay requires the consumer test project to install compatible development copies of
`@jsvision/web` and `@xterm/headless`; native replay likewise requires a development copy of
`node-pty` and a platform/toolchain supported by that package. Missing adapters fail with a bounded,
named prerequisite error instead of silently falling back to synthetic or pipe-backed evidence.
These host packages remain dev-only and are absent from the production entry point and runtime
dependency graph. The package verifies its public entries through a real packed, offline NodeNext
consumer; private source paths are not exported.

## Standalone kitchen sink

The permanent Kanban showcase starts with the shipped core-board capabilities and grows alongside
the package. From a repository checkout, run it in a real terminal:

```sh
yarn workspace @jsvision/examples demo:kanban
```

The stories cover rich status-driven cards, bounded metadata and checklist previews, dense
Dutch and German card content, horizontal team swimlanes, responsive density, scrolling, keyboard
selection and activation, mouse targeting, and a modern interaction lab. That lab uses genuine mounted
pointer input and visible keyboard/mouse controls to show warning confirmation, blocked and unavailable
drops, pending/rejected state, authoritative publication, atomic selected-card movement, edge
autoscroll, responsive resize, and teardown. The
localized density story deliberately combines
long titles, several labels, multiple summaries, and more checklist items than fit, making wrapping,
ellipsis, omitted-item evidence, degradation, and vertical scrolling visible. Each story uses the
public package entry point and is mounted inside a disposable reactive owner, so future drag, editor,
configuration, filtering, and persistence stories can be added without replacing the shell or
leaking prior story state.

## Current boundary

The board includes configurable card presentation, workflow/swimlane structure, sparse scene
geometry, focus and bounded selection, mounted keyboard/click/drag interaction, semantic move and
structural placement, a single application-authority coordinator, operation lifecycle projections,
publication reconciliation, and application-owned semantic intents. Workflow lanes use a compact three-row sticky header: a joined top
border, a horizontally padded and optionally centered label, and a joined lower separator. Continuous
vertical boundaries use terminal-safe junction glyphs. Cards use the same one-cell horizontal padding,
a single resting frame, and a double focused frame, with an ASCII-safe distinction when box drawing is
unavailable. A focused card casts a contained drop shadow into the lane gutter and resting gap without
changing its action target, and its title becomes bold without replacing semantic status styling. All
named presentation presets reserve one blank row between adjacent cards so shadows and insertion
targets remain legible; a bounded custom presentation policy may explicitly choose zero gap. Card text
keeps its semantic foreground and attributes over the card's resolved surface background, so
status-driven surfaces remain visually coherent. Standard-card rows reserve the marker gutter on the
left and one matching blank cell before the right frame; ellipsis never occupies that trailing padding.
Checklist content is a bounded card presentation; checklist-item editing remains application-owned.

Package-owned card/lane editor dialogs and the headless command/keymap layer are available. Direct
board ownership of those productivity binders, complete action-message locale overlays, and the full
docs-site component course remain integration work. Application persistence and authorization
intentionally remain outside the package. Nested grouping remains excluded because it does not preserve
a legible TUI interaction model.

## License

MIT
