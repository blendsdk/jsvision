import type { KanbanCount } from '../source/counts.js';

/** Semantic empty-state distinction derived from the active view and source publication. */
export type KanbanViewEmptyState = 'none' | 'true' | 'filtered' | 'loading' | 'partial' | 'error';

/** Honest count and empty-state snapshot exposed by a view controller. */
export interface KanbanViewSummary {
  /** Authoritative records before search and filters. */
  readonly total: KanbanCount;
  /** Records matching the active semantic query. */
  readonly matching: KanbanCount;
  /** Records currently resident in the active source session. */
  readonly loaded: KanbanCount;
  /** Cards currently projected into the viewport. */
  readonly visible: number;
  /** Selected visible identities in the active interaction projection. */
  readonly selected: number;
  /** Authoritative work-in-progress count, never derived from filtered visibility. */
  readonly wip: KanbanCount;
  /** Distinguishes filtered absence from true or unavailable source states. */
  readonly emptyState: KanbanViewEmptyState;
}

/** Shared immutable unknown count for a controller that is not bound to a board. */
const UNKNOWN_COUNT: KanbanCount = Object.freeze({ quality: 'unknown' });

/** Creates the honest unbound summary used before a board publishes source evidence. */
export function createUnboundKanbanViewSummary(): KanbanViewSummary {
  return Object.freeze({
    total: UNKNOWN_COUNT,
    matching: UNKNOWN_COUNT,
    loaded: UNKNOWN_COUNT,
    visible: 0,
    selected: 0,
    wip: UNKNOWN_COUNT,
    emptyState: 'none',
  });
}
