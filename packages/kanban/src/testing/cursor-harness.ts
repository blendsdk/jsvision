import type { CardKey } from '../contract/identity.js';
import type { KanbanLimitOptions } from '../contract/limits.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { KanbanObservationBuffer } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { KanbanCursorCoordinator } from '../source/cursor-coordinator.js';
import type { KanbanCellCounts } from '../source/counts.js';
import type { KanbanCellState, KanbanKnownLength } from '../source/states.js';
import type { KanbanCellAddress, KanbanCellCursor, KanbanPlacement } from '../source/types.js';
import type { KanbanRevision } from '../contract/revision.js';

/** Safe inspection of one requested resident or unloaded card slot. */
export interface KanbanCursorCardInspection {
  /** Requested logical index. */
  readonly index: number;
  /** Stable card key, or an explicit unloaded marker. */
  readonly cardKey: CardKey | 'unloaded';
}

/** Safe placement inspection with every opaque token value removed. */
export type KanbanPlacementInspection =
  | Exclude<KanbanPlacement, { readonly kind: 'window-edge' }>
  | {
      readonly kind: 'window-edge';
      readonly edge: 'before' | 'after';
      readonly neighborCardKey: CardKey;
      readonly token?: 'redacted';
      readonly cursorRevision: KanbanRevision;
    };

/** Detached inspection of one cursor's observable public state. */
export interface KanbanCursorInspection {
  readonly state: KanbanCellState;
  readonly counts: KanbanCellCounts;
  readonly length: KanbanKnownLength;
  readonly revision: KanbanRevision;
  readonly cards: readonly KanbanCursorCardInspection[];
  readonly placements: readonly KanbanPlacementInspection[];
}

/** Public black-box cursor lifecycle harness. */
export interface KanbanCursorLifecycleHarness {
  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void>;
  snapshot(options?: {
    readonly indices?: readonly number[];
    readonly slots?: readonly number[];
  }): KanbanCursorInspection;
  retry(): Promise<void>;
  observations(): readonly KanbanObservation[];
  dispose(): void;
}

/** Options for the testing-only cursor lifecycle harness. */
export interface KanbanCursorLifecycleHarnessOptions<TCard> {
  readonly cursor: KanbanCellCursor<TCard>;
  readonly address: KanbanCellAddress;
  readonly keyOf: (card: TCard) => CardKey;
  readonly limits?: KanbanLimitOptions;
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Removes opaque token values while retaining the placement's semantic kind and anchors. */
function inspectPlacement(placement: KanbanPlacement): KanbanPlacementInspection {
  if (placement.kind !== 'window-edge') return Object.freeze({ ...placement });
  if (placement.token === undefined) {
    return Object.freeze({
      kind: placement.kind,
      edge: placement.edge,
      neighborCardKey: placement.neighborCardKey,
      cursorRevision: placement.cursorRevision,
    });
  }
  return Object.freeze({
    kind: placement.kind,
    edge: placement.edge,
    neighborCardKey: placement.neighborCardKey,
    token: 'redacted',
    cursorRevision: placement.cursorRevision,
  });
}

/**
 * Creates a black-box cursor lifecycle harness without exposing ranges, queues, or cursor identity.
 *
 * @example
 * ```ts
 * const harness = createKanbanCursorLifecycleHarness({ cursor, address, keyOf: (card) => card.id });
 * await harness.ensureRange(0, 20);
 * ```
 */
export function createKanbanCursorLifecycleHarness<TCard>(
  options: KanbanCursorLifecycleHarnessOptions<TCard>,
): KanbanCursorLifecycleHarness {
  const observations = new KanbanObservationBuffer(KANBAN_LIMITS.retainedObservations.safe);
  const publish = (observation: KanbanObservation): void => {
    observations.push(observation);
    try {
      options.observe?.(observation);
    } catch {
      // Diagnostic sinks cannot interfere with the harness.
    }
  };
  const coordinator = new KanbanCursorCoordinator({ ...options, observe: publish });
  let disposed = false;
  let lastInspection: KanbanCursorInspection | undefined;

  const inspect = (inspectionOptions?: {
    readonly indices?: readonly number[];
    readonly slots?: readonly number[];
  }): KanbanCursorInspection => {
    const indices = inspectionOptions?.indices ?? [];
    const slots = inspectionOptions?.slots ?? [];
    if (indices.length > KANBAN_LIMITS.ensureRangeCards.safe || slots.length > KANBAN_LIMITS.ensureRangeCards.safe) {
      throw new RangeError('Kanban cursor inspection exceeds its bounded request size.');
    }
    const inspection = Object.freeze({
      state: coordinator.state(),
      counts: coordinator.counts(),
      length: coordinator.length(),
      revision: coordinator.revision(),
      cards: Object.freeze(
        indices.map((index) => Object.freeze({ index, cardKey: coordinator.cardKeyAt(index) ?? 'unloaded' })),
      ),
      placements: Object.freeze(slots.map((slot) => inspectPlacement(coordinator.placementAt(slot)))),
    });
    lastInspection = inspection;
    return inspection;
  };

  return Object.freeze({
    ensureRange(start: number, end: number, rangeOptions?: { readonly signal?: AbortSignal }): Promise<void> {
      try {
        return coordinator.ensureRange(start, end, rangeOptions);
      } catch (error) {
        return Promise.reject(error);
      }
    },
    snapshot(inspectionOptions?: {
      readonly indices?: readonly number[];
      readonly slots?: readonly number[];
    }): KanbanCursorInspection {
      if (disposed) {
        if (lastInspection === undefined) throw new Error('Cursor inspection was unavailable before disposal.');
        return lastInspection;
      }
      return inspect(inspectionOptions);
    },
    retry: () => coordinator.retry(),
    observations: () => observations.values(),
    dispose(): void {
      if (disposed) return;
      lastInspection = inspect();
      disposed = true;
      coordinator.dispose();
    },
  });
}
