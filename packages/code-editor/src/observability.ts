import { HARD_CODE_EDITOR_LIMITS } from './limits.js';

/** Aggregate event accepted by the optional observability boundary. */
export interface CodeEditorObservation {
  readonly kind: 'parse' | 'render' | 'lsp' | 'degradation' | 'truncation';
  readonly durationMs?: number;
  readonly discardedStaleResults?: number;
  readonly truncations?: number;
  readonly degradedTransitions?: number;
  /** Untrusted material is accepted only to make its deliberate exclusion explicit. */
  readonly untrustedContent?: unknown;
}

/** Content-free aggregate delivered through the host callback. */
export interface CodeEditorObservationEvent {
  readonly kind: CodeEditorObservation['kind'];
  readonly durationMs: number;
}

/** Immutable aggregate observability snapshot. */
export interface CodeEditorObservabilitySnapshot {
  readonly counters: Readonly<{
    discardedStaleResults: number;
    truncations: number;
    degradedTransitions: number;
    callbackFailures: number;
    droppedEvents: number;
    pendingDeliveries: number;
  }>;
  readonly retainedEvents: readonly CodeEditorObservationEvent[];
}

/** Options for an exception-safe asynchronous host observation callback. */
export interface CodeEditorObservabilityOptions {
  readonly callback?: (event: CodeEditorObservationEvent) => void | Promise<void>;
  readonly limits?: { readonly retainedEvents?: number };
  /** A test seam; production delivery still owns queueing, bounds, and failure containment. */
  readonly schedule?: (work: () => void) => void;
}

/** Bounded observability boundary owned by one editor. */
export interface CodeEditorObservabilityChannel {
  record(observation: CodeEditorObservation): void;
  snapshot(): CodeEditorObservabilitySnapshot;
  whenIdle(): Promise<void>;
  dispose(): void;
}

const MAX_PENDING_DELIVERIES = 64;
const CALLBACK_DEADLINE_MS = 100;

/**
 * Creates a content-free observability channel with one bounded callback drain.
 *
 * @example
 * ```ts
 * const observations = createObservabilityChannel();
 * observations.record({ kind: 'render', durationMs: 2 });
 * ```
 */
export function createObservabilityChannel(
  optionsInput: CodeEditorObservabilityOptions = {},
): CodeEditorObservabilityChannel {
  const callbackValue = safeOwnData(optionsInput, 'callback');
  const callback =
    typeof callbackValue === 'function'
      ? (callbackValue as (event: CodeEditorObservationEvent) => void | Promise<void>)
      : undefined;
  const scheduleValue = safeOwnData(optionsInput, 'schedule');
  const schedule = typeof scheduleValue === 'function' ? scheduleValue : queueMicrotask;
  const limitsValue = safeOwnData(optionsInput, 'limits');
  const requested =
    typeof limitsValue === 'object' && limitsValue !== null ? safeOwnData(limitsValue, 'retainedEvents') : undefined;
  const retainedLimit =
    typeof requested === 'number' && Number.isSafeInteger(requested) && requested >= 1
      ? Math.min(requested, HARD_CODE_EDITOR_LIMITS.retainedTelemetryEvents)
      : HARD_CODE_EDITOR_LIMITS.retainedTelemetryEvents;
  const events: CodeEditorObservationEvent[] = [];
  const deliveries: CodeEditorObservationEvent[] = [];
  const idleWaiters = new Set<() => void>();
  let disposed = false;
  let scheduled = false;
  let delivering = false;
  let discardedStaleResults = 0;
  let truncations = 0;
  let degradedTransitions = 0;
  let callbackFailures = 0;
  let droppedEvents = 0;

  const settleIdle = (): void => {
    if (!disposed && (scheduled || delivering || deliveries.length > 0)) return;
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  };
  const drain = (): void => {
    scheduled = false;
    if (disposed || delivering) {
      settleIdle();
      return;
    }
    const event = deliveries.shift();
    if (event === undefined || callback === undefined) {
      settleIdle();
      return;
    }
    delivering = true;
    void settleCallback(callback, event).then((failed) => {
      if (failed) callbackFailures = addBounded(callbackFailures, 1);
      delivering = false;
      if (!disposed && deliveries.length > 0) requestDrain();
      else settleIdle();
    });
  };
  const requestDrain = (): void => {
    if (scheduled || delivering || disposed || callback === undefined || deliveries.length === 0) return;
    scheduled = true;
    try {
      schedule(drain);
    } catch {
      scheduled = false;
      callbackFailures = addBounded(callbackFailures, 1);
      deliveries.length = 0;
      settleIdle();
    }
  };

  const channel: CodeEditorObservabilityChannel = {
    record(observation: CodeEditorObservation) {
      if (disposed || typeof observation !== 'object' || observation === null) return;
      const kind = ownKind(observation);
      if (kind === undefined) return;
      const event = Object.freeze({ kind, durationMs: boundedDuration(safeOwnData(observation, 'durationMs')) });
      events.push(event);
      if (events.length > retainedLimit) events.splice(0, events.length - retainedLimit);
      discardedStaleResults = addBounded(discardedStaleResults, safeOwnData(observation, 'discardedStaleResults'));
      truncations = addBounded(truncations, safeOwnData(observation, 'truncations'));
      degradedTransitions = addBounded(degradedTransitions, safeOwnData(observation, 'degradedTransitions'));
      if (callback !== undefined) {
        if (deliveries.length >= MAX_PENDING_DELIVERIES) droppedEvents = addBounded(droppedEvents, 1);
        else deliveries.push(event);
        requestDrain();
      }
    },
    snapshot() {
      return Object.freeze({
        counters: Object.freeze({
          discardedStaleResults,
          truncations,
          degradedTransitions,
          callbackFailures,
          droppedEvents,
          pendingDeliveries: deliveries.length + (delivering ? 1 : 0),
        }),
        retainedEvents: Object.freeze([...events]),
      });
    },
    whenIdle() {
      if (disposed || (!scheduled && !delivering && deliveries.length === 0)) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.add(resolve));
    },
    dispose() {
      disposed = true;
      scheduled = false;
      events.length = 0;
      deliveries.length = 0;
      settleIdle();
    },
  };
  return Object.freeze(channel);
}

async function settleCallback(
  callback: (event: CodeEditorObservationEvent) => void | Promise<void>,
  event: CodeEditorObservationEvent,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => callback(event)),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CALLBACK_DEADLINE_MS);
        timer.unref?.();
      }),
    ]);
    return false;
  } catch {
    return true;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function safeOwnData(value: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function ownKind(value: object): CodeEditorObservation['kind'] | undefined {
  const kind = safeOwnData(value, 'kind');
  return kind === 'parse' || kind === 'render' || kind === 'lsp' || kind === 'degradation' || kind === 'truncation'
    ? kind
    : undefined;
}

function boundedDuration(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, 60_000) : 0;
}

function addBounded(current: number, value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return current;
  return Math.min(Number.MAX_SAFE_INTEGER, current + value);
}
