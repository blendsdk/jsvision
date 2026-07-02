/**
 * Computeds (RD-01, 03-01; AR-06, AR-07) — lazy, memoized derived nodes.
 *
 * A computed is **both** a source (others read its memo) and a computation (it reads others).
 * Its body does not run until first read (lazy); a read with no dependency change returns the
 * memo without recomputing (memoized). When a dependency changes the memo is recomputed on the
 * next read, and observers are notified only if the value actually changed — the memo-equal
 * short-circuit that bounds diamond re-runs (AC-7).
 *
 * The memoized value lives in a closure (not a node field) so its type `T` stays exact without
 * an unsafe placeholder cast: it is assigned by the first recompute, which always runs before
 * any read (the node starts `DIRTY`).
 */
import type { Computation, Computed, EqualsOption, Subscribable } from './types.js';
import { NodeState } from './types.js';
import { execute, markObserversStale, registerRead, updateIfNecessary } from './scheduler.js';
import { attachComputation } from './owner.js';

/** Options for {@link computed}. */
export interface ComputedOptions<T> {
  /**
   * Change-equality policy (AR-05): a predicate (equal ⇒ don't notify observers), or `false`
   * to notify on every recompute. Defaults to `Object.is`.
   */
  equals?: EqualsOption<T>;
}

/**
 * Create a lazy, memoized derived value (AR-06).
 *
 * @param fn The derivation; its tracked reads become the computed's dependencies (re-collected
 *   each recompute). It must be pure — no signal writes.
 * @param options Optional equality policy for the derived value (AR-05).
 * @returns A read-only callable accessor: call to read (subscribes the running computation and
 *   resolves the memo); `.peek` resolves and reads the memo without subscribing.
 */
export function computed<T>(fn: () => T, options?: ComputedOptions<T>): Computed<T> {
  const equals: (a: T, b: T) => boolean = options?.equals === false ? () => false : (options?.equals ?? Object.is);

  let value: T; // assigned on first recompute (node starts DIRTY) — read only afterwards
  let initialized = false;
  const observers = new Set<Computation>();

  const node: Computation & Subscribable = {
    // The run body memoizes the latest value; `execute` invokes it under tracking.
    fn: () => {
      value = fn();
      initialized = true;
    },
    sources: new Set(),
    state: NodeState.DIRTY, // lazy: not yet evaluated
    owner: null,
    cleanups: [],
    disposed: false,
    isEffect: false,
    observers,
    recompute: () => {
      const previous = value;
      const hadValue = initialized;
      execute(node); // re-runs fn → reassigns `value`
      // First computation: observers are the readers triggering it — they receive the value
      // directly, so there is nothing to notify.
      if (!hadValue) return;
      // Otherwise notify only when the value actually changed (memo-equal short-circuit, AC-7).
      if (equals(previous, value)) return;
      markObserversStale(observers);
    },
    pull: () => updateIfNecessary(node),
  };

  attachComputation(node); // disposed with its owner; dev-warns if created with no owner (AR-14)

  const read = (): T => {
    registerRead(node);
    updateIfNecessary(node);
    return value;
  };

  return Object.assign(read, {
    peek: (): T => {
      updateIfNecessary(node);
      return value;
    },
  });
}
