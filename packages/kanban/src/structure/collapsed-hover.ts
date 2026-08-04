import { KanbanDisposedResourceError } from '../contract/error.js';
import { createKanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_TIMING_DEFAULTS } from '../contract/limits.js';

/** Candidate semantic swimlane for temporary drag-hover expansion. */
export interface KanbanCollapsedHoverTarget {
  /** Stable semantic swimlane identity. */
  readonly swimlaneId: string;
  /** Whether the group participates in the visible scene. */
  readonly visible: boolean;
  /** Whether the saved/current view state is collapsed. */
  readonly collapsed: boolean;
}

/** Observable state of one temporary collapsed-swimlane hover lease. */
export type KanbanCollapsedHoverState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'waiting'; readonly swimlaneId: string }
  | { readonly kind: 'expanded'; readonly swimlaneId: string; readonly temporary: true }
  | { readonly kind: 'disposed' };

/** Injectable timer boundary used by deterministic tests and host schedulers. */
export interface KanbanCollapsedHoverScheduler {
  /** Schedules one callback after a non-negative millisecond delay. */
  readonly schedule: (callback: () => void, delayMs: number) => unknown;
  /** Cancels one handle previously returned by `schedule`. */
  readonly cancel: (handle: unknown) => void;
}

/** Construction options for one independent hover lease controller. */
export interface KanbanCollapsedHoverControllerOptions {
  /** Timer boundary; omission uses the current JavaScript host timers. */
  readonly scheduler?: KanbanCollapsedHoverScheduler;
}

/** Shared frozen inert states. */
const IDLE: KanbanCollapsedHoverState = Object.freeze({ kind: 'idle' });
const DISPOSED: KanbanCollapsedHoverState = Object.freeze({ kind: 'disposed' });

/** Default scheduler delegates to host timers so fake-timer tools remain effective. */
const HOST_SCHEDULER: KanbanCollapsedHoverScheduler = Object.freeze({
  schedule(callback: () => void, delayMs: number): unknown {
    return setTimeout(callback, delayMs);
  },
  cancel(handle: unknown): void {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
});

/**
 * Owns one generation-safe temporary expansion lease at a time.
 *
 * The controller never mutates or republishes saved collapse state. Leaving, cancelling, or disposing
 * simply removes its temporary projection.
 */
export class KanbanCollapsedHoverController {
  readonly #scheduler: KanbanCollapsedHoverScheduler;
  #state: KanbanCollapsedHoverState = IDLE;
  #generation = 0;
  #timer: unknown;

  /** Creates a controller with an optional injected scheduler. */
  constructor(options: KanbanCollapsedHoverControllerOptions = {}) {
    this.#scheduler = options.scheduler ?? HOST_SCHEDULER;
  }

  /**
   * Starts or replaces the hover lease for one visible collapsed swimlane.
   *
   * Returns `false` for hidden or already-expanded groups so callers never auto-reveal them.
   */
  begin(target: KanbanCollapsedHoverTarget): boolean {
    this.#active();
    if (!target.visible || !target.collapsed) {
      this.cancel();
      return false;
    }
    let swimlaneId: string;
    try {
      swimlaneId = createKanbanSwimlaneId(target.swimlaneId);
    } catch {
      this.cancel();
      return false;
    }
    this.#clearTimer();
    this.#generation += 1;
    const generation = this.#generation;
    this.#state = Object.freeze({ kind: 'waiting', swimlaneId });
    this.#timer = this.#scheduler.schedule(() => {
      if (generation !== this.#generation || this.#state.kind !== 'waiting' || this.#state.swimlaneId !== swimlaneId) {
        return;
      }
      this.#timer = undefined;
      this.#state = Object.freeze({ kind: 'expanded', swimlaneId, temporary: true });
    }, KANBAN_TIMING_DEFAULTS.collapsedSwimlaneHoverMs);
    return true;
  }

  /** Removes a lease only when it belongs to the swimlane being left. */
  leave(swimlaneId: string): void {
    this.#active();
    if ((this.#state.kind !== 'waiting' && this.#state.kind !== 'expanded') || this.#state.swimlaneId !== swimlaneId) {
      return;
    }
    this.cancel();
  }

  /** Cancels any waiting or expanded lease and restores the underlying collapsed projection. */
  cancel(): void {
    this.#active();
    this.#clearTimer();
    this.#generation += 1;
    this.#state = IDLE;
  }

  /** Returns the current frozen lease state. */
  snapshot(): KanbanCollapsedHoverState {
    return this.#state;
  }

  /** Cancels pending work and makes disposal visible and idempotent. */
  dispose(): void {
    if (this.#state.kind === 'disposed') return;
    this.#clearTimer();
    this.#generation += 1;
    this.#state = DISPOSED;
  }

  /** Cancels the current scheduler handle without trusting cancellation to be synchronous. */
  #clearTimer(): void {
    if (this.#timer === undefined) return;
    const timer = this.#timer;
    this.#timer = undefined;
    try {
      this.#scheduler.cancel(timer);
    } catch {
      // Generation checks keep stale callbacks inert even when a host cancellation hook fails.
    }
  }

  /** Rejects state-changing operations after disposal. */
  #active(): void {
    if (this.#state.kind === 'disposed') throw new KanbanDisposedResourceError();
  }
}

/**
 * Creates one independent temporary collapsed-swimlane hover controller.
 *
 * @example
 * ```ts
 * const hover = createKanbanCollapsedHoverController();
 * hover.begin({ swimlaneId: 'team-a', visible: true, collapsed: true });
 * ```
 */
export function createKanbanCollapsedHoverController(
  options: KanbanCollapsedHoverControllerOptions = {},
): KanbanCollapsedHoverController {
  return new KanbanCollapsedHoverController(options);
}
