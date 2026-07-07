/**
 * Signals — the writable, reactive values at the leaves of the graph.
 *
 * A signal is a callable accessor with `.set`/`.update`/`.peek`. Reading it inside a tracked
 * computation (an `effect` or `computed`) subscribes that computation, so it re-runs whenever the
 * value changes. Writing notifies subscribers only when the value actually changes under the
 * signal's equality policy — an equal write is a no-op.
 */
import type { EqualsOption, Signal, Source } from './types.js';
import { registerRead, notifyChanged } from './scheduler.js';

/** Options for {@link signal}. */
export interface SignalOptions<T> {
  /**
   * How the signal decides whether a write changed the value: a predicate returning `true` when the
   * new value counts as equal to the old (equal ⇒ nothing is notified), or `false` to treat every
   * write as a change (always notify). Defaults to `Object.is`.
   */
  equals?: EqualsOption<T>;
}

/**
 * Create a writable reactive value.
 *
 * @param initial The initial value.
 * @param options Optional equality policy — see {@link SignalOptions}.
 * @returns A callable accessor: call it to read (and, inside a tracked computation, subscribe);
 *   `.set(v)` replaces the value; `.update(fn)` derives the next value from the previous; `.peek()`
 *   reads the current value without subscribing.
 * @example
 * import { signal, effect } from '@jsvision/ui';
 *
 * const count = signal(0);
 * effect(() => console.log('count is', count())); // logs 0, then re-runs on each change
 * count.set(1);                 // effect re-runs → "count is 1"
 * count.update((n) => n + 10);  // effect re-runs → "count is 11"
 * count.set(11);                // equal value → no re-run
 * count.peek();                 // 11, read without subscribing
 */
export function signal<T>(initial: T, options?: SignalOptions<T>): Signal<T> {
  const equals: (a: T, b: T) => boolean = options?.equals === false ? () => false : (options?.equals ?? Object.is);

  const source: Source<T> = {
    value: initial,
    equals,
    observers: new Set(),
    // A signal always holds its current value, so there is nothing to lazily recompute on read.
    pull: () => undefined,
  };

  /** Apply a write: no-op on an equal value, else assign and notify subscribers. */
  function setValue(value: T): void {
    if (source.equals(source.value, value)) return;
    source.value = value;
    notifyChanged(source);
  }

  const read = (): T => {
    registerRead(source);
    return source.value;
  };

  return Object.assign(read, {
    peek: (): T => source.value,
    set: setValue,
    update: (fn: (previous: T) => T): void => setValue(fn(source.value)),
  });
}
