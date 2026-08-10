# @jsvision/kanban

Responsive, data-source-driven Kanban board infrastructure for terminal applications built with
JSVision.

The package provides a generic board and standalone viewport, eager and sparse data sources, workflow
columns and swimlanes, bounded configurable cards, keyboard and pointer interaction, semantic themes,
localization, and application-owned request coordination. Application records remain
application-owned: adapt an existing domain model instead of copying it into a Kanban-specific store.

## Install

```sh
yarn add @jsvision/ui @jsvision/kanban
```

The package requires Node.js 22 or later and uses ESM.

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
one of the built-in `compact`, `comfortable`, or `detailed` presets and may enable bounded metadata,
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

The usable board minimum is 18 × 4 cells, or 18 × 5 when the focused-column navigator is present.
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
| Right-click on a card                | Focus the card and emit an application-owned context intent                             |
| Escape                               | Cancel pending navigation, then clear progressively broader transient interaction state |
| Mouse wheel                          | Scroll the mounted viewport on the available axis                                       |

The pointer router commits a click only when button, semantic target, and scene revision still match
on release. Move and drag reports cancel an incomplete press, preventing stale geometry from invoking
an action.

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

## Hosting and lifecycle

`KanbanBoard` owns exactly one `KanbanViewport`. It does not create a window, dialog, shadow, or
application shell; the application chooses the host. A standalone `KanbanViewport` is available when
the board shell and its focused-column navigator are not wanted.

A mounted board owns one source/session/cursor lifecycle. Unmounting or calling `dispose()` releases
those resources in cancellation-first order. A disposed instance cannot be remounted; create a new
board for a new terminal lifecycle.

## Localization

English is the safe fallback. Ten side-effect-free locale entry points are published so applications
can import only the catalogs they use:

```ts
import { createI18n } from '@jsvision/i18n';
import { kanbanNl } from '@jsvision/kanban/locales/nl';

const i18n = createI18n({ locale: 'nl', catalogs: [kanbanNl] });
const board = new KanbanBoard({ source, query, card, i18n: () => i18n });
```

Available locale tags are `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv`.
Applications may replace the `I18n` service reactively.

## Themes and terminal capabilities

Kanban presentation uses package-local semantic roles resolved from the active JSVision theme.
`createKanbanTheme` produces a complete immutable palette, and `resolveKanbanTheme` applies bounded
overrides with contrast and terminal-capability fallback. Color is never the only state cue;
monochrome and no-color terminals retain markers, borders, attributes, or text prefixes.

## Application requests

The board can publish typed data-operation requests through an optional application-owned dispatcher.
It does not optimistically mutate cards, columns, or swimlanes. The application authorizes a request,
updates its own data, and publishes the authoritative result through the source. Pending metadata is
bounded and cleared when that publication arrives. These requests complement the non-mutation
interaction intents above: intents describe what UI action the user requested, while dispatch requests
coordinate an application-authorized data operation.

## Testing

Deterministic source fixtures and instrumentation are isolated from production imports:

```ts
import { createKanbanDeferred, createWindowedKanbanFixture } from '@jsvision/kanban/testing';
```

The package verifies its public entry points through a real packed, offline NodeNext consumer. Private
source paths are deliberately not exported.

## Current boundary

The core board now includes configurable card presentation, workflow/swimlane structure, sparse scene
geometry, focus and bounded selection, mounted keyboard and click-family pointer interaction, and
application-owned semantic intents. Checklist content is a bounded card presentation; checklist-item
editing remains application-owned.

Drag-and-drop with insertion targets and ghost feedback, packaged card/lane editor dialogs, the
command/keymap layer, full component documentation and live examples, the separate kitchen sink, and
the polished showcase remain later phases. Move/drag pointer reports currently cancel click tracking;
they do not start a card move. Applications should not infer later editing or drag behavior from the
present structural and intent APIs.

## License

MIT
