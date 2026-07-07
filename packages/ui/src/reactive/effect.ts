/**
 * Effects — reactive side effects that run when their dependencies change.
 *
 * An effect runs its body once immediately, then re-runs whenever any signal/computed it read
 * changes. Use it for the imperative edges of a reactive app: logging, syncing external state, or
 * driving a redraw. It produces no value.
 *
 * There is no per-effect disposer handle — an effect lives until the owner scope it was created in
 * is disposed. Create effects inside a {@link createRoot} (or a view's mount scope) so they are torn
 * down automatically; one created with no owner keeps running forever and dev-warns.
 */
import type { Computation } from './types.js';
import { NodeState } from './types.js';
import { updateIfNecessary } from './scheduler.js';
import { attachComputation } from './owner.js';

/**
 * Register a reactive side effect and run it once immediately. It re-runs on every change to a
 * signal or computed it read, and is disposed with its owner scope.
 *
 * @param fn The effect body; the signals/computeds it reads become its dependencies (re-collected
 *   on each run, so conditional branches only subscribe what they actually read).
 * @example
 * import { signal, effect, createRoot } from '@jsvision/ui';
 *
 * const name = signal('Ada');
 * createRoot((dispose) => {
 *   effect(() => console.log('hello', name())); // "hello Ada", then re-runs on change
 *   name.set('Grace');                          // "hello Grace"
 *   dispose();                                  // effect stops re-running
 * });
 */
export function effect(fn: () => void): void {
  const computation: Computation = {
    fn,
    sources: new Set(),
    state: NodeState.DIRTY,
    owner: null,
    cleanups: [],
    disposed: false,
    evaluating: false,
    isEffect: true,
    observers: null, // an effect is a leaf sink — nothing observes it
    recompute: null, // effects run directly; they have no cached value to recompute
  };
  attachComputation(computation);
  updateIfNecessary(computation); // initial synchronous run
}
