import { createKanbanObservation } from '../contract/observation.js';
import { KanbanInvalidLimitError } from '../contract/limits.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanBoardId } from '../contract/identity.js';
import { snapshotKanbanEventInput } from './validation.js';
import type {
  KanbanEvent,
  KanbanEventHub,
  KanbanEventHubOptions,
  KanbanEventPublishOutcome,
  KanbanEventSubscriber,
} from './types.js';

/** Default nested event capacity for one synchronous drain cycle. */
const DEFAULT_EVENT_CAPACITY = 256;
/** Hard event queue and retention ceiling. */
const MAX_EVENT_CAPACITY = 4_096;
/** Maximum event subscribers retained by one board. */
const MAX_EVENT_SUBSCRIBERS = 256;
/** Shared immutable successful publication outcome. */
const PUBLISHED: KanbanEventPublishOutcome = Object.freeze({ kind: 'published' });
/** Shared immutable queue-overflow outcome. */
const QUEUE_OVERFLOW: KanbanEventPublishOutcome = Object.freeze({ kind: 'event-queue-overflow' });
/** Shared immutable disposed-hub outcome. */
const DISPOSED: KanbanEventPublishOutcome = Object.freeze({ kind: 'disposed' });

/** Validates one positive bounded event queue capacity. */
function queueCapacity(value: number | undefined): number {
  const capacity = value ?? DEFAULT_EVENT_CAPACITY;
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_EVENT_CAPACITY) {
    throw new KanbanInvalidLimitError();
  }
  return capacity;
}

/** Validates one non-negative bounded retained-event capacity. */
function retainedCapacity(value: number | undefined): number {
  const retained = value ?? 0;
  if (!Number.isSafeInteger(retained) || retained < 0 || retained > MAX_EVENT_CAPACITY) {
    throw new KanbanInvalidLimitError();
  }
  return retained;
}

/** Reads an injected clock without exposing callback failures or invalid numbers. */
function readClock(now: () => number): number {
  try {
    const timestamp = now();
    return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : 0;
  } catch {
    return 0;
  }
}

/** Calls one diagnostic sink without allowing diagnostics to alter event delivery. */
function observe(options: KanbanEventHubOptions, code: string): void {
  if (options.observe === undefined) return;
  try {
    options.observe(createKanbanObservation({ code, scope: 'board' }));
  } catch {
    // Diagnostics are deliberately one-way and never control event behavior.
  }
}

/**
 * Creates one board-scoped bounded semantic event stream.
 *
 * Nested publication is queued breadth-first. Sequence and timestamp allocate only when an event
 * leaves the queue, so subscriber reentrancy cannot reorder already-observable events.
 *
 * @example
 * ```ts
 * const events = createKanbanEventHub({ boardId: 'product-board' });
 * const unsubscribe = events.subscribe((event) => audit(event));
 * events.publish({ kind: 'selection', count: 2 });
 * unsubscribe();
 * ```
 */
export function createKanbanEventHub(options: KanbanEventHubOptions): KanbanEventHub {
  const boardId = createKanbanBoardId(options.boardId);
  const capacity = queueCapacity(options.capacity);
  const retainedLimit = retainedCapacity(options.retained);
  const now = options.now ?? Date.now;
  const queue: ReturnType<typeof snapshotKanbanEventInput>[] = [];
  const retained: KanbanEvent[] = [];
  const subscribers = new Set<KanbanEventSubscriber>();
  let sequence = 0;
  let draining = false;
  let overflowObserved = false;
  let isDisposed = false;

  /** Delivers queued events until empty or disposal interrupts the drain. */
  const drain = (): void => {
    if (draining || isDisposed) return;
    draining = true;
    overflowObserved = false;
    try {
      while (!isDisposed && queue.length > 0) {
        const input = queue.shift();
        if (input === undefined) continue;
        if (sequence === Number.MAX_SAFE_INTEGER) {
          queue.length = 0;
          if (!overflowObserved) {
            overflowObserved = true;
            observe(options, 'event-sequence-exhausted');
          }
          break;
        }
        sequence += 1;
        const event: KanbanEvent = Object.freeze({
          ...input,
          sequence,
          timestamp: readClock(now),
          boardId,
        });
        if (retainedLimit > 0) {
          retained.push(event);
          while (retained.length > retainedLimit) retained.shift();
        }
        for (const subscriber of [...subscribers]) {
          if (isDisposed) break;
          try {
            subscriber(event);
          } catch {
            observe(options, 'event-subscriber-failed');
          }
        }
      }
    } finally {
      draining = false;
      overflowObserved = false;
    }
  };

  const hub: KanbanEventHub = {
    publish: (value) => {
      if (isDisposed) return DISPOSED;
      const input = snapshotKanbanEventInput(value);
      if (queue.length >= capacity) {
        if (!overflowObserved) {
          overflowObserved = true;
          observe(options, 'event-queue-overflow');
        }
        return QUEUE_OVERFLOW;
      }
      queue.push(input);
      drain();
      return PUBLISHED;
    },
    subscribe: (subscriber) => {
      if (isDisposed || typeof subscriber !== 'function' || subscribers.size >= MAX_EVENT_SUBSCRIBERS) {
        throw new KanbanInvalidSemanticValueError();
      }
      subscribers.add(subscriber);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        subscribers.delete(subscriber);
      };
    },
    snapshot: () => Object.freeze([...retained]),
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      queue.length = 0;
      retained.length = 0;
      subscribers.clear();
    },
    disposed: () => isDisposed,
  };
  return Object.freeze(hub);
}
