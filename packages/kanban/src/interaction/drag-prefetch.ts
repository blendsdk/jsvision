import { KanbanDisposedResourceError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanCardDropTarget, KanbanDragGeneration, KanbanDragPrefetchHint } from './drag-types.js';

/** Same-realm Promise intrinsic used without consulting an application object's public `then`. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;

/** Side-effect boundaries used by one unknown-edge source acquisition controller. */
export interface KanbanDragPrefetchControllerOptions {
  /** Starts one bounded source request under the controller-owned abort signal. */
  readonly ensureRange: (hint: KanbanDragPrefetchHint, signal: AbortSignal) => Promise<void>;
  /** Requests fresh geometry after the current source request settles successfully. */
  readonly publishEvidence: (hint: KanbanDragPrefetchHint, generation: KanbanDragGeneration) => void;
}

/** Public lifecycle for one current drag-prefetch request. */
export interface KanbanDragPrefetchController {
  /** Starts, preserves, replaces, or leaves an unknown-edge request. */
  update(target: KanbanCardDropTarget | undefined, generation: KanbanDragGeneration): boolean;
  /** Aborts current work synchronously and idempotently. */
  cancel(): void;
  /** Aborts current work and rejects later updates. */
  dispose(): void;
}

/** Detached request identity retained without a whole drop target. */
interface ActivePrefetch {
  /** Collision-safe semantic hint identity. */
  readonly key: string;
  /** Current drag generation. */
  readonly generation: KanbanDragGeneration;
  /** Detached bounded source hint. */
  readonly hint: KanbanDragPrefetchHint;
  /** Controller-owned cancellation source. */
  readonly abort: AbortController;
}

/** Accept only an unmodified same-realm native Promise with no own members. */
function isExactNativePromise(value: unknown): value is Promise<void> {
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

/** Settle an exact native Promise without invoking a replaceable `then` property. */
function settleNativePromise(value: Promise<void>, settled: (succeeded: boolean) => void): boolean {
  try {
    NATIVE_PROMISE_THEN.call(
      value,
      () => settled(true),
      () => settled(false),
    );
    return true;
  } catch {
    return false;
  }
}

/** Validates one non-negative safe integer. */
function integer(value: unknown, minimum: number): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum ? value : undefined;
}

/** Snapshots one source hint or returns no work for invalid/unbounded evidence. */
function snapshotHint(value: KanbanDragPrefetchHint | undefined): KanbanDragPrefetchHint | undefined {
  if (value === undefined) return undefined;
  try {
    const start = integer(value.start, 0);
    const count = integer(value.count, 1);
    if (start === undefined || count === undefined || count > KANBAN_LIMITS.ensureRangeCards.absolute) {
      return undefined;
    }
    return Object.freeze({
      address: snapshotKanbanCellAddress(value.address),
      start,
      count,
      revision: snapshotKanbanRevision(value.revision),
    });
  } catch {
    return undefined;
  }
}

/** Creates a collision-safe request key from non-sensitive source evidence. */
function hintKey(hint: KanbanDragPrefetchHint): string {
  return JSON.stringify([
    'kanban-drag-prefetch',
    canonicalizeKanbanCellAddress(hint.address),
    hint.start,
    hint.count,
    hint.revision,
  ]);
}

/** Returns a bounded hint only for the intentionally unavailable unknown-edge target. */
function targetHint(target: KanbanCardDropTarget | undefined): KanbanDragPrefetchHint | undefined {
  if (
    target?.kind !== 'unknown-edge' ||
    target.eligibility.kind !== 'unavailable' ||
    target.eligibility.code !== 'placement-loading'
  ) {
    return undefined;
  }
  return snapshotHint(target.prefetch);
}

/** Owns one abortable source acquisition for the current unknown edge. */
class DefaultKanbanDragPrefetchController implements KanbanDragPrefetchController {
  readonly #ensureRange: KanbanDragPrefetchControllerOptions['ensureRange'];
  readonly #publishEvidence: KanbanDragPrefetchControllerOptions['publishEvidence'];
  #active: ActivePrefetch | undefined;
  #disposed = false;

  /** Creates one independent prefetch owner. */
  constructor(options: KanbanDragPrefetchControllerOptions) {
    this.#ensureRange = options.ensureRange;
    this.#publishEvidence = options.publishEvidence;
  }

  /** Starts, preserves, replaces, or leaves an unknown-edge request. */
  update(target: KanbanCardDropTarget | undefined, generationValue: KanbanDragGeneration): boolean {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    const generation = integer(generationValue, 1);
    const hint = targetHint(target);
    if (generation === undefined || hint === undefined) {
      this.cancel();
      return false;
    }
    const key = hintKey(hint);
    if (this.#active?.generation === generation && this.#active.key === key) return false;
    this.cancel();

    const active: ActivePrefetch = Object.freeze({ key, generation, hint, abort: new AbortController() });
    this.#active = active;
    let pending: unknown;
    try {
      pending = this.#ensureRange(hint, active.abort.signal);
      if (!isExactNativePromise(pending)) throw new TypeError('Kanban drag prefetch requires an exact native Promise.');
    } catch {
      if (this.#active === active) this.#active = undefined;
      active.abort.abort();
      return false;
    }
    if (!settleNativePromise(pending, (succeeded) => this.#settle(active, succeeded))) {
      if (this.#active === active) this.#active = undefined;
      active.abort.abort();
      return false;
    }
    return true;
  }

  /** Aborts current work synchronously and idempotently. */
  cancel(): void {
    const active = this.#active;
    this.#active = undefined;
    active?.abort.abort();
  }

  /** Aborts current work and rejects later updates. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel();
  }

  /** Publishes only a successful settlement still owned by the current generation and hint. */
  #settle(active: ActivePrefetch, succeeded: boolean): void {
    if (this.#active !== active || active.abort.signal.aborted) return;
    this.#active = undefined;
    if (!succeeded) return;
    try {
      this.#publishEvidence(active.hint, active.generation);
    } catch {
      // Application notification failures cannot revive or retain completed source work.
    }
  }
}

/**
 * Creates one bounded, generation-safe unknown-edge prefetch controller.
 *
 * @example
 * ```ts
 * const prefetch = createKanbanDragPrefetchController({
 *   ensureRange: (hint, signal) => cursor.ensureRange(hint.start, hint.start + hint.count, { signal }),
 *   publishEvidence: () => viewport.reproject(),
 * });
 * ```
 */
export function createKanbanDragPrefetchController(
  options: KanbanDragPrefetchControllerOptions,
): KanbanDragPrefetchController {
  return new DefaultKanbanDragPrefetchController(options);
}
