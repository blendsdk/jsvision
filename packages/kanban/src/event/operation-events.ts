import type { KanbanOperationSnapshot } from '../operation/types.js';
import type { KanbanEventHub, KanbanEventPublishOutcome } from './types.js';

/**
 * Publishes one existing operation lifecycle snapshot as a record-free public request event.
 *
 * The operation coordinator remains the only lifecycle owner. This adapter copies its already
 * validated identity, request kind, state, and optional safe code without deriving new transitions.
 *
 * @example
 * ```ts
 * authority.subscribe((snapshot) => publishKanbanOperationEvent(events, snapshot));
 * ```
 */
export function publishKanbanOperationEvent(
  events: KanbanEventHub,
  snapshot: KanbanOperationSnapshot,
): KanbanEventPublishOutcome {
  return events.publish({
    kind: 'request',
    operationId: snapshot.operationId,
    requestKind: snapshot.kind,
    state: snapshot.state,
    ...(snapshot.code === undefined ? {} : { code: snapshot.code }),
  });
}
