import type { CardKey } from '../contract/identity.js';
import type { KanbanCardMoveProposal, KanbanMovePosition, KanbanMovedCardSnapshot } from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanMoveCardOptions } from '../interaction/operation-facade.js';
import type { KanbanPlacement } from '../source/types.js';
import type { KanbanViewportDragScene } from './viewport-drag.js';

/** Private viewport readers keep record/cursor access out of the public interaction facade. */
const MOVE_RESOLVERS = new WeakMap<
  object,
  (cardKeys: readonly CardKey[], options: Omit<KanbanMoveCardOptions, 'cardKey'>) => KanbanCardMoveProposal | undefined
>();

/** Current record-independent evidence required to resolve a facade move. */
export interface KanbanViewportMoveEvidence<TCard> {
  /** Current scene, geometry, and source cursors. */
  readonly scene: KanbanViewportDragScene<TCard>;
  /** Optional active saved-view revision. */
  readonly viewRevision?: KanbanRevision;
}

/** Installs one private move-evidence reader during viewport construction. */
export function prepareKanbanViewportMoveReader<TCard>(
  viewport: object,
  reader: () => KanbanViewportMoveEvidence<TCard> | undefined,
): void {
  MOVE_RESOLVERS.set(viewport, (cardKeys, options) => {
    const evidence = reader();
    return evidence === undefined ? undefined : resolveCardMove(evidence, cardKeys, options);
  });
}

/** Removes one private reader during terminal viewport disposal. */
export function disposeKanbanViewportMoveReader(viewport: object): void {
  MOVE_RESOLVERS.delete(viewport);
}

/** Preserves numeric/string card identity without coercion. */
function sameCard(left: CardKey, right: CardKey): boolean {
  return typeof left === typeof right && left === right;
}

/** Converts current cursor placement evidence into a dispatchable move position. */
function movePosition(value: KanbanPlacement): KanbanMovePosition | undefined {
  if (value.kind === 'start' || value.kind === 'end' || value.kind === 'between') return value;
  if (value.kind !== 'window-edge' || value.token === undefined) return undefined;
  return Object.freeze({
    kind: 'window-edge',
    edge: value.edge,
    neighborCardKey: value.neighborCardKey,
    token: value.token,
    cursorRevision: value.cursorRevision,
  });
}

/** Resolves one source-ordered moved set from current source cursors. */
function movedCards<TCard>(
  evidence: KanbanViewportMoveEvidence<TCard>,
  cardKeys: readonly CardKey[],
): readonly KanbanMovedCardSnapshot[] | undefined {
  const identities = new Set(cardKeys.map((cardKey) => JSON.stringify([typeof cardKey, cardKey])));
  const cards = evidence.scene.scene.cards.filter((card) =>
    identities.has(JSON.stringify([typeof card.cardKey, card.cardKey])),
  );
  if (cards.length !== identities.size) return undefined;
  const moved: KanbanMovedCardSnapshot[] = [];
  for (const card of cards) {
    const cell = evidence.scene.source.cells.find(
      (candidate) =>
        candidate.address.columnId === card.address.columnId &&
        candidate.address.swimlaneId === card.address.swimlaneId,
    );
    if (cell === undefined) return undefined;
    const sourcePlacement = movePosition(cell.cursor.placementAt(card.logicalIndex));
    if (sourcePlacement === undefined || !cardKeys.some((key) => sameCard(key, card.cardKey))) return undefined;
    moved.push(
      Object.freeze({
        cardKey: card.cardKey,
        source: card.address,
        sourcePlacement,
        sourceRevision: cell.cursor.revision(),
        entityRevision: card.entityRevision,
      }),
    );
  }
  return Object.freeze(moved);
}

/** Resolves an explicit or adjacent target address from current visible structure. */
function targetAddress<TCard>(
  evidence: KanbanViewportMoveEvidence<TCard>,
  moved: readonly KanbanMovedCardSnapshot[],
  options: Omit<KanbanMoveCardOptions, 'cardKey'>,
) {
  if (options.target !== undefined) return Object.freeze({ ...options.target });
  if (options.direction !== 'left' && options.direction !== 'right') return undefined;
  const source = moved[0]?.source;
  if (source === undefined) return undefined;
  const columns = evidence.scene.source.structure.columns;
  const index = columns.findIndex(({ columnId }) => columnId === source.columnId);
  const targetIndex = options.direction === 'left' ? index - 1 : index + 1;
  const column = columns[targetIndex];
  return column === undefined
    ? undefined
    : Object.freeze({
        columnId: column.columnId,
        ...(source.swimlaneId === undefined ? {} : { swimlaneId: source.swimlaneId }),
      });
}

/** Completes a caller edge with current destination cursor revision and completeness evidence. */
function destinationPosition<TCard>(
  evidence: KanbanViewportMoveEvidence<TCard>,
  address: Readonly<{ readonly columnId: string; readonly swimlaneId?: string }>,
  options: Omit<KanbanMoveCardOptions, 'cardKey'>,
): KanbanMovePosition | undefined {
  const cell = evidence.scene.source.cells.find(
    (candidate) =>
      candidate.address.columnId === address.columnId && candidate.address.swimlaneId === address.swimlaneId,
  );
  if (cell === undefined) return undefined;
  const edge = options.position?.kind ?? (options.direction === 'start' ? 'start' : 'end');
  if (edge === 'start') return movePosition(cell.cursor.placementAt(0));
  const length = cell.cursor.length();
  return length.kind === 'exact' ? movePosition(cell.cursor.placementAt(length.value)) : undefined;
}

/** Resolves one facade move through the viewport's current immutable source snapshot. */
function resolveCardMove<TCard>(
  evidence: KanbanViewportMoveEvidence<TCard>,
  cardKeys: readonly CardKey[],
  options: Omit<KanbanMoveCardOptions, 'cardKey'>,
): KanbanCardMoveProposal | undefined {
  try {
    const moved = movedCards(evidence, cardKeys);
    if (moved === undefined || moved.length === 0) return undefined;
    const target = targetAddress(evidence, moved, options);
    if (target === undefined) return undefined;
    const position = destinationPosition(evidence, target, options);
    if (position === undefined) return undefined;
    const proposal = snapshotKanbanRequestProposal({
      kind: 'card-move',
      moved,
      target,
      position,
      ...(evidence.viewRevision === undefined ? {} : { viewRevision: evidence.viewRevision }),
    });
    return proposal.kind === 'card-move' ? proposal : undefined;
  } catch {
    return undefined;
  }
}

/** Resolves one facade move through the viewport's private current-evidence reader. */
export function resolveKanbanViewportCardMove(
  viewport: object,
  cardKeys: readonly CardKey[],
  options: Omit<KanbanMoveCardOptions, 'cardKey'>,
): KanbanCardMoveProposal | undefined {
  return MOVE_RESOLVERS.get(viewport)?.(cardKeys, options);
}
