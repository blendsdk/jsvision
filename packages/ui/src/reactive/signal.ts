/**
 * Signals (RD-01, 03-01; AR-01, AR-05) — the writable leaf sources of the graph.
 *
 * A signal is a callable accessor with `.set`/`.update`/`.peek`. Reading inside a tracked
 * computation subscribes it; writing notifies observers only when the value actually
 * changes under the signal's equality policy.
 */
import type { EqualsOption, Signal, Source } from './types.js';
import { registerRead, notifyChanged } from './scheduler.js';

/** Options for {@link signal}. */
export interface SignalOptions<T> {
  /**
   * Change-equality policy (AR-05): a predicate (equal ⇒ notify nothing), or `false` to
   * notify on every write. Defaults to `Object.is`.
   */
  equals?: EqualsOption<T>;
}

/**
 * Create a writable reactive signal (AR-01).
 *
 * @param initial The initial value.
 * @param options Optional equality policy (AR-05).
 * @returns A callable accessor: call to read (subscribes the running computation); `.set`
 *   replaces the value; `.update` derives the next value from the previous; `.peek` reads
 *   without subscribing.
 */
export function signal<T>(initial: T, options?: SignalOptions<T>): Signal<T> {
  const equals: (a: T, b: T) => boolean = options?.equals === false ? () => false : (options?.equals ?? Object.is);

  const source: Source<T> = {
    value: initial,
    equals,
    observers: new Set(),
    // A signal is always current, so there is nothing to pull (AR-07 lazy-pull interface).
    pull: () => undefined,
  };

  /** Apply a write: no-op on an equal value (AR-05), else assign and propagate. */
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
