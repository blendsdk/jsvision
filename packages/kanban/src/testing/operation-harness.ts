import type { KanbanOperationId } from '../contract/identity.js';
import type { KanbanRequest, KanbanRequestDispatcher, KanbanRequestResult } from '../contract/request.js';
import type { KanbanOperationSnapshot } from '../operation/types.js';
import { createKanbanDeferred } from './instrumentation.js';

/** Payload-free record of one dispatcher invocation. */
export interface KanbanDispatcherHarnessCall {
  /** Coordinator-owned operation identity. */
  readonly operationId: KanbanOperationId;
  /** Closed standard or extension request discriminator. */
  readonly kind: KanbanRequest['kind'];
  /** Whether the operation signal was already aborted at invocation. */
  readonly aborted: boolean;
}

/** Deterministic dispatcher with explicit FIFO settlement and bounded call evidence. */
export interface KanbanDispatcherHarness {
  /** Dispatcher passed to a real board. */
  readonly dispatcher: KanbanRequestDispatcher;
  /** Returns detached payload-free calls in admission order. */
  calls(): readonly KanbanDispatcherHarnessCall[];
  /** Resolves the oldest unsettled dispatcher call. */
  settleNext(result: KanbanRequestResult): boolean;
  /** Rejects and clears every unsettled call. */
  dispose(): void;
}

/**
 * Creates a bounded application-dispatch harness with caller-controlled settlement.
 *
 * @example
 * ```ts
 * const harness = createKanbanDispatcherHarness();
 * const board = new KanbanBoard({ source, query, card, dispatcher: harness.dispatcher });
 * ```
 */
export function createKanbanDispatcherHarness(maximumCalls = 512): KanbanDispatcherHarness {
  if (!Number.isSafeInteger(maximumCalls) || maximumCalls < 1 || maximumCalls > 8_192) {
    throw new RangeError('Invalid Kanban dispatcher-harness limit.');
  }
  const calls: KanbanDispatcherHarnessCall[] = [];
  const pending: ReturnType<typeof createKanbanDeferred<KanbanRequestResult>>[] = [];
  let disposed = false;
  const dispatcher: KanbanRequestDispatcher = (request) => {
    if (disposed || calls.length >= maximumCalls) {
      return Object.freeze({
        kind: 'rejected',
        operationId: request.operationId,
        code: 'dispatcher-unavailable',
      });
    }
    calls.push(
      Object.freeze({ operationId: request.operationId, kind: request.kind, aborted: request.signal.aborted }),
    );
    const deferred = createKanbanDeferred<KanbanRequestResult>();
    pending.push(deferred);
    return deferred.promise;
  };
  return Object.freeze({
    dispatcher,
    calls: () => Object.freeze([...calls]),
    settleNext: (result: KanbanRequestResult) => {
      const deferred = pending.shift();
      if (deferred === undefined) return false;
      deferred.resolve(result);
      return true;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const deferred of pending.splice(0)) deferred.reject(new Error('Kanban dispatcher harness disposed.'));
    },
  });
}

/** Payload-free lifecycle record retained by the operation harness. */
export interface KanbanOperationLifecycleRecord {
  /** Stable operation identity. */
  readonly operationId: KanbanOperationId;
  /** Observed lifecycle state. */
  readonly state: KanbanOperationSnapshot['state'];
  /** Number of affected semantic subjects. */
  readonly affectedCount: number;
}

/** Bounded lifecycle collector that never retains request payloads or application errors. */
export interface KanbanOperationLifecycleHarness {
  /** Accepts one already-sanitized operation snapshot. */
  accept(snapshot: KanbanOperationSnapshot): void;
  /** Returns detached records in observation order. */
  records(): readonly KanbanOperationLifecycleRecord[];
  /** Returns scalar retained-identity and concurrency evidence without operation payloads. */
  metrics(): KanbanOperationLifecycleMetrics;
  /** Clears retained evidence and rejects later observations. */
  dispose(): void;
}

/** Bounded scalar evidence for lifecycle retention and concurrent operation pressure. */
export interface KanbanOperationLifecycleMetrics {
  /** Number of distinct operation identities retained in the bounded record set. */
  readonly retainedOperationIds: number;
  /** Number of operations whose latest observed state is currently non-terminal. */
  readonly concurrentOperations: number;
  /** Largest number of concurrently non-terminal operations observed. */
  readonly maximumConcurrentOperations: number;
  /** Total lifecycle records accepted by the harness. */
  readonly retainedRecords: number;
}

/** Returns whether one lifecycle state can still transition or be cancelled. */
function operationIsActive(state: KanbanOperationSnapshot['state']): boolean {
  return state === 'proposed' || state === 'pending' || state === 'accepted';
}

/**
 * Creates a payload-free operation lifecycle recorder.
 *
 * @example
 * ```ts
 * const lifecycle = createKanbanOperationLifecycleHarness();
 * const unsubscribe = board.subscribeOperations((snapshot) => lifecycle.accept(snapshot));
 * ```
 */
export function createKanbanOperationLifecycleHarness(maximumRecords = 2_048): KanbanOperationLifecycleHarness {
  if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 1 || maximumRecords > 8_192) {
    throw new RangeError('Invalid Kanban lifecycle-harness limit.');
  }
  const records: KanbanOperationLifecycleRecord[] = [];
  const latestStates = new Map<KanbanOperationId, KanbanOperationSnapshot['state']>();
  let maximumConcurrentOperations = 0;
  let disposed = false;
  return Object.freeze({
    accept: (snapshot: KanbanOperationSnapshot) => {
      if (disposed || records.length >= maximumRecords) return;
      records.push(
        Object.freeze({
          operationId: snapshot.operationId,
          state: snapshot.state,
          affectedCount: snapshot.affected.length,
        }),
      );
      latestStates.set(snapshot.operationId, snapshot.state);
      const concurrentOperations = [...latestStates.values()].filter(operationIsActive).length;
      maximumConcurrentOperations = Math.max(maximumConcurrentOperations, concurrentOperations);
    },
    records: () => Object.freeze([...records]),
    metrics: () =>
      Object.freeze({
        retainedOperationIds: latestStates.size,
        concurrentOperations: [...latestStates.values()].filter(operationIsActive).length,
        maximumConcurrentOperations,
        retainedRecords: records.length,
      }),
    dispose: () => {
      disposed = true;
      records.length = 0;
      latestStates.clear();
      maximumConcurrentOperations = 0;
    },
  });
}
