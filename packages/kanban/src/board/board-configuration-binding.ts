import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanColumnId, KanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';

/** Exact members accepted by structural focus reconciliation. */
const FOCUS_KEYS = new Set(['previousColumnIds', 'currentColumnIds', 'deletedColumnId', 'focusedColumnId']);
/** Exact members accepted by swimlane focus reconciliation. */
const SWIMLANE_FOCUS_KEYS = new Set([
  'previousSwimlaneIds',
  'currentSwimlaneIds',
  'deletedSwimlaneId',
  'focusedSwimlaneId',
]);

/** Returns one string identity without coercing hostile input. */
function requiredString(value: unknown): string {
  if (typeof value !== 'string') throw new KanbanInvalidSemanticValueError();
  return value;
}

/** Focus target selected after an authoritative column deletion publication. */
export type KanbanConfigurationFocusTarget =
  | { readonly kind: 'column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'board' };

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

/** Inputs required to reconcile focus after an authoritative swimlane deletion. */
export interface KanbanDeletedSwimlaneFocusInput {
  /** Ordered swimlanes before the accepted deletion. */
  readonly previousSwimlaneIds: readonly KanbanSwimlaneId[];
  /** Ordered surviving swimlanes in the authoritative publication. */
  readonly currentSwimlaneIds: readonly KanbanSwimlaneId[];
  /** Stable identity removed by the publication. */
  readonly deletedSwimlaneId: KanbanSwimlaneId;
  /** Optional focus identity active before publication. */
  readonly focusedSwimlaneId?: KanbanSwimlaneId;
}

/** Selects the next survivor, previous survivor, or board without relying on a visual index. */
function reconcileOrderedFocus<T extends string>(
  previous: readonly T[],
  current: readonly T[],
  deleted: T,
  focused: T | undefined,
  target: (identity: T) => KanbanConfigurationFocusTarget,
): KanbanConfigurationFocusTarget {
  if (new Set(previous).size !== previous.length || new Set(current).size !== current.length) {
    throw new KanbanInvalidSemanticValueError();
  }
  if (focused !== undefined && focused !== deleted && current.includes(focused)) return target(focused);
  const deletedIndex = previous.indexOf(deleted);
  if (deletedIndex < 0) return Object.freeze({ kind: 'board' });
  for (let index = deletedIndex + 1; index < previous.length; index += 1) {
    const candidate = previous[index];
    if (candidate !== undefined && current.includes(candidate)) return target(candidate);
  }
  for (let index = deletedIndex - 1; index >= 0; index -= 1) {
    const candidate = previous[index];
    if (candidate !== undefined && current.includes(candidate)) return target(candidate);
  }
  return Object.freeze({ kind: 'board' });
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
  const properties = snapshotKanbanDataProperties(input, FOCUS_KEYS.size);
  validateKanbanDataKeys(properties, FOCUS_KEYS);
  const previous = snapshotKanbanDataArray(properties.previousColumnIds, KANBAN_LIMITS.columns.safe).map((value) =>
    createKanbanColumnId(requiredString(value)),
  );
  const current = snapshotKanbanDataArray(properties.currentColumnIds, KANBAN_LIMITS.columns.safe).map((value) =>
    createKanbanColumnId(requiredString(value)),
  );
  const deleted = createKanbanColumnId(requiredString(properties.deletedColumnId));
  const focused =
    properties.focusedColumnId === undefined
      ? undefined
      : createKanbanColumnId(requiredString(properties.focusedColumnId));
  return reconcileOrderedFocus(previous, current, deleted, focused, (columnId) =>
    Object.freeze({ kind: 'column', columnId }),
  );
}

/** Resolves post-deletion swimlane focus with the same deterministic survivor rule. */
export function reconcileKanbanDeletedSwimlaneFocus(
  input: KanbanDeletedSwimlaneFocusInput,
): KanbanConfigurationFocusTarget {
  const properties = snapshotKanbanDataProperties(input, SWIMLANE_FOCUS_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_FOCUS_KEYS);
  const previous = snapshotKanbanDataArray(properties.previousSwimlaneIds, KANBAN_LIMITS.swimlanes.safe).map((value) =>
    createKanbanSwimlaneId(requiredString(value)),
  );
  const current = snapshotKanbanDataArray(properties.currentSwimlaneIds, KANBAN_LIMITS.swimlanes.safe).map((value) =>
    createKanbanSwimlaneId(requiredString(value)),
  );
  const deleted = createKanbanSwimlaneId(requiredString(properties.deletedSwimlaneId));
  const focused =
    properties.focusedSwimlaneId === undefined
      ? undefined
      : createKanbanSwimlaneId(requiredString(properties.focusedSwimlaneId));
  return reconcileOrderedFocus(previous, current, deleted, focused, (swimlaneId) =>
    Object.freeze({ kind: 'swimlane', swimlaneId }),
  );
}
