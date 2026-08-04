# @jsvision/kanban

Responsive, data-source-driven Kanban foundations for terminal applications built with JSVision.

The package provides a generic read-only board and standalone viewport, eager and sparse data-source
contracts, bounded card rendering, semantic themes, localization, and application-owned request
coordination. Application records remain application-owned: adapt an existing domain model instead of
copying it into a Kanban-specific store.

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

The board can publish typed requests through an optional application-owned dispatcher. It does not
optimistically mutate cards, columns, or swimlanes. The application authorizes a request, updates its
own data, and publishes the authoritative result through the source. Pending metadata is bounded and
cleared when that publication arrives.

## Testing

Deterministic source fixtures and instrumentation are isolated from production imports:

```ts
import { createKanbanDeferred, createWindowedKanbanFixture } from '@jsvision/kanban/testing';
```

The package verifies its public entry points through a real packed, offline NodeNext consumer. Private
source paths are deliberately not exported.

## Phase A boundary

This release is the publishable read-only foundation. Drag-and-drop, card/lane editing dialogs,
checklist presentation, workflow policy, command/keymap completion, the kitchen sink, and the polished
showcase are designed for later implementation phases. The semantic roles and `StandardCard` fields
reserved for those features do not imply that their interactions are active yet.

## License

MIT
