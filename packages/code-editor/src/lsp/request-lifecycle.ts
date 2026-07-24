import type { CodeEditorLspSession } from './session.js';
import type { CodeEditorLspOperation, LspOperationOutcome } from './types.js';

/** Scheduler contract used to make request timeouts deterministic and disposable. */
export interface LspRequestScheduler {
  readonly now: () => number;
  readonly schedule: (callback: () => void, delayMilliseconds: number) => { dispose(): void };
}

/** Coordinator hooks required by the isolated request lifecycle owner. */
export interface LspRequestLifecycleOptions<TStamp> {
  readonly session?: CodeEditorLspSession;
  readonly scheduler: LspRequestScheduler;
  readonly timeoutMilliseconds: number;
  readonly captureStamp: () => TStamp;
  readonly stampIsCurrent: (stamp: TStamp) => boolean;
  readonly issueBarrier: (afterSynchronousNotification: boolean) => Promise<void> | undefined;
  readonly batchStateChange: (change: () => void) => void;
  readonly setOperationState: (state: 'idle' | 'waiting' | 'pending') => void;
  readonly markTimeoutDegraded: () => void;
  readonly markFailureDegraded: () => void;
}

/** Callbacks and payload for one bounded language-service request. */
export interface LspRequestInput {
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly accept: (result: unknown) => void;
  readonly fail?: (error: Error) => void;
  readonly stale?: () => void;
  readonly afterSynchronousNotification?: boolean;
}

interface MutableLspOperation extends CodeEditorLspOperation {
  resolve(outcome: LspOperationOutcome): void;
}

/**
 * Owns pending request correlation, cancellation, timeout, and late-callback suppression.
 *
 * The coordinator remains responsible for protocol semantics. This owner only permits callbacks
 * from the exact live operation and releases both timers on every terminal outcome.
 */
export class LspRequestLifecycle<TStamp> {
  readonly #options: LspRequestLifecycleOptions<TStamp>;
  readonly #pending = new Map<number, { readonly operation: MutableLspOperation; readonly startedAt: number }>();

  public constructor(options: LspRequestLifecycleOptions<TStamp>) {
    this.#options = options;
  }

  /** Number of live operations retained by the lifecycle owner. */
  public get size(): number {
    return this.#pending.size;
  }

  /** Creates and schedules one request without exposing mutable lifecycle state. */
  public request(input: LspRequestInput): CodeEditorLspOperation {
    const session = this.#options.session;
    const id = session?.reserveRequestId() ?? 0;
    let settle: ((result: { readonly outcome: LspOperationOutcome }) => void) | undefined;
    let resolved = false;
    const timers: {
      deadline?: { dispose(): void };
      pendingIndicator?: { dispose(): void };
    } = {};
    const settled = new Promise<{ readonly outcome: LspOperationOutcome }>((resolve) => {
      settle = resolve;
    });
    const operation: MutableLspOperation = {
      requestId: id,
      settled,
      cancel: () => {
        session?.cancel(id);
        operation.resolve('cancelled');
      },
      resolve: (outcome) => {
        if (resolved) return;
        resolved = true;
        timers.deadline?.dispose();
        timers.pendingIndicator?.dispose();
        this.#pending.delete(id);
        if (this.#pending.size === 0) this.#options.setOperationState('idle');
        settle?.({ outcome });
      },
    };
    if (session === undefined) {
      operation.resolve('unavailable');
      return operation;
    }
    if (this.#pending.size >= 64) {
      operation.resolve('failed');
      return operation;
    }
    const stamp = this.#options.captureStamp();
    this.#pending.set(id, { operation, startedAt: this.#options.scheduler.now() });
    this.#options.setOperationState('waiting');
    timers.pendingIndicator = this.#options.scheduler.schedule(() => {
      if (this.#isLive(id, operation)) this.#options.setOperationState('pending');
    }, 150);
    timers.deadline = this.#options.scheduler.schedule(() => {
      if (!this.#isLive(id, operation)) return;
      session.cancel(id);
      this.#options.markTimeoutDegraded();
      input.fail?.(new Error('LSP request timed out.'));
      operation.resolve('timeout');
    }, this.#options.timeoutMilliseconds);

    const issue = () => {
      if (!this.#isLive(id, operation)) return;
      if (!this.#options.stampIsCurrent(stamp)) {
        input.stale?.();
        operation.resolve('stale');
        return;
      }
      if (session.state !== 'ready') {
        operation.resolve('unavailable');
        return;
      }
      session.request(id, input.method, input.params, (result, error) => {
        if (!this.#isLive(id, operation)) return;
        this.#options.batchStateChange(() => {
          if (error !== undefined) {
            this.#options.markFailureDegraded();
            input.fail?.(error);
            operation.resolve('failed');
          } else if (this.#options.stampIsCurrent(stamp)) {
            input.accept(result);
            operation.resolve('completed');
          } else {
            input.stale?.();
            operation.resolve('stale');
          }
        });
      });
    };
    const barrier = this.#options.issueBarrier(input.afterSynchronousNotification === true);
    if (barrier === undefined) issue();
    else void barrier.then(issue, () => operation.resolve('failed'));
    return operation;
  }

  /** Advances the pending indicator using the injected monotonic clock. */
  public tick(): void {
    for (const value of this.#pending.values()) {
      if (this.#options.scheduler.now() - value.startedAt >= 150) {
        this.#options.setOperationState('pending');
        return;
      }
    }
  }

  /** Cancels every live operation and releases its timers. */
  public cancelAll(): void {
    for (const [id, value] of [...this.#pending]) {
      this.#options.session?.cancel(id);
      value.operation.resolve('cancelled');
    }
    this.#pending.clear();
    this.#options.setOperationState('idle');
  }

  #isLive(id: number, operation: MutableLspOperation): boolean {
    return this.#pending.get(id)?.operation === operation;
  }
}
