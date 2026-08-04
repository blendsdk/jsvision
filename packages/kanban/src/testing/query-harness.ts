import type { CardKey } from '../contract/identity.js';
import { KanbanObservationBuffer } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { KanbanSessionCoordinator } from '../source/session-coordinator.js';
import type {
  KanbanBoardCounts,
  KanbanCardLocation,
  KanbanCellAddress,
  KanbanColumnMeta,
  KanbanDataSource,
  KanbanQuery,
  KanbanSourceState,
  KanbanSwimlaneMeta,
} from '../index.js';
import type { KanbanRevision } from '../contract/revision.js';

/** Detached black-box snapshot of one active query session. */
export interface KanbanQueryInspection {
  /** Active detached semantic query. */
  readonly query: KanbanQuery;
  /** Equality-only revision of the active session. */
  readonly sessionRevision: KanbanRevision;
  /** Validated board-wide source state. */
  readonly state: KanbanSourceState;
  /** Validated honest board-wide counts. */
  readonly counts: KanbanBoardCounts;
  /** Ordered validated workflow columns. */
  readonly columns: readonly KanbanColumnMeta[];
  /** Ordered validated semantic swimlanes. */
  readonly swimlanes: readonly KanbanSwimlaneMeta[];
}

/** Public black-box query lifecycle harness. */
export interface KanbanQueryLifecycleHarness {
  /** Replaces the semantic query and synchronously owns the new session. */
  replaceQuery(query: KanbanQuery): void;
  /** Returns one detached active-session inspection. */
  snapshot(): KanbanQueryInspection;
  /** Performs one bounded lookup through the active session. */
  locateCard(key: CardKey, options?: { readonly signal?: AbortSignal }): Promise<KanbanCardLocation>;
  /** Returns bounded already-redacted observations. */
  observations(): readonly KanbanObservation[];
  /** Invalidates and disposes the harness idempotently. */
  dispose(): void;
}

/** Options for a testing-only query lifecycle harness. */
export interface KanbanQueryLifecycleHarnessOptions<TCard> {
  /** Ordinary public source fake or application adapter under test. */
  readonly source: KanbanDataSource<TCard>;
  /** Initial semantic query. */
  readonly initialQuery: KanbanQuery;
  /** Optional lower bounded observation capacity. */
  readonly observationCapacity?: number;
  /** Reserved bounded addresses for future card-key inspection. */
  readonly inspectedAddresses?: readonly KanbanCellAddress[];
}

/**
 * Creates a black-box query lifecycle harness without exposing generation internals.
 *
 * @example
 * ```ts
 * const harness = createKanbanQueryLifecycleHarness({ source, initialQuery: {} });
 * const state = harness.snapshot().state;
 * ```
 */
export function createKanbanQueryLifecycleHarness<TCard>(
  options: KanbanQueryLifecycleHarnessOptions<TCard>,
): KanbanQueryLifecycleHarness {
  const capacity = options.observationCapacity ?? KANBAN_LIMITS.retainedObservations.safe;
  const observations = new KanbanObservationBuffer(capacity);
  const coordinator = new KanbanSessionCoordinator({
    source: options.source,
    initialQuery: options.initialQuery,
    observe: (observation) => observations.push(observation),
  });
  let disposed = false;

  return Object.freeze({
    replaceQuery(query: KanbanQuery): void {
      coordinator.replaceQuery(query);
    },
    snapshot(): KanbanQueryInspection {
      const publication = coordinator.snapshot();
      return Object.freeze({
        query: coordinator.query(),
        sessionRevision: publication.revision,
        state: publication.state,
        counts: publication.counts,
        columns: publication.columns,
        swimlanes: publication.swimlanes,
      });
    },
    locateCard(key: CardKey, locateOptions?: { readonly signal?: AbortSignal }): Promise<KanbanCardLocation> {
      return coordinator.locateCard(key, locateOptions);
    },
    observations: () => observations.values(),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      coordinator.dispose();
    },
  });
}
