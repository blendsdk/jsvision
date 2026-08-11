import type { Rect } from '@jsvision/ui';

import type { CardKey, KanbanOperationId } from '../contract/identity.js';
import type { KanbanOperationSnapshot } from '../operation/types.js';
import type { KanbanViewportProjection } from './viewport-projector.js';

/** One clipped pending or accepted semantic block, containing identities but no application records. */
export interface KanbanProjectedPendingBlock {
  /** Stable operation identity used to correlate lifecycle feedback. */
  readonly operationId: KanbanOperationId;
  /** Pending lifecycle state. */
  readonly state: 'pending' | 'accepted';
  /** Ordered card identities represented atomically. */
  readonly cardKeys: readonly CardKey[];
  /** Semantic destination workflow column. */
  readonly columnId: string;
  /** Optional semantic destination swimlane. */
  readonly swimlaneId?: string;
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
  /** Card identities removed from authoritative drawing while projected elsewhere. */
  readonly projectedCardKeys: readonly CardKey[];
}

/** Clips a rectangle to viewport-local bounds. */
function clip(rect: Readonly<Rect>, bounds: Readonly<Rect>): Readonly<Rect> | undefined {
  const x = Math.max(bounds.x, rect.x);
  const y = Math.max(bounds.y, rect.y);
  const right = Math.min(bounds.x + bounds.width, rect.x + rect.width);
  const bottom = Math.min(bounds.y + bounds.height, rect.y + rect.height);
  return right <= x || bottom <= y ? undefined : Object.freeze({ x, y, width: right - x, height: bottom - y });
}

/** Compares string and number card identities without coercion. */
function sameCard(left: CardKey, right: CardKey): boolean {
  return typeof left === typeof right && left === right;
}

/** Finds the visible insertion row represented by a semantic move position. */
function insertionRow(
  projection: KanbanViewportProjection,
  operation: Extract<KanbanOperationSnapshot['projection'], { readonly kind: 'card-move' }>,
): number {
  const position = operation.position;
  const targetCards = projection.cards.filter(
    (card) => card.columnId === operation.target.columnId && card.swimlaneId === operation.target.swimlaneId,
  );
  switch (position.kind) {
    case 'start':
      return targetCards[0]?.rect.y ?? 3;
    case 'end': {
      const last = targetCards.at(-1);
      return last === undefined ? 3 : last.rect.y + last.rect.height + 1;
    }
    case 'between': {
      const before =
        position.beforeCardKey === null
          ? undefined
          : targetCards.find((card) => sameCard(card.descriptor.cardKey, position.beforeCardKey!));
      if (before !== undefined) return before.rect.y + before.rect.height + 1;
      const after =
        position.afterCardKey === null
          ? undefined
          : targetCards.find((card) => sameCard(card.descriptor.cardKey, position.afterCardKey!));
      return after?.rect.y ?? 3;
    }
    case 'window-edge':
      return 3;
  }
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
 * Missing descriptors deliberately degrade to identity/count markers. The result never retains a
 * card record, dispatcher error, placement token, or raw reason code.
 */
export function projectKanbanOperations(
  projection: KanbanViewportProjection,
  operations: readonly KanbanOperationSnapshot[],
  bounds: Readonly<Rect>,
): KanbanOperationProjection {
  const pending: KanbanProjectedPendingBlock[] = [];
  const feedback: KanbanProjectedOperationFeedback[] = [];
  const projectedCardKeys: CardKey[] = [];
  for (const operation of operations) {
    if (
      (operation.state === 'pending' || operation.state === 'accepted') &&
      operation.projection?.kind === 'card-move'
    ) {
      const semantic = operation.projection;
      const column = projection.columns.find(({ columnId }) => columnId === semantic.target.columnId);
      if (column === undefined) continue;
      const complete = {
        x: column.rect.x + Math.min(1, Math.max(0, column.rect.width - 1)),
        y: insertionRow(projection, semantic),
        width: Math.max(1, column.rect.width - 2),
        height: Math.max(1, Math.min(3, semantic.cardKeys.length + 1)),
      };
      const rect = clip(complete, bounds);
      if (rect === undefined) continue;
      projectedCardKeys.push(...semantic.cardKeys);
      pending.push(
        Object.freeze({
          operationId: operation.operationId,
          state: operation.state,
          cardKeys: semantic.cardKeys,
          columnId: semantic.target.columnId,
          ...(semantic.target.swimlaneId === undefined ? {} : { swimlaneId: semantic.target.swimlaneId }),
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
  });
}
