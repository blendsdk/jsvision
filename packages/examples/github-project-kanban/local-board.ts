import { signal } from '@jsvision/ui';
import { KanbanBoard, createEagerKanbanDataSource, createStandardKanbanCardAdapter } from '@jsvision/kanban';
import type {
  KanbanInteractionIntent,
  KanbanQuery,
  KanbanRequest,
  KanbanRequestResult,
  KanbanStructurePolicy,
} from '@jsvision/kanban';

import type {
  GitHubProjectCard,
  GitHubProjectCardData,
  GitHubProjectSnapshot,
  GitHubProjectStatusColor,
} from './github-project.js';

const BASE_QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });

/** Runtime seams for one locally movable imported project board. */
export interface LocalGitHubProjectBoard {
  /** Real generic Kanban component rendered by the standalone app. */
  readonly board: KanbanBoard<GitHubProjectCard>;
  /** Current locally reordered card array. */
  readonly cards: () => readonly GitHubProjectCard[];
  /** Current user-facing interaction feedback. */
  readonly activity: () => string;
  /** Releases the operation subscription owned by this board instance. */
  dispose(): void;
}

/** Maps GitHub's compact status palette to semantic roles that adapt to every JSVision theme. */
function roleForStatus(
  color: GitHubProjectStatusColor,
): 'card.normal' | 'card.read-only' | 'wip.warning' | 'wip.error' {
  if (color === 'RED' || color === 'PINK') return 'wip.error';
  if (color === 'YELLOW' || color === 'ORANGE') return 'wip.warning';
  if (color === 'PURPLE' || color === 'GRAY') return 'card.read-only';
  return 'card.normal';
}

/** Rich but bounded GitHub card presentation shared by every loaded project. */
const GITHUB_CARD_ADAPTER = createStandardKanbanCardAdapter<string, GitHubProjectCardData>({
  fields: {
    labels: { label: 'Labels', priority: 1 },
    type: { label: 'Type', priority: 2 },
  },
  summaries: [
    { fieldId: 'repository', label: 'Repo', priority: 1 },
    { fieldId: 'reference', label: 'Item', priority: 2 },
  ],
  styleOf: (card, state) => {
    if (state.focused && state.selected) {
      return { revision: 'focused-selected', surfaceRole: 'card.focused-selected', markerRole: 'card.selected' };
    }
    if (state.focused) return { revision: 'focused', surfaceRole: 'card.focused', markerRole: 'card.focused' };
    if (state.selected) return { revision: 'selected', surfaceRole: 'card.selected', markerRole: 'card.selected' };
    const role = roleForStatus(card.custom?.statusColor ?? 'GRAY');
    return { revision: `github-${card.custom?.statusColor ?? 'GRAY'}`, surfaceRole: role, borderRole: role };
  },
});

/** Compares application-owned card keys without coercion. */
function sameCardKey(left: string | number, right: string | number): boolean {
  return typeof left === typeof right && left === right;
}

/** Finds the array position represented by a stable-neighbor move placement. */
function insertionIndex(
  cards: readonly GitHubProjectCard[],
  request: Extract<KanbanRequest, { readonly kind: 'card-move' }>,
): number {
  const targetIndexes = cards.flatMap((card, index) => (card.columnId === request.target.columnId ? [index] : []));
  const firstTarget = targetIndexes[0] ?? cards.length;
  const lastTarget = targetIndexes.at(-1);
  const position = request.position;
  if (position.kind === 'start') return firstTarget;
  if (position.kind === 'end') return lastTarget === undefined ? cards.length : lastTarget + 1;
  if (position.kind === 'between') {
    const afterCardKey = position.afterCardKey;
    const after = afterCardKey === null ? -1 : cards.findIndex(({ key }) => sameCardKey(key, afterCardKey));
    if (after >= 0) return after;
    const beforeCardKey = position.beforeCardKey;
    const before = beforeCardKey === null ? -1 : cards.findIndex(({ key }) => sameCardKey(key, beforeCardKey));
    return before >= 0 ? before + 1 : firstTarget;
  }
  const neighbor = cards.findIndex(({ key }) => sameCardKey(key, position.neighborCardKey));
  if (neighbor >= 0) return position.edge === 'before' ? neighbor : neighbor + 1;
  return position.edge === 'before' ? firstTarget : lastTarget === undefined ? cards.length : lastTarget + 1;
}

/** Applies one accepted move to the application-owned local snapshot. */
function applyCardMove(
  cards: readonly GitHubProjectCard[],
  request: Extract<KanbanRequest, { readonly kind: 'card-move' }>,
): readonly GitHubProjectCard[] {
  const movedKeys = request.moved.map(({ cardKey }) => cardKey);
  const moved = request.moved.flatMap(({ cardKey }) => {
    const card = cards.find(({ key }) => sameCardKey(key, cardKey));
    return card === undefined ? [] : [Object.freeze({ ...card, columnId: request.target.columnId })];
  });
  const remaining = cards.filter(({ key }) => !movedKeys.some((cardKey) => sameCardKey(key, cardKey)));
  const index = insertionIndex(remaining, request);
  return Object.freeze([...remaining.slice(0, index), ...moved, ...remaining.slice(index)]);
}

/** Converts non-move interactions into concise playground feedback. */
function describeIntent(intent: KanbanInteractionIntent): string {
  if (intent.kind === 'open-card') return `GitHub item ${String(intent.cardKey)} · source remains read-only`;
  if (intent.kind === 'open-context') return `Context requested for ${intent.scope.kind}`;
  return `${intent.actionId} · ${intent.scope.kind}`;
}

/**
 * Creates a rich board whose moves mutate only an in-memory copy of one GitHub snapshot.
 *
 * @param snapshot Authoritative GitHub snapshot to copy into local playground state.
 * @returns Board, observable local cards and feedback, plus explicit cleanup.
 */
export function createLocalGitHubProjectBoard(snapshot: GitHubProjectSnapshot): LocalGitHubProjectBoard {
  const cards = signal(Object.freeze([...snapshot.cards]));
  const activity = signal('Drag a card or use Ctrl+Shift+Arrow · changes stay local');
  const columns = Object.freeze(
    snapshot.columns.map(({ columnId, label, revision }) => Object.freeze({ columnId, label, revision })),
  );
  const source = createEagerKanbanDataSource(cards, {
    // GitHub color is application presentation metadata. Publish only the exact source contract;
    // its runtime validator intentionally rejects extra properties at this trust boundary.
    columns: () => columns,
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
    search: (card, term) => card.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
  });
  const structure: KanbanStructurePolicy<GitHubProjectCard> = Object.freeze({
    revision: `github-project-${snapshot.projectId}`,
    columns: Object.freeze(snapshot.columns.map(({ columnId }) => Object.freeze({ columnId }))),
  });
  const dispatcher = (request: KanbanRequest): KanbanRequestResult => {
    if (request.kind !== 'card-move') {
      return Object.freeze({ kind: 'rejected', operationId: request.operationId, code: 'playground-move-only' });
    }
    cards.set(applyCardMove(cards(), request));
    const label = snapshot.columns.find(({ columnId }) => columnId === request.target.columnId)?.label ?? 'lane';
    activity.set(`Moved locally to ${label} · Refresh restores GitHub`);
    return Object.freeze({ kind: 'accepted', operationId: request.operationId });
  };
  const board = new KanbanBoard<GitHubProjectCard>({
    source,
    query: () => BASE_QUERY,
    card: GITHUB_CARD_ADAPTER,
    structure: () => structure,
    dispatcher,
    operationEligibility: () => Object.freeze({ kind: 'allowed' }),
    presentation: () => ({
      revision: 'github-rich-v1',
      cardRows: 9,
      cardGap: 1,
      metadataFields: 3,
      labelRows: 1,
      summarySections: 1,
      checklistMode: 'hidden',
      checklistPreviewItems: 0,
    }),
    onInteraction: (intent) => activity.set(describeIntent(intent)),
  });
  const unsubscribe = board.subscribeOperations((operation) => {
    if (operation.state !== 'accepted') return;
    queueMicrotask(() => board.reconcilePublication({ kind: 'confirmed', operationId: operation.operationId }));
  });
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
  };
  return { board, cards, activity, dispose };
}
