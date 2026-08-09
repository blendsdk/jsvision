import type { CardKey } from '../contract/identity.js';
import type { KanbanIdentityChangeBatch } from '../source/types.js';
import type { KanbanIdentityInput } from './kanban-viewport.js';
import { createKanbanCardKey, createKanbanColumnId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanDefaultInteractionSeed } from '../interaction/controller.js';

/** Reads and snapshots application identity once, returning an empty value for malformed input. */
export function readKanbanIdentityInput(getter: (() => KanbanIdentityInput) | undefined): KanbanIdentityInput {
  try {
    const value = getter?.();
    if (value === undefined) return Object.freeze({ selectedCardKeys: Object.freeze([]) });
    const selected: CardKey[] = [];
    const seen = new Set<CardKey>();
    for (const rawKey of value.selectedCardKeys ?? []) {
      if (selected.length >= KANBAN_LIMITS.selectedKeys.safe) break;
      const key = createKanbanCardKey(rawKey);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(key);
    }
    const focusedCardKey = value.focusedCardKey === undefined ? undefined : createKanbanCardKey(value.focusedCardKey);
    const focusedColumnId =
      value.focusedColumnId === undefined ? undefined : createKanbanColumnId(value.focusedColumnId);
    return Object.freeze({
      selectedCardKeys: Object.freeze(selected),
      ...(focusedCardKey === undefined ? {} : { focusedCardKey }),
      ...(focusedColumnId === undefined ? {} : { focusedColumnId }),
    });
  } catch {
    return Object.freeze({ selectedCardKeys: Object.freeze([]) });
  }
}

/** Converts one detached legacy identity value into a one-time default-controller seed. */
export function createKanbanDefaultInteractionSeed(identity: KanbanIdentityInput): KanbanDefaultInteractionSeed {
  return Object.freeze({
    selectedCardKeys: Object.freeze([...(identity.selectedCardKeys ?? [])]),
    ...(identity.focusedCardKey === undefined ? {} : { focusedCardKey: identity.focusedCardKey }),
    ...(identity.focusedColumnId === undefined ? {} : { focusedColumnId: identity.focusedColumnId }),
  });
}

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
