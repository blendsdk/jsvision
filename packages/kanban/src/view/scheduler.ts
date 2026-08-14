/** Maximum accepted search debounce keeps accidental configuration finite. */
const MAXIMUM_DEBOUNCE_MS = 60_000;

/** Disposable single-slot scheduler that invalidates superseded callback generations. */
export interface KanbanViewScheduler {
  /** Replaces any pending callback and returns its monotonic generation. */
  schedule(callback: () => void): number;
  /** Cancels the pending callback without disposing the scheduler. */
  cancel(): void;
  /** Returns whether one callback is currently pending. */
  pending(): boolean;
  /** Cancels pending work and permanently makes scheduling unavailable. */
  dispose(): void;
}

/** Validates a bounded whole-millisecond debounce value. */
function validateDelay(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAXIMUM_DEBOUNCE_MS) {
    throw new RangeError('Invalid Kanban view debounce.');
  }
  return value;
}

/** Advances a generation without allowing a stale timer identity to be reused. */
function nextGeneration(current: number): number {
  if (current >= Number.MAX_SAFE_INTEGER) throw new RangeError('Kanban view scheduler generation exhausted.');
  return current + 1;
}

/**
 * Creates a one-slot generation-safe scheduler for draft-to-committed view changes.
 *
 * @example
 * ```ts
 * const scheduler = createKanbanViewScheduler(150);
 * scheduler.schedule(() => commitSearch());
 * scheduler.dispose();
 * ```
 */
export function createKanbanViewScheduler(delayMs: number): KanbanViewScheduler {
  const delay = validateDelay(delayMs);
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const cancel = (): void => {
    generation = nextGeneration(generation);
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return Object.freeze({
    schedule(callback: () => void): number {
      if (disposed) throw new RangeError('The Kanban view scheduler is disposed.');
      if (typeof callback !== 'function') throw new TypeError('Invalid Kanban view scheduler callback.');
      cancel();
      const ownedGeneration = generation;
      timer = setTimeout(() => {
        if (disposed || generation !== ownedGeneration) return;
        timer = undefined;
        callback();
      }, delay);
      return ownedGeneration;
    },
    cancel,
    pending: () => timer !== undefined,
    dispose(): void {
      if (disposed) return;
      cancel();
      disposed = true;
    },
  });
}
