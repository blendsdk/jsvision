/**
 * Effects (RD-01, 03-01; AR-02, AR-03) — the eager leaf sinks of the graph.
 *
 * An effect runs once on creation and re-runs whenever a tracked dependency changes. It has
 * no memoized value and no observers. Disposal is owner-scoped only (PA-5): there is no
 * per-effect disposer handle; an effect is torn down when its owner scope is disposed.
 */
import type { Computation } from './types.js';
import { NodeState } from './types.js';
import { runComputation } from './scheduler.js';
import { attachComputation } from './owner.js';

/**
 * Create a side-effecting computation and run it once synchronously (AC-5). It re-runs on
 * every tracked-dependency change and is disposed with its owner scope (AR-03); created
 * outside any `createRoot`, it works but is never auto-disposed and dev-warns (AR-14).
 *
 * @param fn The effect body; its tracked reads become its dependencies (re-collected each run).
 */
export function effect(fn: () => void): void {
  const computation: Computation = {
    fn,
    sources: new Set(),
    state: NodeState.DIRTY,
    owner: null,
    cleanups: [],
    isEffect: true,
  };
  attachComputation(computation);
  runComputation(computation);
}
