import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KanbanObservationBuffer } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { KanbanSessionCoordinator } from '../source/session-coordinator.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanCellCursor } from '../source/types.js';
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
  /** Bounded resident identities read only from explicitly configured inspection cells. */
  readonly inspectedCells: readonly KanbanQueryCellInspection[];
}

/** One bounded testing-only view of resident identities in an explicitly inspected cell. */
export interface KanbanQueryCellInspection {
  /** Detached collision-safe cell address. */
  readonly address: KanbanCellAddress;
  /** Resident keys among the first bounded inspection slots. */
  readonly cards: readonly { readonly index: number; readonly cardKey: CardKey }[];
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
  /** Optional bounded cells whose resident card keys appear in snapshots. */
  readonly inspectedAddresses?: readonly KanbanCellAddress[];
  /** Stable identity adapter required when inspected addresses are configured. */
  readonly keyOf?: (card: TCard) => CardKey;
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
  const addresses = Object.freeze((options.inspectedAddresses ?? []).map(snapshotKanbanCellAddress));
  const addressKeys = new Set(addresses.map(canonicalizeKanbanCellAddress));
  if (
    addresses.length > KANBAN_LIMITS.retainedCursors.safe ||
    addressKeys.size !== addresses.length ||
    (addresses.length > 0 && options.keyOf === undefined)
  ) {
    throw new RangeError('Kanban query inspection configuration exceeds its safe boundary.');
  }
  const coordinator = new KanbanSessionCoordinator({
    source: options.source,
    initialQuery: options.initialQuery,
    observe: (observation) => observations.push(observation),
  });
  let disposed = false;
  const inspectedCursors = new Map<string, KanbanCellCursor<TCard>>();

  /** Retains exactly the configured testing cells for the current query generation. */
  const retainInspectedCells = (): void => {
    inspectedCursors.clear();
    for (const address of addresses) {
      inspectedCursors.set(canonicalizeKanbanCellAddress(address), coordinator.retainCursor(address, 'prefetch'));
    }
  };

  /** Reads a bounded resident-key inspection without initiating source acquisition. */
  const inspectCells = (): readonly KanbanQueryCellInspection[] =>
    Object.freeze(
      addresses.map((address) => {
        const cursor = inspectedCursors.get(canonicalizeKanbanCellAddress(address));
        if (cursor === undefined || options.keyOf === undefined) {
          throw new Error('Kanban inspected cursor is unavailable.');
        }
        const cards: { readonly index: number; readonly cardKey: CardKey }[] = [];
        for (let index = 0; index < KANBAN_LIMITS.ensureRangeCards.safe; index += 1) {
          const card = cursor.cardAt(index);
          if (card !== undefined)
            cards.push(Object.freeze({ index, cardKey: createKanbanCardKey(options.keyOf(card)) }));
        }
        return Object.freeze({ address, cards: Object.freeze(cards) });
      }),
    );

  retainInspectedCells();

  return Object.freeze({
    replaceQuery(query: KanbanQuery): void {
      coordinator.replaceQuery(query);
      retainInspectedCells();
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
        inspectedCells: inspectCells(),
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
