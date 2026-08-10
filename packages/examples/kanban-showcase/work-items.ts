import { signal } from '@jsvision/ui';
import { KanbanBoard, createEagerKanbanDataSource, createStandardKanbanCardAdapter } from '@jsvision/kanban';
import type {
  KanbanCardDensity,
  KanbanColumnHeaderAlignment,
  KanbanInteractionIntent,
  KanbanPresentationInput,
  KanbanQuery,
  KanbanStructurePolicy,
  KanbanSwimlanePresentationInput,
  StandardCard,
} from '@jsvision/kanban';

/** Application-specific data retained by the generic convenience card model. */
export interface ShowcaseCardData {
  /** Team used by the swimlane demonstration. */
  readonly team?: string;
}

/** Card shape owned by the showcase application rather than by the Kanban package. */
export type ShowcaseCard = StandardCard<string, ShowcaseCardData>;

/** Options used to build one real board fixture for a showcase story. */
export interface ShowcaseBoardOptions {
  /** Application-owned immutable card fixture. */
  readonly cards: readonly ShowcaseCard[];
  /** Optional card density for preset presentation. */
  readonly density?: KanbanCardDensity;
  /** Optional rich card budget used instead of a preset-only presentation. */
  readonly presentation?: KanbanPresentationInput;
  /** Optional horizontal grouping chrome. */
  readonly swimlanes?: KanbanSwimlanePresentationInput;
  /** Optional shared lane-header alignment used to demonstrate structure presentation. */
  readonly headerAlignment?: KanbanColumnHeaderAlignment;
  /** Text displayed before an interaction intent is emitted. */
  readonly initialActivity: string;
}

/** Shared ordered workflow columns used by every initial story. */
export const SHOWCASE_COLUMNS = Object.freeze([
  Object.freeze({ columnId: 'backlog', label: 'Backlog', revision: 1 }),
  Object.freeze({ columnId: 'active', label: 'In progress', revision: 1 }),
  Object.freeze({ columnId: 'done', label: 'Done', revision: 1 }),
]);

/** Shared horizontal teams used by grouped stories. */
export const SHOWCASE_TEAMS = Object.freeze([
  Object.freeze({ swimlaneId: 'platform', label: 'Platform team', revision: 1 }),
  Object.freeze({ swimlaneId: 'experience', label: 'Experience team', revision: 1 }),
  Object.freeze({ swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 }),
]);

/** Rich card budget that preserves an empty terminal row as a clear pointer target between cards. */
export const RICH_PRESENTATION: KanbanPresentationInput = Object.freeze({
  revision: 'showcase-rich-v1',
  cardRows: 9,
  cardGap: 1,
  metadataFields: 3,
  labelRows: 1,
  summarySections: 1,
  checklistMode: 'preview',
  checklistPreviewItems: 2,
});

/** Adapter demonstrating configurable metadata, checklists, summaries, and status-driven roles. */
export const SHOWCASE_CARD_ADAPTER = createStandardKanbanCardAdapter<string, ShowcaseCardData>({
  fields: {
    priority: { label: 'Priority', priority: 1 },
    estimate: { label: 'Estimate', priority: 2 },
    labels: { label: 'Labels', priority: 3 },
  },
  summaries: [
    { fieldId: 'progress', label: 'Tasks', priority: 1 },
    { fieldId: 'risks', label: 'Risks', priority: 2 },
  ],
  styleOf: (card, state) => {
    if (state.focused && state.selected) {
      return { revision: 'focused-selected', surfaceRole: 'card.focused-selected', markerRole: 'card.selected' };
    }
    if (state.focused) return { revision: 'focused', surfaceRole: 'card.focused', markerRole: 'card.focused' };
    if (state.selected) return { revision: 'selected', surfaceRole: 'card.selected', markerRole: 'card.selected' };
    if (card.status === 'Blocked') {
      return { revision: 'blocked', surfaceRole: 'wip.error', borderRole: 'wip.error', markerRole: 'wip.error' };
    }
    if (card.status === 'In progress') {
      return { revision: 'active', surfaceRole: 'wip.warning', borderRole: 'wip.warning', markerRole: 'wip.warning' };
    }
    if (card.status === 'Done') {
      return { revision: 'done', surfaceRole: 'card.read-only', borderRole: 'card.read-only' };
    }
    return { revision: 'ready', surfaceRole: 'card.normal', borderRole: 'card.normal' };
  },
});

const BASE_QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });

/** Converts one semantic interaction into bounded, non-payload showcase feedback. */
function describeIntent(intent: KanbanInteractionIntent): string {
  if (intent.kind === 'open-card') return `open-card · ${intent.origin} · card ${String(intent.cardKey)}`;
  if (intent.kind === 'open-context') return `open-context · ${intent.origin} · ${intent.scope.kind}`;
  return `${intent.actionId} · ${intent.origin} · ${intent.scope.kind}`;
}

/** Builds one public-API board and the reactive activity text shown beneath it. */
export function createShowcaseBoard(options: ShowcaseBoardOptions): {
  readonly board: KanbanBoard<ShowcaseCard>;
  readonly activity: () => string;
} {
  const activity = signal(options.initialActivity);
  const grouped = options.swimlanes !== undefined;
  const source = createEagerKanbanDataSource(() => options.cards, {
    columns: () => SHOWCASE_COLUMNS,
    ...(grouped
      ? {
          swimlanes: () => SHOWCASE_TEAMS,
          groupingFields: [
            {
              id: 'team',
              swimlaneOf: (card: ShowcaseCard) => card.custom?.team,
              unassignedSwimlaneId: 'unassigned',
            },
          ],
        }
      : {}),
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
    search: (card, term) => card.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
  });
  const structure: KanbanStructurePolicy<ShowcaseCard> = {
    revision: `${grouped ? `grouped-${String(options.swimlanes)}` : 'columns'}-${options.headerAlignment ?? 'start'}`,
    columns: [
      {
        columnId: 'backlog',
        ...(options.headerAlignment === undefined ? {} : { headerAlignment: options.headerAlignment }),
        wip: { maximum: 5, mode: 'advisory', countDone: 'exclude' },
      },
      {
        columnId: 'active',
        ...(options.headerAlignment === undefined ? {} : { headerAlignment: options.headerAlignment }),
        wip: { maximum: 3, mode: 'advisory', countDone: 'exclude' },
      },
      {
        columnId: 'done',
        ...(options.headerAlignment === undefined ? {} : { headerAlignment: options.headerAlignment }),
      },
    ],
    ...(grouped
      ? {
          grouping: {
            fieldId: 'team',
            unassigned: { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
            presentation: options.swimlanes,
            railWidth: 14,
          },
        }
      : {}),
  };
  const board = new KanbanBoard({
    source,
    query: () => (grouped ? { ...BASE_QUERY, groupBy: 'team' } : BASE_QUERY),
    card: SHOWCASE_CARD_ADAPTER,
    structure: () => structure,
    ...(options.density === undefined ? {} : { density: () => options.density! }),
    ...(options.presentation === undefined ? {} : { presentation: () => options.presentation! }),
    onInteraction: (intent) => activity.set(describeIntent(intent)),
  });
  return { board, activity };
}
