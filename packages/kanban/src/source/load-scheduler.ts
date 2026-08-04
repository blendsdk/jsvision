import { KanbanDisposedResourceError } from '../contract/error.js';
import { KANBAN_LIMITS, KanbanInvalidLimitError } from '../contract/limits.js';

/** One queued or active scheduler operation without exposing its result type. */
interface SchedulerJob {
  /** Starts the application operation exactly once. */
  start(): void;
  /** Cancels and settles the wrapper without waiting for uncooperative application work. */
  abort(): void;
}

/** Options for the bounded private source-load scheduler. */
export interface KanbanLoadSchedulerOptions {
  /** Maximum application load callbacks allowed to run concurrently. */
  readonly concurrency?: number;
  /** Maximum callbacks retained while waiting for a concurrency slot. */
  readonly queued?: number;
}

/** Creates a stable cancellation error without exposing application state. */
function createAbortError(): Error {
  return new DOMException('The Kanban source operation was aborted.', 'AbortError');
}

/** Validates one configured scheduler bound against its package hard ceiling. */
function validateBound(value: number, maximum: number, allowZero: boolean): number {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > maximum) {
    throw new KanbanInvalidLimitError();
  }
  return value;
}

/**
 * Runs source acquisition callbacks with bounded concurrency and queue retention.
 *
 * The scheduler owns every callback's abort controller. Disposal invalidates scheduling first,
 * settles queued and active wrappers immediately, and ignores later application settlements.
 */
export class KanbanLoadScheduler {
  readonly #concurrency: number;
  readonly #maximumQueued: number;
  readonly #queue: SchedulerJob[] = [];
  readonly #active = new Set<SchedulerJob>();
  #disposed = false;

  /** Creates a scheduler using conservative package defaults unless lower bounds are supplied. */
  constructor(options: KanbanLoadSchedulerOptions = {}) {
    this.#concurrency = validateBound(
      options.concurrency ?? KANBAN_LIMITS.concurrentCellLoads.safe,
      KANBAN_LIMITS.concurrentCellLoads.absolute,
      false,
    );
    this.#maximumQueued = validateBound(
      options.queued ?? KANBAN_LIMITS.pendingOperations.safe,
      KANBAN_LIMITS.pendingOperations.absolute,
      true,
    );
  }

  /** Number of callbacks currently executing. */
  get activeCount(): number {
    return this.#active.size;
  }

  /** Number of callbacks waiting for a concurrency slot. */
  get queuedCount(): number {
    return this.#queue.length;
  }

  /**
   * Schedules one application load callback and passes it a scheduler-owned cancellation signal.
   *
   * A caller signal cancels only this operation. Queue overflow rejects before the callback starts.
   */
  schedule<T>(run: (signal: AbortSignal) => Promise<T> | T, options?: { readonly signal?: AbortSignal }): Promise<T> {
    if (this.#disposed) return Promise.reject(new KanbanDisposedResourceError());
    if (this.#active.size >= this.#concurrency && this.#queue.length >= this.#maximumQueued) {
      return Promise.reject(new KanbanInvalidLimitError());
    }

    const controller = new AbortController();
    let settled = false;
    let started = false;
    let removeCallerAbort = (): void => undefined;
    let job: SchedulerJob;

    const result = new Promise<T>((resolve, reject) => {
      const finish = (complete: () => void): void => {
        if (settled) return;
        settled = true;
        removeCallerAbort();
        complete();
        if (started) this.#active.delete(job);
        this.#drain();
      };

      job = {
        start: () => {
          if (settled || started) return;
          started = true;
          this.#active.add(job);
          Promise.resolve()
            .then(() => run(controller.signal))
            .then(
              (value) => finish(() => resolve(value)),
              (error: unknown) => finish(() => reject(error)),
            );
        },
        abort: () => {
          controller.abort();
          finish(() => reject(this.#disposed ? new KanbanDisposedResourceError() : createAbortError()));
        },
      };

      const callerSignal = options?.signal;
      if (callerSignal !== undefined) {
        const abort = (): void => job.abort();
        if (callerSignal.aborted) {
          abort();
          return;
        }
        callerSignal.addEventListener('abort', abort, { once: true });
        removeCallerAbort = () => callerSignal.removeEventListener('abort', abort);
      }

      if (this.#active.size < this.#concurrency) job.start();
      else this.#queue.push(job);
    });
    return result;
  }

  /** Invalidates the scheduler, aborts all work, and releases the finite queue idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const queued = this.#queue.splice(0);
    const active = [...this.#active];
    for (const job of queued) job.abort();
    for (const job of active) job.abort();
    this.#active.clear();
  }

  /** Starts queued callbacks in FIFO order until every concurrency slot is occupied. */
  #drain(): void {
    if (this.#disposed) return;
    while (this.#active.size < this.#concurrency) {
      const next = this.#queue.shift();
      if (next === undefined) return;
      next.start();
    }
  }
}
