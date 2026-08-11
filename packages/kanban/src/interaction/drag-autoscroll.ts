import type { Point, Rect } from '@jsvision/ui';

import { KanbanInvalidGeometryError } from '../contract/error.js';
import type { KanbanDragGeneration } from './drag-types.js';

/** Fixed interval between drag-autoscroll steps. */
export const KANBAN_DRAG_AUTOSCROLL_INTERVAL_MS = 50;

/** Injectable timer boundary used by deterministic host and specification clocks. */
export interface KanbanDragAutoscrollScheduler {
  /** Schedules one deferred tick and returns its opaque cancellation handle. */
  schedule(callback: () => void, delayMs: number): unknown;
  /** Cancels one previously returned handle. */
  cancel(handle: unknown): void;
}

/** Current pointer and viewport geometry used by the pure zone resolver. */
export interface ResolveKanbanDragAutoscrollStepInput {
  /** Current viewport-local pointer coordinate. */
  readonly point: Readonly<Point>;
  /** Scrollable card viewport after sticky chrome has been removed. */
  readonly viewport: Readonly<Rect>;
}

/** Current controller state supplied after every pointer or geometry update. */
export interface KanbanDragAutoscrollUpdate extends ResolveKanbanDragAutoscrollStepInput {
  /** Active drag generation that owns any scheduled work. */
  readonly generation: KanbanDragGeneration;
}

/** Side-effect boundaries required by the bounded autoscroll controller. */
export interface KanbanDragAutoscrollControllerOptions {
  /** Optional deterministic scheduler; host timers are used by default. */
  readonly scheduler?: KanbanDragAutoscrollScheduler;
  /** Applies a requested step and returns the actual movement after clamping. */
  readonly scroll: (step: Readonly<Point>, generation: KanbanDragGeneration) => Readonly<Point>;
  /** Rebuilds current geometry and semantic targets after successful movement. */
  readonly recompute: (generation: KanbanDragGeneration) => void;
}

/** Public controller for one timer and one current drag generation. */
export interface KanbanDragAutoscrollController {
  /** Updates edge-zone ownership without creating duplicate timers. */
  update(input: KanbanDragAutoscrollUpdate): void;
  /** Cancels scheduled work synchronously and idempotently. */
  cancel(): void;
}

/** Host timer handles remain private so the public scheduler boundary can stay opaque and cast-free. */
const HOST_TIMERS = new WeakMap<object, ReturnType<typeof setTimeout>>();
/** Default scheduler delegates to host timers while retaining an opaque handle. */
const HOST_SCHEDULER: KanbanDragAutoscrollScheduler = Object.freeze({
  schedule(callback: () => void, delayMs: number): unknown {
    const handle = Object.freeze({});
    HOST_TIMERS.set(handle, setTimeout(callback, delayMs));
    return handle;
  },
  cancel(handle: unknown): void {
    if (typeof handle !== 'object' || handle === null) return;
    const timer = HOST_TIMERS.get(handle);
    if (timer === undefined) return;
    HOST_TIMERS.delete(handle);
    clearTimeout(timer);
  },
});

/** Validates one safe integer without retaining rejected input. */
function integer(value: unknown, minimum = Number.MIN_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Detaches one point and optionally restricts it to autoscroll-sized movement. */
function point(value: Readonly<Point>, bounded: boolean): Readonly<Point> {
  const x = integer(value.x);
  const y = integer(value.y);
  if (bounded && (Math.abs(x) > 2 || Math.abs(y) > 2)) throw new KanbanInvalidGeometryError();
  return Object.freeze({ x, y });
}

/** Detaches one finite non-empty viewport rectangle. */
function viewport(value: Readonly<Rect>): Readonly<Rect> {
  const x = integer(value.x);
  const y = integer(value.y);
  const width = integer(value.width, 1);
  const height = integer(value.height, 1);
  if (!Number.isSafeInteger(x + width) || !Number.isSafeInteger(y + height)) {
    throw new KanbanInvalidGeometryError();
  }
  return Object.freeze({ x, y, width, height });
}

/** Resolves one axis while keeping opposing edge zones disjoint in tiny viewports. */
function axisStep(coordinate: number, start: number, length: number): -2 | -1 | 0 | 1 | 2 {
  const offset = coordinate - start;
  if (offset < 0 || offset >= length || length === 1) return 0;
  const fromStart = offset;
  const fromEnd = length - 1 - offset;
  if (fromStart === 0) return -2;
  if (fromEnd === 0) return 2;
  if (fromStart <= 2 && fromStart < fromEnd) return -1;
  if (fromEnd <= 2 && fromEnd < fromStart) return 1;
  return 0;
}

/**
 * Resolves a bounded two-axis drag-autoscroll step from terminal-cell edge zones.
 *
 * The outer cell uses a two-cell step and the next two inward cells use a one-cell step. Opposing
 * zones never overlap: a tied center cell remains neutral, including the center of a 3×3 viewport.
 *
 * @example
 * ```ts
 * resolveKanbanDragAutoscrollStep({
 *   point: { x: 79, y: 23 },
 *   viewport: { x: 0, y: 1, width: 80, height: 23 },
 * }); // { x: 2, y: 2 }
 * ```
 */
export function resolveKanbanDragAutoscrollStep(input: ResolveKanbanDragAutoscrollStepInput): Readonly<Point> {
  const currentPoint = point(input.point, false);
  const bounds = viewport(input.viewport);
  return Object.freeze({
    x: axisStep(currentPoint.x, bounds.x, bounds.width),
    y: axisStep(currentPoint.y, bounds.y, bounds.height),
  });
}

/** One immutable tick input retained while the pointer remains in an edge zone. */
interface ActiveAutoscroll {
  readonly generation: KanbanDragGeneration;
  readonly step: Readonly<Point>;
}

/** Timer-backed implementation that owns at most one scheduled callback. */
class DefaultKanbanDragAutoscrollController implements KanbanDragAutoscrollController {
  readonly #scheduler: KanbanDragAutoscrollScheduler;
  readonly #scroll: KanbanDragAutoscrollControllerOptions['scroll'];
  readonly #recompute: KanbanDragAutoscrollControllerOptions['recompute'];
  #active: ActiveAutoscroll | undefined;
  #timer: unknown;
  #scheduling = false;

  /** Creates an isolated controller around validated callback seams. */
  constructor(options: KanbanDragAutoscrollControllerOptions) {
    this.#scheduler = options.scheduler ?? HOST_SCHEDULER;
    this.#scroll = options.scroll;
    this.#recompute = options.recompute;
  }

  /** Updates edge-zone ownership without creating duplicate timers. */
  update(input: KanbanDragAutoscrollUpdate): void {
    const generation = integer(input.generation, 1);
    const step = resolveKanbanDragAutoscrollStep(input);
    if (step.x === 0 && step.y === 0) {
      this.cancel();
      return;
    }
    if (this.#active !== undefined && this.#active.generation !== generation) this.cancel();
    this.#active = Object.freeze({ generation, step });
    this.#schedule();
  }

  /** Cancels scheduled work synchronously and idempotently. */
  cancel(): void {
    this.#active = undefined;
    const timer = this.#timer;
    this.#timer = undefined;
    if (timer === undefined) return;
    try {
      this.#scheduler.cancel(timer);
    } catch {
      // Generation invalidation above makes a scheduler callback inert even if host cancellation fails.
    }
  }

  /** Schedules one deferred tick unless one is already pending. */
  #schedule(): void {
    if (this.#active === undefined || this.#timer !== undefined || this.#scheduling) return;
    this.#scheduling = true;
    let deliveredSynchronously = false;
    try {
      const handle = this.#scheduler.schedule(() => {
        if (this.#scheduling) {
          deliveredSynchronously = true;
          return;
        }
        this.#tick();
      }, KANBAN_DRAG_AUTOSCROLL_INTERVAL_MS);
      this.#scheduling = false;
      if (deliveredSynchronously) {
        try {
          this.#scheduler.cancel(handle);
        } catch {
          // A synchronously delivered hostile handle has no trusted future work to retain.
        }
        this.cancel();
        return;
      }
      this.#timer = handle;
    } catch {
      this.#scheduling = false;
      this.cancel();
    }
  }

  /** Applies one bounded step and stops independently clamped axes. */
  #tick(): void {
    this.#timer = undefined;
    const active = this.#active;
    if (active === undefined) return;
    let movement: Readonly<Point>;
    try {
      movement = point(this.#scroll(active.step, active.generation), true);
      if ((active.step.x === 0 && movement.x !== 0) || (active.step.y === 0 && movement.y !== 0)) {
        throw new KanbanInvalidGeometryError();
      }
    } catch {
      this.cancel();
      return;
    }
    if (this.#active !== active) return;

    const nextStep = Object.freeze({
      x: active.step.x !== 0 && movement.x === 0 ? 0 : active.step.x,
      y: active.step.y !== 0 && movement.y === 0 ? 0 : active.step.y,
    });
    if (movement.x === 0 && movement.y === 0) {
      this.cancel();
      return;
    }
    try {
      this.#recompute(active.generation);
    } catch {
      this.cancel();
      return;
    }
    if (this.#active !== active) return;
    if (nextStep.x === 0 && nextStep.y === 0) {
      this.cancel();
      return;
    }
    this.#active = Object.freeze({ generation: active.generation, step: nextStep });
    this.#schedule();
  }
}

/**
 * Creates a one-generation drag-autoscroll controller with injected side-effect boundaries.
 *
 * @example
 * ```ts
 * const autoscroll = createKanbanDragAutoscrollController({
 *   scroll: (step) => viewport.scrollBy(step),
 *   recompute: () => viewport.reproject(),
 * });
 * ```
 */
export function createKanbanDragAutoscrollController(
  options: KanbanDragAutoscrollControllerOptions,
): KanbanDragAutoscrollController {
  return new DefaultKanbanDragAutoscrollController(options);
}
