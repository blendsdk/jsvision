import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { KanbanInvalidLimitError } from '../contract/limits.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanBoardId } from '../contract/identity.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
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
/** Exact construction members accepted at the event boundary. */
const HUB_OPTION_KEYS = new Set(['boardId', 'now', 'capacity', 'retained', 'observe']);
/** Exact native Promise method used to consume asynchronous callback rejection. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;

/** Validates one positive bounded event queue capacity. */
function queueCapacity(value: unknown): number {
  const capacity = value ?? DEFAULT_EVENT_CAPACITY;
  if (
    typeof capacity !== 'number' ||
    !Number.isSafeInteger(capacity) ||
    capacity < 1 ||
    capacity > MAX_EVENT_CAPACITY
  ) {
    throw new KanbanInvalidLimitError();
  }
  return capacity;
}

/** Validates one non-negative bounded retained-event capacity. */
function retainedCapacity(value: unknown): number {
  const retained = value ?? 0;
  if (
    typeof retained !== 'number' ||
    !Number.isSafeInteger(retained) ||
    retained < 0 ||
    retained > MAX_EVENT_CAPACITY
  ) {
    throw new KanbanInvalidLimitError();
  }
  return retained;
}

/** Reads an injected clock without exposing callback failures or invalid numbers. */
function readClock(now: () => unknown): number {
  try {
    const timestamp = now();
    return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : 0;
  } catch {
    return 0;
  }
}

/** Narrows the optional clock callback without invoking it. */
function isClock(value: unknown): value is () => unknown {
  return typeof value === 'function';
}

/** Narrows the optional observation sink without invoking it. */
function isObservationSink(value: unknown): value is (observation: KanbanObservation) => unknown {
  return typeof value === 'function';
}

/** Return true only for an unmodified same-realm native Promise. */
function isExactNativePromise(value: unknown): value is Promise<unknown> {
  try {
    return (
      value instanceof Promise &&
      Object.getPrototypeOf(value) === Promise.prototype &&
      Reflect.ownKeys(value).length === 0
    );
  } catch {
    return false;
  }
}

/** Invokes one application callback and consumes exact-native asynchronous rejection. */
function invokeIsolated<TValue>(callback: (value: TValue) => unknown, value: TValue, onFailure?: () => void): void {
  let result: unknown;
  try {
    result = Reflect.apply(callback, undefined, [value]);
  } catch {
    onFailure?.();
    return;
  }
  if (!isExactNativePromise(result)) return;
  try {
    NATIVE_PROMISE_THEN.call(result, undefined, () => onFailure?.());
  } catch {
    // Callback failure remains isolated even if Promise internals are unavailable.
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
  const properties = snapshotKanbanDataProperties(options, HUB_OPTION_KEYS.size);
  validateKanbanDataKeys(properties, HUB_OPTION_KEYS);
  if (typeof properties.boardId !== 'string') throw new KanbanInvalidSemanticValueError();
  if (properties.now !== undefined && !isClock(properties.now)) throw new KanbanInvalidSemanticValueError();
  if (properties.observe !== undefined && !isObservationSink(properties.observe)) {
    throw new KanbanInvalidSemanticValueError();
  }
  const boardId = createKanbanBoardId(properties.boardId);
  const capacity = queueCapacity(properties.capacity);
  const retainedLimit = retainedCapacity(properties.retained);
  const now = isClock(properties.now) ? properties.now : Date.now;
  const observer = isObservationSink(properties.observe) ? properties.observe : undefined;
  const queue: ReturnType<typeof snapshotKanbanEventInput>[] = [];
  const retained: KanbanEvent[] = [];
  const subscribers = new Set<KanbanEventSubscriber>();
  let sequence = 0;
  let draining = false;
  let overflowObserved = false;
  let nestedAdmissions = 0;
  let isDisposed = false;

  /** Emits one redacted diagnostic without exposing callback settlement. */
  const observe = (code: string): void => {
    if (observer === undefined) return;
    invokeIsolated(observer, createKanbanObservation({ code, scope: 'board' }));
  };

  /** Delivers queued events until empty or disposal interrupts the drain. */
  const drain = (): void => {
    if (draining || isDisposed) return;
    draining = true;
    overflowObserved = false;
    nestedAdmissions = 0;
    try {
      while (!isDisposed && queue.length > 0) {
        const input = queue.shift();
        if (input === undefined) continue;
        if (sequence === Number.MAX_SAFE_INTEGER) {
          queue.length = 0;
          if (!overflowObserved) {
            overflowObserved = true;
            observe('event-sequence-exhausted');
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
          invokeIsolated(subscriber, event, () => observe('event-subscriber-failed'));
        }
      }
    } finally {
      draining = false;
      overflowObserved = false;
      nestedAdmissions = 0;
    }
  };

  const hub: KanbanEventHub = {
    boardId,
    publish: (value) => {
      if (isDisposed) return DISPOSED;
      const input = snapshotKanbanEventInput(value);
      if (queue.length >= capacity || (draining && nestedAdmissions >= capacity)) {
        if (!overflowObserved) {
          overflowObserved = true;
          observe('event-queue-overflow');
        }
        return QUEUE_OVERFLOW;
      }
      if (draining) nestedAdmissions += 1;
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
