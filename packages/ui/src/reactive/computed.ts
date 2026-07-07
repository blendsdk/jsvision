/**
 * Computeds — lazy, memoized derived values.
 *
 * A computed derives a value from other signals/computeds. It is both something you read (like a
 * signal) and something that reads others (like an effect). Its body does not run until the first
 * read (lazy); reading again without any dependency changing returns the cached value without
 * re-running (memoized). When a dependency changes, the value is recomputed on the next read, and
 * anything observing the computed re-runs only if the derived value actually changed — so a shared
 * computed feeding several consumers never triggers redundant work.
 *
 * The derivation must be pure: read signals freely, but do not write them from inside a computed.
 */
import type { Computation, Computed, EqualsOption, Subscribable } from './types.js';
import { NodeState } from './types.js';
import { execute, markObserversStale, registerRead, updateIfNecessary } from './scheduler.js';
import { attachComputation } from './owner.js';

/** Options for {@link computed}. */
export interface ComputedOptions<T> {
  /**
   * How the computed decides whether a recompute changed the value: a predicate returning `true`
   * when the new value counts as equal (equal ⇒ observers are not notified), or `false` to notify
   * on every recompute. Defaults to `Object.is`.
   */
  equals?: EqualsOption<T>;
}

/**
 * Create a lazy, memoized derived value.
 *
 * @param fn The derivation; the signals/computeds it reads become its dependencies (re-collected on
 *   each recompute). Must be pure — no signal writes.
 * @param options Optional equality policy for the derived value — see {@link ComputedOptions}.
 * @returns A read-only callable accessor: call it to read (and, inside a tracked computation,
 *   subscribe); `.peek()` reads the current value without subscribing.
 * @example
 * import { signal, computed, effect } from '@jsvision/ui';
 *
 * const price = signal(10);
 * const qty = signal(2);
 * const total = computed(() => price() * qty());
 *
 * effect(() => console.log('total:', total())); // "total: 20"
 * qty.set(3);                                    // "total: 30"
 * total();                                       // 30, returned from cache (not recomputed)
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
    evaluating: false,
    isEffect: false,
    observers,
    recompute: () => {
      const previous = value;
      const hadValue = initialized;
      execute(node); // re-runs fn → reassigns `value`
      // First computation: observers are the readers triggering it — they receive the value
      // directly, so there is nothing to notify.
      if (!hadValue) return;
      // Otherwise notify only when the value actually changed, so consumers of an unchanged
      // derived value never re-run.
      if (equals(previous, value)) return;
      markObserversStale(observers);
    },
    pull: () => updateIfNecessary(node),
  };

  // Tie the computed to the current owner scope so it is disposed with that scope; created with no
  // owner it still works but is never auto-disposed and emits a one-time dev warning.
  attachComputation(node);

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
