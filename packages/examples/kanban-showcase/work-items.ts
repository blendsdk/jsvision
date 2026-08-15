import { onCleanup, signal } from '@jsvision/ui';
import {
  KanbanBoard,
  createEagerKanbanDataSource,
  createKanbanBoardId,
  createStandardKanbanCardAdapter,
} from '@jsvision/kanban';
import type {
  KanbanBoardActionOptions,
  KanbanBoardEditorBinding,
  KanbanBoardViewOptions,
  KanbanCardDensity,
  KanbanColumnHeaderAlignment,
  KanbanEventHub,
  KanbanFilterField,
  KanbanInteractionIntent,
  KanbanPresentationInput,
  KanbanQuery,
  KanbanRequest,
  KanbanRequestResult,
  KanbanStructurePolicy,
  KanbanSortField,
  KanbanSwimlanePresentationInput,
  StandardCard,
} from '@jsvision/kanban';

/** Application-specific data retained by the generic convenience card model. */
export interface ShowcaseCardData {
  /** Team used by the swimlane demonstration. */
  readonly team?: string;
  /** Optional owner used by filtering and editing demonstrations. */
  readonly owner?: string;
}

/** Mutable application services exposed only while assembling one showcase board. */
export interface ShowcaseBoardServices {
  /** Reads the current immutable application-owned card publication. */
  readonly cards: () => readonly ShowcaseCard[];
  /** Replaces one card and publishes a new immutable application array. */
  readonly replaceCard: (card: ShowcaseCard) => boolean;
  /** Appends one newly created card when its identity is not already present. */
  readonly appendCard: (card: ShowcaseCard) => boolean;
  /** Observes application-owned card publications for editor stale-state demonstrations. */
  readonly subscribeCards: (listener: (cards: readonly ShowcaseCard[]) => void) => () => void;
  /** Publishes bounded visible feedback below the board. */
  readonly setActivity: (message: string) => void;
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
  /** Optional controller and package-owned view chrome. */
  readonly view?: KanbanBoardViewOptions;
  /** Optional board-scoped event stream. */
  readonly events?: KanbanEventHub;
  /** Optional action customization; a complete default action surface is always installed. */
  readonly actions?: KanbanBoardActionOptions;
  /** Optional registered eager-source filters used by productivity stories. */
  readonly filterFields?: readonly KanbanFilterField<ShowcaseCard>[];
  /** Optional registered eager-source sort fields used by productivity stories. */
  readonly sortFields?: readonly KanbanSortField<ShowcaseCard>[];
  /** Optional editor factory with access to application-owned records and feedback. */
  readonly editor?: (services: ShowcaseBoardServices) => KanbanBoardEditorBinding;
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
    const surfaceRole =
      card.status === 'Blocked'
        ? 'card.accent-3'
        : card.status === 'In progress'
          ? 'card.accent-2'
          : card.status === 'Done'
            ? 'card.accent-4'
            : 'card.accent-1';
    const interactionRole =
      state.focused && state.selected
        ? 'card.focused-selected'
        : state.focused
          ? 'card.focused'
          : state.selected
            ? 'card.selected'
            : surfaceRole;
    return {
      revision: `${card.status ?? 'ready'}-${interactionRole}`,
      surfaceRole,
      borderRole: interactionRole,
      markerRole: interactionRole,
    };
  },
});

const BASE_QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
let nextShowcaseBoardId = 1;

/** Compares card identities without coercing numbers and strings into the same application key. */
function sameCardKey(left: string | number, right: string | number): boolean {
  return typeof left === typeof right && left === right;
}

/** Returns whether one showcase card belongs to the request's exact semantic destination cell. */
function belongsToTarget(card: ShowcaseCard, request: Extract<KanbanRequest, { readonly kind: 'card-move' }>): boolean {
  if (card.columnId !== request.target.columnId) return false;
  if (request.target.swimlaneId === undefined) return true;
  const team = card.custom?.team ?? 'unassigned';
  return team === request.target.swimlaneId;
}

/** Finds the application array position represented by one stable-neighbor move placement. */
function insertionIndex(
  cards: readonly ShowcaseCard[],
  request: Extract<KanbanRequest, { readonly kind: 'card-move' }>,
): number {
  const firstTarget = cards.findIndex((card) => belongsToTarget(card, request));
  let lastTarget = -1;
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const candidate = cards[index];
    if (candidate === undefined || !belongsToTarget(candidate, request)) continue;
    lastTarget = index;
    break;
  }
  const position = request.position;
  if (position.kind === 'start') return firstTarget < 0 ? cards.length : firstTarget;
  if (position.kind === 'end') return lastTarget < 0 ? cards.length : lastTarget + 1;
  if (position.kind === 'between') {
    const afterCardKey = position.afterCardKey;
    const after = afterCardKey === null ? -1 : cards.findIndex((card) => sameCardKey(card.key, afterCardKey));
    if (after >= 0) return after;
    const beforeCardKey = position.beforeCardKey;
    const before = beforeCardKey === null ? -1 : cards.findIndex((card) => sameCardKey(card.key, beforeCardKey));
    return before >= 0 ? before + 1 : firstTarget < 0 ? cards.length : firstTarget;
  }
  const neighbor = cards.findIndex((card) => sameCardKey(card.key, position.neighborCardKey));
  if (neighbor >= 0) return position.edge === 'before' ? neighbor : neighbor + 1;
  return position.edge === 'before'
    ? firstTarget < 0
      ? cards.length
      : firstTarget
    : lastTarget < 0
      ? cards.length
      : lastTarget + 1;
}

/** Applies a validated card move to the showcase's application-owned immutable array. */
function applyCardMove(
  cards: readonly ShowcaseCard[],
  request: Extract<KanbanRequest, { readonly kind: 'card-move' }>,
  grouped: boolean,
): readonly ShowcaseCard[] {
  const movedKeys = request.moved.map(({ cardKey }) => cardKey);
  const moved = request.moved.flatMap(({ cardKey }) => {
    const card = cards.find((candidate) => sameCardKey(candidate.key, cardKey));
    if (card === undefined) return [];
    const team = request.target.swimlaneId === 'unassigned' ? undefined : request.target.swimlaneId;
    return [
      Object.freeze({
        ...card,
        columnId: request.target.columnId,
        ...(grouped
          ? {
              custom: Object.freeze({ ...card.custom, ...(team === undefined ? { team: undefined } : { team }) }),
            }
          : {}),
      }),
    ];
  });
  const remaining = cards.filter((card) => !movedKeys.some((cardKey) => sameCardKey(card.key, cardKey)));
  const index = insertionIndex(remaining, request);
  return Object.freeze([...remaining.slice(0, index), ...moved, ...remaining.slice(index)]);
}

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
  readonly setActivity: (message: string) => void;
  readonly cards: () => readonly ShowcaseCard[];
  readonly replaceCard: (card: ShowcaseCard) => boolean;
  readonly appendCard: (card: ShowcaseCard) => boolean;
  readonly subscribeCards: (listener: (cards: readonly ShowcaseCard[]) => void) => () => void;
} {
  const activity = signal(options.initialActivity);
  const grouped = options.swimlanes !== undefined;
  const cards = signal(Object.freeze([...options.cards]));
  const cardSubscribers = new Set<(cards: readonly ShowcaseCard[]) => void>();
  onCleanup(() => cardSubscribers.clear());
  const publishCards = (next: readonly ShowcaseCard[]): void => {
    cards.set(next);
    for (const subscriber of [...cardSubscribers]) subscriber(next);
  };
  const replaceCard = (replacement: ShowcaseCard): boolean => {
    const index = cards().findIndex((card) => sameCardKey(card.key, replacement.key));
    if (index < 0) return false;
    const next = [...cards()];
    next[index] = Object.freeze({ ...replacement });
    publishCards(Object.freeze(next));
    return true;
  };
  const appendCard = (candidate: ShowcaseCard): boolean => {
    if (cards().some((card) => sameCardKey(card.key, candidate.key))) return false;
    publishCards(Object.freeze([...cards(), Object.freeze({ ...candidate })]));
    return true;
  };
  const services: ShowcaseBoardServices = Object.freeze({
    cards,
    replaceCard,
    appendCard,
    subscribeCards: (listener: (cards: readonly ShowcaseCard[]) => void) => {
      cardSubscribers.add(listener);
      return () => cardSubscribers.delete(listener);
    },
    setActivity: (message: string) => activity.set(message),
  });
  const source = createEagerKanbanDataSource(cards, {
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
    ...(options.filterFields === undefined ? {} : { filterFields: options.filterFields }),
    ...(options.sortFields === undefined ? {} : { sortFields: options.sortFields }),
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
  /** Accepts supported showcase moves and publishes their application-owned source mutation. */
  const dispatcher = (request: KanbanRequest): KanbanRequestResult => {
    if (request.kind !== 'card-move') {
      return Object.freeze({ kind: 'rejected', operationId: request.operationId, code: 'showcase-unsupported' });
    }
    publishCards(applyCardMove(cards(), request, grouped));
    activity.set(
      `Moved ${request.moved.length} card${request.moved.length === 1 ? '' : 's'} to ${request.target.columnId}`,
    );
    return Object.freeze({ kind: 'accepted', operationId: request.operationId });
  };
  const board = new KanbanBoard({
    source,
    query: () => (grouped ? { ...BASE_QUERY, groupBy: 'team' } : BASE_QUERY),
    card: SHOWCASE_CARD_ADAPTER,
    structure: () => structure,
    dispatcher,
    actions:
      options.actions ??
      Object.freeze({
        boardId: createKanbanBoardId(`showcase-${String(nextShowcaseBoardId++)}`),
        host: Object.freeze({ kind: 'terminal' as const, platform: 'linux' }),
        executePackageAction: () => Object.freeze({ kind: 'handled' as const }),
      }),
    ...(options.events === undefined ? {} : { events: options.events }),
    ...(options.view === undefined ? {} : { view: options.view }),
    ...(options.editor === undefined ? {} : { editor: options.editor(services) }),
    ...(options.density === undefined ? {} : { density: () => options.density! }),
    ...(options.presentation === undefined ? {} : { presentation: () => options.presentation! }),
    onInteraction: (intent) => activity.set(describeIntent(intent)),
  });
  const unsubscribeOperations = board.subscribeOperations((snapshot) => {
    if (snapshot.state !== 'accepted') return;
    // Reconcile on the next microtask so the coordinator has completed its accepted transition
    // before the application confirms that the reactive source publication is authoritative.
    queueMicrotask(() => board.reconcilePublication({ kind: 'confirmed', operationId: snapshot.operationId }));
  });
  onCleanup(unsubscribeOperations);
  return {
    board,
    activity,
    setActivity: services.setActivity,
    cards,
    replaceCard,
    appendCard,
    subscribeCards: services.subscribeCards,
  };
}
