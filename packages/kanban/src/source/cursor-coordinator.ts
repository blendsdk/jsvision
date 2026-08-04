import {
  KanbanDisposedResourceError,
  KanbanInvalidRangeError,
  KanbanInvalidSourcePublicationError,
} from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanCellAddress } from './address.js';
import { snapshotKanbanCellCounts } from './counts.js';
import type { KanbanCellCounts } from './counts.js';
import { KanbanLoadScheduler } from './load-scheduler.js';
import { assertKanbanPlacementCurrent, snapshotKanbanPlacement } from './placement.js';
import { KanbanRangeSet, snapshotKanbanRange } from './range-set.js';
import type { KanbanRange } from './range-set.js';
import { snapshotKanbanCellState, snapshotKanbanKnownLength } from './states.js';
import type { KanbanCellState, KanbanKnownLength } from './states.js';
import type { KanbanCellAddress, KanbanCellCursor, KanbanPlacement } from './types.js';

/** One caller waiting for a normalized batch acquisition. */
interface RangeWaiter {
  readonly range: KanbanRange;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  readonly removeAbortListener: () => void;
  settled: boolean;
}

/** One bounded source acquisition shared by every overlapping waiter. */
interface ActiveAcquisition {
  readonly range: KanbanRange;
  readonly result: Promise<void>;
}

/** Construction options for the private cursor lifecycle coordinator. */
export interface KanbanCursorCoordinatorOptions<TCard> {
  /** Application cursor whose calls are guarded and coalesced. */
  readonly cursor: KanbanCellCursor<TCard>;
  /** Semantic cell used only for safe scoped observations. */
  readonly address: KanbanCellAddress;
  /** Stable identity adapter used by inspection consumers. */
  readonly keyOf: (card: TCard) => CardKey;
  /** Optional lower resource limits for this coordinator. */
  readonly limits?: KanbanLimitOptions;
  /** Optional already-redacted observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/**
 * Guards one sparse cursor with bounded range coalescing and stale-work suppression.
 *
 * The wrapper never enumerates a logical range. It validates source snapshots on demand, batches
 * same-turn acquisitions into disjoint intervals, and aborts owned work before cursor disposal.
 */
export class KanbanCursorCoordinator<TCard> {
  readonly #cursor: KanbanCellCursor<TCard>;
  readonly #address: KanbanCellAddress;
  readonly #keyOf: (card: TCard) => CardKey;
  readonly #observe: ((observation: KanbanObservation) => void) | undefined;
  readonly #maximumSpan: number;
  readonly #scheduler: KanbanLoadScheduler;
  readonly #completed = new KanbanRangeSet();
  readonly #activeAcquisitions = new Set<ActiveAcquisition>();
  #pending: RangeWaiter[] = [];
  #flushQueued = false;
  #generation = 0;
  #disposed = false;

  /** Creates a coordinator without invoking the application cursor. */
  constructor(options: KanbanCursorCoordinatorOptions<TCard>) {
    const limits = validateKanbanLimitOptions(options.limits);
    this.#cursor = options.cursor;
    this.#address = snapshotKanbanCellAddress(options.address);
    this.#keyOf = options.keyOf;
    this.#observe = options.observe;
    this.#maximumSpan = limits.ensureRangeCards;
    this.#scheduler = new KanbanLoadScheduler({
      concurrency: limits.concurrentCellLoads,
      queued: limits.pendingOperations,
    });
  }

  /** Returns a detached validated cursor lifecycle state. */
  state(): KanbanCellState {
    this.#assertActive();
    return snapshotKanbanCellState(this.#cursor.state());
  }

  /** Returns detached validated cursor counts. */
  counts(): KanbanCellCounts {
    this.#assertActive();
    return snapshotKanbanCellCounts(this.#cursor.counts());
  }

  /** Returns detached exact, lower-bound, or unknown logical length knowledge. */
  length(): KanbanKnownLength {
    this.#assertActive();
    return snapshotKanbanKnownLength(this.#cursor.length());
  }

  /** Returns the current equality-only cursor revision. */
  revision(): KanbanRevision {
    this.#assertActive();
    const revision = this.#cursor.revision();
    if (
      (typeof revision !== 'string' && typeof revision !== 'number') ||
      (typeof revision === 'number' && !Number.isFinite(revision)) ||
      (typeof revision === 'string' && revision.length === 0)
    ) {
      throw new KanbanInvalidSourcePublicationError();
    }
    return Object.is(revision, -0) ? 0 : revision;
  }

  /** Reads one resident application card without interpreting an unloaded `undefined` slot. */
  cardAt(index: number): TCard | undefined {
    this.#assertActive();
    if (!Number.isSafeInteger(index) || index < 0) throw new KanbanInvalidRangeError();
    return this.#cursor.cardAt(index);
  }

  /** Returns a safe stable key for one resident card, or `undefined` when the slot is unloaded. */
  cardKeyAt(index: number): CardKey | undefined {
    const card = this.cardAt(index);
    if (card === undefined) return undefined;
    try {
      return createKanbanCardKey(this.#keyOf(card));
    } catch {
      // The public source-publication error below deliberately discards callback details.
    }
    throw new KanbanInvalidSourcePublicationError();
  }

  /** Returns a validated placement that is current for the same cursor read. */
  placementAt(slot: number): KanbanPlacement {
    this.#assertActive();
    if (!Number.isSafeInteger(slot) || slot < 0) throw new KanbanInvalidRangeError();
    const placement = snapshotKanbanPlacement(this.#cursor.placementAt(slot));
    return assertKanbanPlacementCurrent(placement, this.revision());
  }

  /**
   * Acquires one bounded half-open range after same-turn normalization and overlap coalescing.
   */
  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void> {
    this.#assertActive();
    const range = snapshotKanbanRange(start, end, this.#maximumSpan);
    if (range.start === range.end || this.#completed.covers(range)) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const callerSignal = options?.signal;
      const abort = (): void => {
        if (waiter.settled) return;
        waiter.settled = true;
        reject(new DOMException('The Kanban source range was aborted.', 'AbortError'));
      };
      const waiter: RangeWaiter = {
        range,
        resolve,
        reject,
        removeAbortListener: () => callerSignal?.removeEventListener('abort', abort),
        settled: false,
      };
      if (callerSignal?.aborted === true) {
        abort();
        return;
      }
      callerSignal?.addEventListener('abort', abort, { once: true });
      this.#pending.push(waiter);
      this.#queueFlush();
    });
  }

  /** Runs one explicit scoped retry and converts application failures to bounded source errors. */
  async retry(): Promise<void> {
    this.#assertActive();
    const state = this.state();
    if (state.kind !== 'error' || state.retry !== 'available') throw new KanbanInvalidSourcePublicationError();
    const generation = this.#generation;
    try {
      await this.#scheduler.schedule(() => this.#cursor.retry());
      if (generation !== this.#generation) throw new KanbanDisposedResourceError();
    } catch (error) {
      if (error instanceof KanbanDisposedResourceError) throw error;
      this.#emit('cursor-retry-failed');
      throw new KanbanInvalidSourcePublicationError();
    }
  }

  /** Invalidates pending work, aborts acquisition, and disposes the application cursor once. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    const pending = this.#pending.splice(0);
    for (const waiter of pending) this.#settleWaiter(waiter, new KanbanDisposedResourceError());
    this.#scheduler.dispose();
    this.#completed.clear();
    this.#activeAcquisitions.clear();
    this.#cursor.dispose();
  }

  /** Schedules one microtask so synchronous overlapping requests share a normalized batch. */
  #queueFlush(): void {
    if (this.#flushQueued) return;
    this.#flushQueued = true;
    queueMicrotask(() => {
      this.#flushQueued = false;
      this.#flush();
    });
  }

  /** Normalizes pending requests and delegates each disjoint uncovered interval once. */
  #flush(): void {
    if (this.#disposed) return;
    const waiters = this.#pending.splice(0).filter((waiter) => !waiter.settled);
    if (waiters.length === 0) return;
    const covered = new KanbanRangeSet();
    covered.addAll(this.#completed.values());
    covered.addAll([...this.#activeAcquisitions].map((acquisition) => acquisition.range));
    const requested = new KanbanRangeSet();
    requested.addAll(waiters.flatMap((waiter) => covered.subtract(waiter.range)));
    const generation = this.#generation;
    for (const requestedRange of requested.values()) {
      for (let start = requestedRange.start; start < requestedRange.end; start += this.#maximumSpan) {
        const range = Object.freeze({ start, end: Math.min(start + this.#maximumSpan, requestedRange.end) });
        const acquisition: ActiveAcquisition = {
          range,
          result: this.#scheduler.schedule((signal) => this.#cursor.ensureRange(range.start, range.end, { signal })),
        };
        this.#activeAcquisitions.add(acquisition);
        void acquisition.result.then(
          () => {
            this.#activeAcquisitions.delete(acquisition);
            if (generation === this.#generation) this.#completed.add(acquisition.range);
          },
          () => {
            this.#activeAcquisitions.delete(acquisition);
            if (generation === this.#generation) this.#emit('cursor-range-failed');
          },
        );
      }
    }
    for (const waiter of waiters) {
      const acquisitions = [...this.#activeAcquisitions].filter(
        (acquisition) => waiter.range.start < acquisition.range.end && waiter.range.end > acquisition.range.start,
      );
      if (acquisitions.length === 0) {
        this.#settleWaiter(waiter);
        continue;
      }
      void Promise.all(acquisitions.map((acquisition) => acquisition.result)).then(
        () => {
          if (generation !== this.#generation) {
            this.#settleWaiter(waiter, new KanbanDisposedResourceError());
            return;
          }
          this.#settleWaiter(waiter);
        },
        () => {
          if (generation !== this.#generation) {
            this.#settleWaiter(waiter, new KanbanDisposedResourceError());
            return;
          }
          this.#settleWaiter(waiter, new KanbanInvalidSourcePublicationError());
        },
      );
    }
  }

  /** Settles one waiter at most once and releases its caller abort listener. */
  #settleWaiter(waiter: RangeWaiter, error?: Error): void {
    if (waiter.settled) return;
    waiter.settled = true;
    waiter.removeAbortListener();
    if (error === undefined) waiter.resolve();
    else waiter.reject(error);
  }

  /** Emits one safe cell-scoped observation and isolates a throwing application sink. */
  #emit(code: string): void {
    try {
      this.#observe?.(
        createKanbanObservation({
          code,
          scope: 'cell',
          columnId: this.#address.columnId,
          ...(this.#address.swimlaneId === undefined ? {} : { swimlaneId: this.#address.swimlaneId }),
        }),
      );
    } catch {
      // Diagnostic callbacks cannot interfere with cursor cleanup or source state.
    }
  }

  /** Rejects access after cursor-coordinator disposal. */
  #assertActive(): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
  }
}
