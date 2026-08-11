import type { Rect } from '@jsvision/ui';

import type { CardKey, KanbanOperationId } from '../contract/identity.js';
import type { KanbanMovePosition } from '../contract/request.js';
import type { KanbanOperationSnapshot } from '../operation/types.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanViewportProjection } from './viewport-projector.js';

/** One clipped pending or accepted semantic block, containing identities but no application records. */
export interface KanbanProjectedPendingBlock {
  /** Stable operation identity used to correlate lifecycle feedback. */
  readonly operationId: KanbanOperationId;
  /** Pending lifecycle state. */
  readonly state: 'pending' | 'accepted';
  /** Visible ordered card identities represented atomically. */
  readonly cardKeys: readonly CardKey[];
  /** Complete bounded atomic card count. */
  readonly count: number;
  /** Source addresses aligned with the complete semantic moved set. */
  readonly sources: readonly KanbanCellAddress[];
  /** Source addresses aligned with the visible `cardKeys` subset. */
  readonly visibleSources: readonly KanbanCellAddress[];
  /** Semantic destination cell. */
  readonly target: KanbanCellAddress;
  /** Semantic destination workflow column. */
  readonly columnId: string;
  /** Optional semantic destination swimlane. */
  readonly swimlaneId?: string;
  /** Whether the destination itself is outside current resident geometry. */
  readonly offscreen: boolean;
  /** Clipped viewport-local block rectangle. */
  readonly rect: Readonly<Rect>;
  /** Non-color ASCII marker. */
  readonly asciiMarker: '~';
  /** Non-color Unicode marker. */
  readonly unicodeMarker: '…';
}

/** Bounded terminal operation feedback retained outside card bodies. */
export interface KanbanProjectedOperationFeedback {
  /** Stable operation identity. */
  readonly operationId: KanbanOperationId;
  /** Terminal semantic outcome. */
  readonly state: 'rejected' | 'cancelled' | 'superseded';
  /** Allowlisted localization key selected from the outcome, never a raw application value. */
  readonly messageKey: string;
  /** Non-color ASCII marker. */
  readonly asciiMarker: 'x' | '!';
  /** Non-color Unicode marker. */
  readonly unicodeMarker: '×' | '!';
  /** Clipped viewport-local feedback rectangle. */
  readonly rect: Readonly<Rect>;
}

/** Complete pure operation projection result. */
export interface KanbanOperationProjection {
  /** Active pending and accepted move blocks. */
  readonly pending: readonly KanbanProjectedPendingBlock[];
  /** Bounded terminal feedback records. */
  readonly feedback: readonly KanbanProjectedOperationFeedback[];
  /** Visible card identities removed from authoritative drawing while projected elsewhere. */
  readonly projectedCardKeys: readonly CardKey[];
  /** Visible card subjects whose conflicting actions must be disabled. */
  readonly blockedCardKeys: ReadonlySet<string>;
  /** Column subjects whose conflicting actions must be disabled. */
  readonly blockedColumnIds: ReadonlySet<string>;
  /** Swimlane subjects whose conflicting actions must be disabled. */
  readonly blockedSwimlaneIds: ReadonlySet<string>;
}

/** Clips a rectangle to viewport-local bounds. */
function clip(rect: Readonly<Rect>, bounds: Readonly<Rect>): Readonly<Rect> | undefined {
  const x = Math.max(bounds.x, rect.x);
  const y = Math.max(bounds.y, rect.y);
  const right = Math.min(bounds.x + bounds.width, rect.x + rect.width);
  const bottom = Math.min(bounds.y + bounds.height, rect.y + rect.height);
  return right <= x || bottom <= y ? undefined : Object.freeze({ x, y, width: right - x, height: bottom - y });
}

/** Returns a collision-safe type-preserving card identity. */
function cardIdentity(cardKey: CardKey): string {
  return JSON.stringify([typeof cardKey, cardKey]);
}

/** Compares complete semantic cell addresses. */
function sameAddress(left: KanbanCellAddress, right: KanbanCellAddress): boolean {
  return left.columnId === right.columnId && left.swimlaneId === right.swimlaneId;
}

/** Finds the visible insertion row represented by a semantic move position. */
function insertionRow(
  projection: KanbanViewportProjection,
  target: KanbanCellAddress,
  position: KanbanMovePosition,
  fallback: number,
): number {
  const targetCards = projection.cards.filter((card) =>
    sameAddress(
      { columnId: card.columnId, ...(card.swimlaneId === undefined ? {} : { swimlaneId: card.swimlaneId }) },
      target,
    ),
  );
  switch (position.kind) {
    case 'start':
      return targetCards[0]?.rect.y ?? fallback;
    case 'end': {
      const last = targetCards.at(-1);
      return last === undefined ? fallback : last.rect.y + last.rect.height + 1;
    }
    case 'between': {
      const beforeKey = position.beforeCardKey;
      const before =
        beforeKey === null
          ? undefined
          : targetCards.find((card) => cardIdentity(card.descriptor.cardKey) === cardIdentity(beforeKey));
      if (before !== undefined) return before.rect.y + before.rect.height + 1;
      const afterKey = position.afterCardKey;
      const after =
        afterKey === null
          ? undefined
          : targetCards.find((card) => cardIdentity(card.descriptor.cardKey) === cardIdentity(afterKey));
      return after?.rect.y ?? fallback;
    }
    case 'window-edge':
      return fallback;
  }
}

/** Creates a placement identity without retaining an opaque placement token. */
function slotIdentity(target: KanbanCellAddress, position: KanbanMovePosition): string {
  const placement =
    position.kind === 'between'
      ? [position.kind, position.beforeCardKey, position.afterCardKey]
      : position.kind === 'window-edge'
        ? [position.kind, position.edge, position.neighborCardKey]
        : [position.kind];
  return JSON.stringify([target.columnId, target.swimlaneId ?? null, ...placement]);
}

/** Selects a fixed package-owned localization key for one terminal outcome. */
function feedbackKey(state: 'rejected' | 'cancelled' | 'superseded'): string {
  return state === 'rejected'
    ? 'kanban.operation.rejected'
    : state === 'superseded'
      ? 'kanban.operation.superseded'
      : 'kanban.operation.cancelled';
}

/**
 * Projects payload-free operation snapshots into bounded viewport-local blocks and feedback.
 *
 * Only visible moved identities are retained for card filtering. Complete atomic cardinality remains a
 * number, preventing valid bulk requests from expanding frame work by logical selection size.
 */
export function projectKanbanOperations(
  projection: KanbanViewportProjection,
  operations: readonly KanbanOperationSnapshot[],
  bounds: Readonly<Rect>,
): KanbanOperationProjection {
  const pending: KanbanProjectedPendingBlock[] = [];
  const feedback: KanbanProjectedOperationFeedback[] = [];
  const projectedCardKeys: CardKey[] = [];
  const visibleCards = new Map(projection.cards.map((card) => [cardIdentity(card.descriptor.cardKey), card] as const));
  const blockedCardKeys = new Set<string>();
  const blockedColumnIds = new Set<string>();
  const blockedSwimlaneIds = new Set<string>();
  const slotRows = new Map<string, number>();

  for (const operation of operations) {
    for (const affected of operation.affected) {
      if (affected.kind === 'card') blockedCardKeys.add(cardIdentity(affected.cardKey));
      else if (affected.kind === 'column') blockedColumnIds.add(affected.columnId);
      else blockedSwimlaneIds.add(affected.swimlaneId);
    }
    if (
      (operation.state === 'pending' || operation.state === 'accepted') &&
      operation.projection?.kind === 'card-move'
    ) {
      const semantic = operation.projection;
      const visiblePairs = semantic.cardKeys.flatMap((cardKey, index) =>
        visibleCards.has(cardIdentity(cardKey))
          ? [Object.freeze({ cardKey, source: semantic.sources[index] ?? semantic.target })]
          : [],
      );
      const visibleMoved = visiblePairs.map(({ cardKey }) => cardKey);
      projectedCardKeys.push(...visibleMoved);
      const cell = projection.geometry?.cells.find(({ address }) => sameAddress(address, semantic.target));
      const column = projection.columns.find(({ columnId }) => columnId === semantic.target.columnId);
      const sourceCard = visibleMoved.map((cardKey) => visibleCards.get(cardIdentity(cardKey))).find(Boolean);
      const surface = cell ?? column?.rect ?? sourceCard?.rect;
      if (surface === undefined) continue;
      const offscreen = column === undefined || (semantic.target.swimlaneId !== undefined && cell === undefined);
      const blockHeight = Math.max(1, Math.min(3, semantic.cardKeys.length + 1));
      const slot = slotIdentity(semantic.target, semantic.position);
      const baseRow = offscreen
        ? (sourceCard?.rect.y ?? surface.y)
        : insertionRow(projection, semantic.target, semantic.position, surface.y);
      const y = Math.min(
        Math.max(surface.y, baseRow + (slotRows.get(slot) ?? 0)),
        Math.max(surface.y, surface.y + surface.height - blockHeight),
      );
      const complete = {
        x: surface.x + Math.min(1, Math.max(0, surface.width - 1)),
        y,
        width: Math.max(1, surface.width - 2),
        height: blockHeight,
      };
      const rect = clip(complete, bounds);
      if (rect === undefined) continue;
      slotRows.set(slot, (slotRows.get(slot) ?? 0) + blockHeight + 1);
      pending.push(
        Object.freeze({
          operationId: operation.operationId,
          state: operation.state,
          cardKeys: Object.freeze(visibleMoved),
          count: semantic.cardKeys.length,
          sources: semantic.sources,
          visibleSources: Object.freeze(visiblePairs.map(({ source }) => source)),
          target: semantic.target,
          columnId: semantic.target.columnId,
          ...(semantic.target.swimlaneId === undefined ? {} : { swimlaneId: semantic.target.swimlaneId }),
          offscreen,
          rect,
          asciiMarker: '~' as const,
          unicodeMarker: '…' as const,
        }),
      );
      continue;
    }
    if (operation.state !== 'rejected' && operation.state !== 'cancelled' && operation.state !== 'superseded') {
      continue;
    }
    const rect = clip({ x: 0, y: Math.max(0, bounds.height - 1), width: bounds.width, height: 1 }, bounds);
    if (rect === undefined) continue;
    feedback.push(
      Object.freeze({
        operationId: operation.operationId,
        state: operation.state,
        messageKey: feedbackKey(operation.state),
        asciiMarker: operation.state === 'superseded' ? '!' : 'x',
        unicodeMarker: operation.state === 'superseded' ? '!' : '×',
        rect,
      }),
    );
  }
  return Object.freeze({
    pending: Object.freeze(pending),
    feedback: Object.freeze(feedback),
    projectedCardKeys: Object.freeze(projectedCardKeys),
    blockedCardKeys,
    blockedColumnIds,
    blockedSwimlaneIds,
  });
}
