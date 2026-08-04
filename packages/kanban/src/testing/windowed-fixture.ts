import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanBoardCounts, KanbanCellCounts, KanbanCount } from '../source/counts.js';
import { snapshotKanbanRange } from '../source/range-set.js';
import type { KanbanCellState, KanbanKnownLength, KanbanSourceState } from '../source/states.js';
import type {
  KanbanCellAddress,
  KanbanCellCursor,
  KanbanCardLocation,
  KanbanColumnMeta,
  KanbanDataSource,
  KanbanHeaderBatch,
  KanbanIdentityChangeBatch,
  KanbanPlacement,
  KanbanQuery,
  KanbanQuerySession,
  KanbanSessionPublication,
  KanbanSwimlaneMeta,
} from '../source/types.js';
import {
  snapshotKanbanColumnMeta,
  snapshotKanbanQuery,
  snapshotKanbanSessionPublication,
  snapshotKanbanSwimlaneMeta,
} from '../source/validation.js';
import { createKanbanDeferred, KanbanTestingEventRing } from './instrumentation.js';
import type { KanbanDeferred } from './instrumentation.js';

/** Safe pending half-open range exposed to deterministic fixture controllers. */
export interface KanbanPendingRange {
  readonly requestId: number;
  readonly sessionId: number;
  readonly cursorId: number;
  readonly address: KanbanCellAddress;
  readonly start: number;
  readonly end: number;
  readonly sessionRevision: KanbanRevision;
  readonly cursorRevision: KanbanRevision;
}

/** Safe requested range retained by fixture metrics. */
export interface KanbanMetricRange {
  readonly address: KanbanCellAddress;
  readonly start: number;
  readonly end: number;
}

/** Allowlisted payload-free event emitted by a windowed fixture. */
export interface KanbanWindowedFixtureEvent {
  readonly kind:
    | 'open-session'
    | 'create-cursor'
    | 'ensure-range'
    | 'resolve-range'
    | 'reject-range'
    | 'abort-range'
    | 'publish'
    | 'dispose-cursor'
    | 'dispose-session';
  readonly sessionId?: number;
  readonly cursorId?: number;
  readonly requestId?: number;
  readonly address?: KanbanCellAddress;
  readonly start?: number;
  readonly end?: number;
  readonly revision?: KanbanRevision;
  readonly code?: string;
}

/** Frozen request-proportional metrics from a deterministic windowed fixture. */
export interface KanbanWindowedFixtureMetrics {
  readonly logicalCardCount: number;
  readonly openedSessions: number;
  readonly disposedSessions: number;
  readonly createdCursors: number;
  readonly disposedCursors: number;
  readonly ensureRangeCalls: number;
  readonly requestedRanges: readonly KanbanMetricRange[];
  readonly materializedCards: number;
  readonly cardAtReads: number;
  readonly abortedRequests: number;
  readonly suppressedLateSettlements: number;
  readonly publications: number;
  readonly retainedEvents: readonly KanbanWindowedFixtureEvent[];
}

/** Deterministic settlement controller for one windowed fixture. */
export interface KanbanWindowedFixtureController {
  pendingRanges(): readonly KanbanPendingRange[];
  resolveRange(requestId: number): void;
  rejectRange(requestId: number, error: { readonly code: string; readonly label?: string }): void;
  publishSession(publication: KanbanSessionPublication): void;
}

/** Public source, settlement control, and safe metrics for one lazy fixture. */
export interface KanbanWindowedFixture<TCard> {
  readonly source: KanbanDataSource<TCard>;
  readonly controller: KanbanWindowedFixtureController;
  metrics(): KanbanWindowedFixtureMetrics;
  dispose(): void;
}

/** Construction options for a lazy deterministic logical-card fixture. */
export interface KanbanWindowedFixtureOptions<TCard> {
  readonly logicalCardCount: number;
  readonly columns: readonly KanbanColumnMeta[];
  readonly swimlanes?: readonly KanbanSwimlaneMeta[];
  readonly initialRevision?: KanbanRevision;
  readonly materialize: (request: {
    readonly address: KanbanCellAddress;
    readonly start: number;
    readonly end: number;
  }) => readonly TCard[];
  readonly keyOf: (card: TCard) => CardKey;
  readonly eventCapacity?: number;
}

/** Mutable counters held privately and copied by `metrics()`. */
interface MutableMetrics {
  openedSessions: number;
  disposedSessions: number;
  createdCursors: number;
  disposedCursors: number;
  ensureRangeCalls: number;
  requestedRanges: KanbanMetricRange[];
  materializedCards: number;
  cardAtReads: number;
  abortedRequests: number;
  suppressedLateSettlements: number;
  publications: number;
}

/** Internal request couples safe metadata to its owning cursor and deferred settlement. */
interface InternalRange<TCard> extends KanbanPendingRange {
  readonly cursor: WindowedCursor<TCard>;
  readonly deferred: KanbanDeferred<void>;
  readonly removeAbort: () => void;
}

/** Creates one exact count. */
function exact(value: number): KanbanCount {
  return Object.freeze({ quality: 'exact', value });
}

/** Creates an explicit unknown count. */
function unknown(): KanbanCount {
  return Object.freeze({ quality: 'unknown' });
}

/** Shared fixture state with no collection sized by logical card count. */
class WindowedFixtureState<TCard> {
  readonly options: KanbanWindowedFixtureOptions<TCard>;
  readonly columns: readonly KanbanColumnMeta[];
  readonly swimlanes: readonly KanbanSwimlaneMeta[];
  readonly events: KanbanTestingEventRing<KanbanWindowedFixtureEvent>;
  readonly metrics: MutableMetrics = {
    openedSessions: 0,
    disposedSessions: 0,
    createdCursors: 0,
    disposedCursors: 0,
    ensureRangeCalls: 0,
    requestedRanges: [],
    materializedCards: 0,
    cardAtReads: 0,
    abortedRequests: 0,
    suppressedLateSettlements: 0,
    publications: 0,
  };
  readonly pending = new Map<number, InternalRange<TCard>>();
  readonly sessions = new Set<WindowedSession<TCard>>();
  publication: KanbanSessionPublication | undefined;
  revision: KanbanRevision;
  nextSessionId = 1;
  nextCursorId = 1;
  nextRequestId = 1;
  disposed = false;

  /** Validates bounded structural metadata without materializing logical cards. */
  constructor(options: KanbanWindowedFixtureOptions<TCard>) {
    if (!Number.isSafeInteger(options.logicalCardCount) || options.logicalCardCount < 0) {
      throw new KanbanInvalidSourcePublicationError();
    }
    if (options.columns.length > KANBAN_LIMITS.columns.absolute) throw new KanbanInvalidSourcePublicationError();
    if ((options.swimlanes?.length ?? 0) > KANBAN_LIMITS.swimlanes.absolute) {
      throw new KanbanInvalidSourcePublicationError();
    }
    this.options = options;
    this.columns = Object.freeze(options.columns.map(snapshotKanbanColumnMeta));
    this.swimlanes = Object.freeze((options.swimlanes ?? []).map(snapshotKanbanSwimlaneMeta));
    this.revision = options.initialRevision ?? 0;
    this.events = new KanbanTestingEventRing(options.eventCapacity ?? 64);
  }

  /** Records a frozen safe event. */
  event(event: KanbanWindowedFixtureEvent): void {
    this.events.push(Object.freeze(event));
  }

  /** Resolves one recorded range and atomically validates all returned cards. */
  resolve(requestId: number): void {
    const request = this.pending.get(requestId);
    if (request === undefined) throw new KanbanInvalidSourcePublicationError();
    this.pending.delete(requestId);
    request.removeAbort();
    let cards: readonly TCard[];
    try {
      cards = this.options.materialize({ address: request.address, start: request.start, end: request.end });
      if (!Array.isArray(cards) || cards.length !== request.end - request.start) {
        throw new KanbanInvalidSourcePublicationError();
      }
      const keys = new Set<CardKey>();
      for (const card of cards) {
        const key = this.options.keyOf(card);
        if ((typeof key !== 'string' && typeof key !== 'number') || keys.has(key)) {
          throw new KanbanInvalidSourcePublicationError();
        }
        keys.add(key);
      }
      request.cursor.publish(request.start, cards);
      this.metrics.materializedCards += cards.length;
      this.event({
        kind: 'resolve-range',
        requestId,
        sessionId: request.sessionId,
        cursorId: request.cursorId,
        address: request.address,
        start: request.start,
        end: request.end,
      });
      request.deferred.resolve();
    } catch {
      request.cursor.fail('invalid-materialization');
      request.deferred.reject(new KanbanInvalidSourcePublicationError());
    }
  }

  /** Rejects one recorded range with a safe code and no raw error retention. */
  reject(requestId: number, code: string): void {
    const request = this.pending.get(requestId);
    if (request === undefined) throw new KanbanInvalidSourcePublicationError();
    this.pending.delete(requestId);
    request.removeAbort();
    request.cursor.fail(code);
    this.event({ kind: 'reject-range', requestId, code, sessionId: request.sessionId, cursorId: request.cursorId });
    request.deferred.reject(new KanbanInvalidSourcePublicationError());
  }
}

/** Sparse cursor that materializes only controller-resolved ranges. */
class WindowedCursor<TCard> implements KanbanCellCursor<TCard> {
  readonly #state: WindowedFixtureState<TCard>;
  readonly #sessionId: number;
  readonly #cursorId: number;
  readonly #address: KanbanCellAddress;
  readonly #cards = new Map<number, TCard>();
  #revision = 0;
  #errorCode: string | undefined;
  #disposed = false;

  constructor(state: WindowedFixtureState<TCard>, sessionId: number, cursorId: number, address: KanbanCellAddress) {
    this.#state = state;
    this.#sessionId = sessionId;
    this.#cursorId = cursorId;
    this.#address = address;
  }

  state(): KanbanCellState {
    this.#active();
    if (this.#errorCode !== undefined) {
      return Object.freeze({ kind: 'error', code: this.#errorCode, retry: 'available' });
    }
    return Object.freeze({ kind: this.#cards.size === 0 ? 'partial' : 'ready' });
  }

  counts(): KanbanCellCounts {
    this.#active();
    return Object.freeze({ total: unknown(), matching: unknown(), loaded: exact(this.#cards.size) });
  }

  length(): KanbanKnownLength {
    this.#active();
    return Object.freeze({ kind: 'unknown' });
  }

  cardAt(index: number): TCard | undefined {
    this.#active();
    this.#state.metrics.cardAtReads += 1;
    return this.#cards.get(index);
  }

  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void> {
    this.#active();
    const range = snapshotKanbanRange(start, end, KANBAN_LIMITS.ensureRangeCards.absolute);
    if (range.start === range.end) return Promise.resolve();
    const deferred = createKanbanDeferred<void>();
    const requestId = this.#state.nextRequestId++;
    const abort = (): void => {
      const request = this.#state.pending.get(requestId);
      if (request === undefined) return;
      this.#state.pending.delete(requestId);
      this.#state.metrics.abortedRequests += 1;
      this.#state.event({ kind: 'abort-range', requestId, sessionId: this.#sessionId, cursorId: this.#cursorId });
      deferred.reject(new DOMException('The windowed fixture range was aborted.', 'AbortError'));
    };
    options?.signal?.addEventListener('abort', abort, { once: true });
    const pending: InternalRange<TCard> = Object.freeze({
      requestId,
      sessionId: this.#sessionId,
      cursorId: this.#cursorId,
      address: this.#address,
      start: range.start,
      end: range.end,
      sessionRevision: this.#state.revision,
      cursorRevision: this.revision(),
      cursor: this,
      deferred,
      removeAbort: () => options?.signal?.removeEventListener('abort', abort),
    });
    this.#state.pending.set(requestId, pending);
    this.#state.metrics.ensureRangeCalls += 1;
    this.#state.metrics.requestedRanges.push(
      Object.freeze({ address: this.#address, start: range.start, end: range.end }),
    );
    this.#state.event({
      kind: 'ensure-range',
      requestId,
      sessionId: this.#sessionId,
      cursorId: this.#cursorId,
      address: this.#address,
      start: range.start,
      end: range.end,
    });
    if (options?.signal?.aborted === true) abort();
    return deferred.promise;
  }

  revision(): KanbanRevision {
    this.#active();
    return `${String(this.#state.revision)}:cursor-${this.#cursorId}:${this.#revision}`;
  }

  placementAt(slot: number): KanbanPlacement {
    this.#active();
    const cursorRevision = this.revision();
    const before = this.#cards.get(slot - 1);
    const after = this.#cards.get(slot);
    if (before !== undefined || after !== undefined) {
      const neighbor = before ?? after;
      if (neighbor === undefined) throw new KanbanInvalidSourcePublicationError();
      return Object.freeze({
        kind: 'window-edge',
        edge: before === undefined ? 'before' : 'after',
        neighborCardKey: this.#state.options.keyOf(neighbor),
        cursorRevision,
      });
    }
    return Object.freeze({ kind: 'unavailable', code: 'not-loaded', cursorRevision });
  }

  retry(): void {
    this.#active();
    this.#errorCode = undefined;
    this.#revision += 1;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const request of [...this.#state.pending.values()]) {
      if (request.cursorId !== this.#cursorId) continue;
      this.#state.pending.delete(request.requestId);
      request.removeAbort();
      this.#state.metrics.abortedRequests += 1;
      request.deferred.reject(new KanbanDisposedResourceError());
    }
    this.#cards.clear();
    this.#state.metrics.disposedCursors += 1;
    this.#state.event({ kind: 'dispose-cursor', sessionId: this.#sessionId, cursorId: this.#cursorId });
  }

  publish(start: number, cards: readonly TCard[]): void {
    if (this.#disposed) {
      this.#state.metrics.suppressedLateSettlements += 1;
      return;
    }
    for (const [offset, card] of cards.entries()) this.#cards.set(start + offset, card);
    this.#errorCode = undefined;
    this.#revision += 1;
  }

  fail(code: string): void {
    if (this.#disposed) {
      this.#state.metrics.suppressedLateSettlements += 1;
      return;
    }
    this.#errorCode = /^[a-z][a-z0-9-]*$/u.test(code) ? code : 'range-failed';
    this.#revision += 1;
  }

  #active(): void {
    if (this.#disposed || this.#state.disposed) throw new KanbanDisposedResourceError();
  }
}

/** One independently disposable query session with on-demand cursor creation. */
class WindowedSession<TCard> implements KanbanQuerySession<TCard> {
  readonly #state: WindowedFixtureState<TCard>;
  readonly #sessionId: number;
  readonly #cursors = new Map<string, WindowedCursor<TCard>>();
  #disposed = false;

  constructor(state: WindowedFixtureState<TCard>, sessionId: number) {
    this.#state = state;
    this.#sessionId = sessionId;
  }

  state(): KanbanSourceState {
    return this.#publication()?.state ?? Object.freeze({ kind: 'partial' });
  }
  revision(): KanbanRevision {
    this.#active();
    return this.#publication()?.revision ?? this.#state.revision;
  }
  columns(): readonly KanbanColumnMeta[] {
    return this.#publication()?.columns ?? this.#state.columns;
  }
  swimlanes(): readonly KanbanSwimlaneMeta[] {
    return this.#publication()?.swimlanes ?? this.#state.swimlanes;
  }
  counts(): KanbanBoardCounts {
    return (
      this.#publication()?.counts ??
      Object.freeze({
        total: exact(this.#state.options.logicalCardCount),
        matching: exact(this.#state.options.logicalCardCount),
        loaded: exact(this.#state.metrics.materializedCards),
        visible: unknown(),
        selected: unknown(),
        wip: unknown(),
      })
    );
  }
  headers(): KanbanHeaderBatch {
    const publication = this.#publication();
    if (publication !== undefined) return publication.headers;
    const revision = this.revision();
    return Object.freeze({
      revision,
      columns: Object.freeze(
        this.#state.columns.map((column) => Object.freeze({ columnId: column.columnId, label: column.label })),
      ),
      swimlanes: Object.freeze(
        this.#state.swimlanes.map((swimlane) =>
          Object.freeze({ swimlaneId: swimlane.swimlaneId, label: swimlane.label }),
        ),
      ),
    });
  }
  identityChanges(): KanbanIdentityChangeBatch {
    return (
      this.#publication()?.identityChanges ?? Object.freeze({ revision: this.revision(), changes: Object.freeze([]) })
    );
  }
  cell(address: KanbanCellAddress): KanbanCellCursor<TCard> {
    this.#active();
    const snapshot = snapshotKanbanCellAddress(address);
    if (!this.#state.columns.some((column) => column.columnId === snapshot.columnId)) {
      throw new KanbanInvalidSourcePublicationError();
    }
    if (
      snapshot.swimlaneId !== undefined &&
      !this.#state.swimlanes.some((swimlane) => swimlane.swimlaneId === snapshot.swimlaneId)
    ) {
      throw new KanbanInvalidSourcePublicationError();
    }
    const key = canonicalizeKanbanCellAddress(snapshot);
    const existing = this.#cursors.get(key);
    if (existing !== undefined) return existing;
    const cursorId = this.#state.nextCursorId++;
    const cursor = new WindowedCursor(this.#state, this.#sessionId, cursorId, snapshot);
    this.#cursors.set(key, cursor);
    this.#state.metrics.createdCursors += 1;
    this.#state.event({ kind: 'create-cursor', sessionId: this.#sessionId, cursorId, address: snapshot });
    return cursor;
  }
  locateCard(): KanbanCardLocation {
    return Object.freeze({ kind: 'unsupported', sessionRevision: this.revision() });
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const cursor of this.#cursors.values()) cursor.dispose();
    this.#cursors.clear();
    this.#state.sessions.delete(this);
    this.#state.metrics.disposedSessions += 1;
    this.#state.event({ kind: 'dispose-session', sessionId: this.#sessionId });
  }
  #publication(): KanbanSessionPublication | undefined {
    this.#active();
    return this.#state.publication;
  }
  #active(): void {
    if (this.#disposed || this.#state.disposed) throw new KanbanDisposedResourceError();
  }
}

/**
 * Creates a lazy 100,000-logical-card-capable source with explicit deterministic settlement.
 *
 * @example
 * ```ts
 * const fixture = createWindowedKanbanFixture({
 *   logicalCardCount: 100_000,
 *   columns,
 *   materialize: ({ start, end }) => makeCards(start, end),
 *   keyOf: (card) => card.id,
 * });
 * ```
 */
export function createWindowedKanbanFixture<TCard>(
  options: KanbanWindowedFixtureOptions<TCard>,
): KanbanWindowedFixture<TCard> {
  const state = new WindowedFixtureState(options);
  const source: KanbanDataSource<TCard> = Object.freeze({
    openQuery(query: KanbanQuery): KanbanQuerySession<TCard> {
      if (state.disposed) throw new KanbanDisposedResourceError();
      snapshotKanbanQuery(query);
      const sessionId = state.nextSessionId++;
      const session = new WindowedSession(state, sessionId);
      state.sessions.add(session);
      state.metrics.openedSessions += 1;
      state.event({ kind: 'open-session', sessionId, revision: state.revision });
      return session;
    },
  });
  let disposed = false;
  return Object.freeze({
    source,
    controller: Object.freeze({
      pendingRanges(): readonly KanbanPendingRange[] {
        return Object.freeze(
          [...state.pending.values()].map((request) =>
            Object.freeze({
              requestId: request.requestId,
              sessionId: request.sessionId,
              cursorId: request.cursorId,
              address: request.address,
              start: request.start,
              end: request.end,
              sessionRevision: request.sessionRevision,
              cursorRevision: request.cursorRevision,
            }),
          ),
        );
      },
      resolveRange: (requestId: number) => state.resolve(requestId),
      rejectRange(requestId: number, error: { readonly code: string; readonly label?: string }): void {
        state.reject(requestId, error.code);
      },
      publishSession(publication: KanbanSessionPublication): void {
        state.publication = snapshotKanbanSessionPublication(publication);
        state.revision = state.publication.revision;
        state.metrics.publications += 1;
        state.event({ kind: 'publish', revision: state.revision });
      },
    }),
    metrics(): KanbanWindowedFixtureMetrics {
      return Object.freeze({
        logicalCardCount: options.logicalCardCount,
        openedSessions: state.metrics.openedSessions,
        disposedSessions: state.metrics.disposedSessions,
        createdCursors: state.metrics.createdCursors,
        disposedCursors: state.metrics.disposedCursors,
        ensureRangeCalls: state.metrics.ensureRangeCalls,
        requestedRanges: Object.freeze([...state.metrics.requestedRanges]),
        materializedCards: state.metrics.materializedCards,
        cardAtReads: state.metrics.cardAtReads,
        abortedRequests: state.metrics.abortedRequests,
        suppressedLateSettlements: state.metrics.suppressedLateSettlements,
        publications: state.metrics.publications,
        retainedEvents: state.events.values(),
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      state.disposed = true;
      for (const session of [...state.sessions]) session.dispose();
      state.pending.clear();
    },
  });
}
