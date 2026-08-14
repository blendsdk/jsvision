import { createKanbanColumnId } from '../contract/identity.js';
import type { KanbanColumnId } from '../contract/identity.js';

/** Focus target selected after an authoritative column deletion publication. */
export type KanbanConfigurationFocusTarget =
  { readonly kind: 'column'; readonly columnId: KanbanColumnId } | { readonly kind: 'board' };

/** Inputs required to reconcile focus without retaining a hidden or deleted view. */
export interface KanbanDeletedColumnFocusInput {
  /** Ordered columns before the accepted deletion. */
  readonly previousColumnIds: readonly KanbanColumnId[];
  /** Ordered surviving columns in the authoritative publication. */
  readonly currentColumnIds: readonly KanbanColumnId[];
  /** Stable identity removed by the publication. */
  readonly deletedColumnId: KanbanColumnId;
  /** Optional focus identity active before publication. */
  readonly focusedColumnId?: KanbanColumnId;
}

/**
 * Resolves post-deletion focus to the next survivor, previous survivor, or board in that order.
 *
 * @example
 * ```ts
 * reconcileKanbanDeletedColumnFocus({
 *   previousColumnIds: ['todo', 'doing', 'done'],
 *   currentColumnIds: ['todo', 'done'],
 *   deletedColumnId: 'doing',
 *   focusedColumnId: 'doing',
 * });
 * // { kind: 'column', columnId: 'done' }
 * ```
 */
export function reconcileKanbanDeletedColumnFocus(
  input: KanbanDeletedColumnFocusInput,
): KanbanConfigurationFocusTarget {
  const previous = input.previousColumnIds.map(createKanbanColumnId);
  const current = input.currentColumnIds.map(createKanbanColumnId);
  const deleted = createKanbanColumnId(input.deletedColumnId);
  const focused = input.focusedColumnId === undefined ? undefined : createKanbanColumnId(input.focusedColumnId);
  if (new Set(previous).size !== previous.length || new Set(current).size !== current.length) {
    throw new TypeError('Invalid Kanban column focus order.');
  }
  if (focused !== undefined && focused !== deleted && current.includes(focused)) {
    return Object.freeze({ kind: 'column', columnId: focused });
  }
  const deletedIndex = previous.indexOf(deleted);
  if (deletedIndex < 0) return Object.freeze({ kind: 'board' });
  for (let index = deletedIndex + 1; index < previous.length; index += 1) {
    const candidate = previous[index];
    if (candidate !== undefined && current.includes(candidate)) {
      return Object.freeze({ kind: 'column', columnId: candidate });
    }
  }
  for (let index = deletedIndex - 1; index >= 0; index -= 1) {
    const candidate = previous[index];
    if (candidate !== undefined && current.includes(candidate)) {
      return Object.freeze({ kind: 'column', columnId: candidate });
    }
  }
  return Object.freeze({ kind: 'board' });
}
