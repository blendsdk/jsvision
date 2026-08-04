import { KanbanInvalidLimitError } from '../contract/limits.js';

/** Deterministic manually settled promise controller for consumer source tests. */
export interface KanbanDeferred<T> {
  /** Promise settled exactly once by the controller. */
  readonly promise: Promise<T>;
  /** Resolves the promise on its first call. */
  resolve(value: T): void;
  /** Rejects the promise on its first call. */
  reject(error: unknown): void;
  /** Reports whether either settlement method has already won. */
  settled(): boolean;
}

/** Creates one deterministic deferred promise without timers. */
export function createKanbanDeferred<T>(): KanbanDeferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((error: unknown) => void) | undefined;
  let complete = false;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return Object.freeze({
    promise,
    resolve(value: T): void {
      if (complete) return;
      complete = true;
      resolvePromise?.(value);
    },
    reject(error: unknown): void {
      if (complete) return;
      complete = true;
      rejectPromise?.(error);
    },
    settled: () => complete,
  });
}

/** Deterministic equality-only numeric revision controller. */
export interface KanbanRevisionController {
  /** Returns the active revision. */
  revision(): number;
  /** Advances and returns the next revision. */
  next(): number;
}

/** Creates a deterministic safe-integer revision sequence for fixtures. */
export function createKanbanRevisionController(initialRevision = 0): KanbanRevisionController {
  if (!Number.isSafeInteger(initialRevision) || initialRevision < 0) throw new KanbanInvalidLimitError();
  let revision = initialRevision;
  return Object.freeze({
    revision: () => revision,
    next(): number {
      if (revision === Number.MAX_SAFE_INTEGER) throw new KanbanInvalidLimitError();
      revision += 1;
      return revision;
    },
  });
}

/** Fixed-capacity FIFO used by testing instrumentation without retaining payload objects. */
export class KanbanTestingEventRing<TEvent> {
  readonly #capacity: number;
  readonly #events: TEvent[] = [];

  /** Creates a finite ring; zero capacity disables retention. */
  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 0 || capacity > 8_192) throw new KanbanInvalidLimitError();
    this.#capacity = capacity;
  }

  /** Retains one already-sanitized frozen event and evicts the oldest when full. */
  push(event: TEvent): void {
    if (this.#capacity === 0) return;
    this.#events.push(event);
    while (this.#events.length > this.#capacity) this.#events.shift();
  }

  /** Returns a detached frozen event sequence. */
  values(): readonly TEvent[] {
    return Object.freeze([...this.#events]);
  }
}
