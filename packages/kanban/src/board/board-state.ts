import type { CardKey } from '../contract/identity.js';
import type { KanbanIdentityChangeBatch } from '../source/types.js';
import type { KanbanIdentityInput } from './kanban-viewport.js';

/**
 * Removes identities that an authoritative source publication declares deleted.
 *
 * Virtualized or unloaded cards do not appear in an identity-change batch, so they remain selected.
 */
export function reconcileKanbanBoardIdentity(
  identity: KanbanIdentityInput,
  batch: KanbanIdentityChangeBatch | undefined,
): KanbanIdentityInput {
  if (batch === undefined || batch.changes.length === 0) return identity;
  const deletedCards = new Set<CardKey>();
  const deletedColumns = new Set<string>();
  for (const change of batch.changes) {
    if (change.kind === 'deleted-card') deletedCards.add(change.cardKey);
    else if (change.kind === 'deleted-column') deletedColumns.add(change.columnId);
  }
  const selectedCardKeys = Object.freeze(
    (identity.selectedCardKeys ?? []).filter((cardKey) => !deletedCards.has(cardKey)),
  );
  const focusedCardKey =
    identity.focusedCardKey === undefined || deletedCards.has(identity.focusedCardKey)
      ? undefined
      : identity.focusedCardKey;
  const focusedColumnId =
    identity.focusedColumnId === undefined || deletedColumns.has(identity.focusedColumnId)
      ? undefined
      : identity.focusedColumnId;
  return Object.freeze({
    selectedCardKeys,
    ...(focusedCardKey === undefined ? {} : { focusedCardKey }),
    ...(focusedColumnId === undefined ? {} : { focusedColumnId }),
  });
}
