import type { KanbanCount } from '../source/counts.js';
import type { KanbanSourceState } from '../source/states.js';

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
  /** Whether every authoritative record is proven resident in the active bounded source. */
  readonly authoritativeResident: boolean;
  /** Distinguishes filtered absence from true or unavailable source states. */
  readonly emptyState: KanbanViewEmptyState;
}

/** Committed source and viewport evidence used to derive one honest view summary. */
export interface KanbanViewSummaryEvidence {
  /** Source lifecycle state from the committed query publication. */
  readonly state: KanbanSourceState;
  /** Authoritative records before search and filters. */
  readonly total: KanbanCount;
  /** Records matching the committed query. */
  readonly matching: KanbanCount;
  /** Records proven resident in the committed source session. */
  readonly loaded: KanbanCount;
  /** Whether every authoritative record is proven resident in the committed source session. */
  readonly authoritativeResident: boolean;
  /** Application-supplied authoritative WIP count, when available. */
  readonly wip: KanbanCount;
  /** Whether the committed query contains search or field filters. */
  readonly filtered: boolean;
  /** Exact cards in the latest committed viewport projection. */
  readonly visible: number;
  /** Exact selected identities present in that projection. */
  readonly selected: number;
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
    authoritativeResident: false,
    emptyState: 'none',
  });
}

/** Derives a complete immutable summary without turning unknown source authority into zero. */
export function createKanbanViewSummary(evidence: KanbanViewSummaryEvidence): KanbanViewSummary {
  const emptyState: KanbanViewEmptyState =
    evidence.state.kind === 'loading'
      ? 'loading'
      : evidence.state.kind === 'error'
        ? 'error'
        : evidence.state.kind === 'partial'
          ? 'partial'
          : evidence.matching.quality === 'exact' && evidence.matching.value === 0
            ? evidence.filtered
              ? 'filtered'
              : evidence.total.quality === 'exact' && evidence.total.value === 0
                ? 'true'
                : 'none'
            : 'none';
  return Object.freeze({
    total: evidence.total,
    matching: evidence.matching,
    loaded: evidence.loaded,
    visible: evidence.visible,
    selected: evidence.selected,
    // Only a complete resident authoritative source can use its total as the default WIP population.
    // Windowed sources keep unknown WIP honest unless the application publishes that count directly.
    wip: evidence.wip.quality === 'unknown' && evidence.authoritativeResident ? evidence.total : evidence.wip,
    authoritativeResident: evidence.authoritativeResident,
    emptyState,
  });
}
