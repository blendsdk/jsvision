/**
 * The reactive scheduler (RD-01, 03-01) — the tracking context and the glitch-free,
 * synchronous propagation algorithm. This is the subsystem's hard core (complexity L).
 *
 * It owns the module-level tracking context (single-threaded JS makes module state safe),
 * dependency-edge registration, the two-phase mark/flush propagation, `batch`/`untrack`,
 * the runaway guard (AR-18), and exception draining (AR-15, PA-2).
 *
 * Phase 1 propagates to **effects only** (no computeds exist yet); the `CHECK`/lazy-pull
 * path for transitive computed observers (AR-07) is layered on in Phase 2.
 */
import { NodeState } from './types.js';
import type { Computation, Owner, Subscribable } from './types.js';
import { runCleanups } from './cleanup.js';
import { ReactiveCycleError } from './errors.js';

/** Fixed propagation-iteration bound (AR-18); not configurable in v1. */
const MAX_PROPAGATION_ITERATIONS = 1000;

/** The computation whose `fn` is currently running; signal reads register an edge to it. */
let currentObserver: Computation | null = null;
/** The owner new computations/scopes attach to (see owner.ts). */
let currentOwner: Owner | null = null;
/** `> 0` while inside `batch`: writes queue instead of flushing. */
let batchDepth = 0;
/** Re-entrancy guard: `true` while the flush loop is draining (nested flushes no-op). */
let flushing = false;
/** Effects queued for the current flush (de-duplicated via each node's `state`). */
const pendingEffects: Computation[] = [];

/** @returns The currently running computation, or `null` outside any run. */
export function getObserver(): Computation | null {
  return currentObserver;
}

/** @returns The current owner scope, or `null` outside any owner. */
export function getOwner(): Owner | null {
  return currentOwner;
}

/**
 * Set the current owner scope. Used by `createRoot` and the combinators to install a child
 * scope for the duration of a function; callers are responsible for restoring the previous
 * owner (try/finally).
 *
 * @param owner The owner to make current (or `null`).
 */
export function setOwner(owner: Owner | null): void {
  currentOwner = owner;
}

/**
 * Register a dependency edge from the running computation to `source` (bidirectional). A
 * no-op when nothing is tracking (outside any run, or under `untrack`/`.peek()` — AR-08).
 *
 * @param source The source being read.
 */
export function registerRead(source: Subscribable): void {
  if (currentObserver !== null) {
    currentObserver.sources.add(source);
    source.observers.add(currentObserver);
  }
}

/**
 * Run a computation: fire its previous cleanups, drop its old dependency edges, then
 * execute its `fn` under tracking so it re-collects edges (dynamic dependency tracking).
 *
 * On a throw, the aborted run's freshly registered cleanups fire (AR-15) and the error is
 * rethrown to the caller (the flush loop, which drains the rest of the cascade). The
 * tracking context is always restored (try/finally), normal or throwing.
 *
 * @param computation The node to run.
 */
export function runComputation(computation: Computation): void {
  // Fire the previous run's cleanups before re-running (AC-9), then clear them.
  runCleanups(computation.cleanups);

  // Drop old edges so this run re-collects its dependencies from scratch.
  for (const source of computation.sources) {
    source.observers.delete(computation);
  }
  computation.sources.clear();
  computation.state = NodeState.CLEAN;

  const previousObserver = currentObserver;
  const previousOwner = currentOwner;
  currentObserver = computation;
  currentOwner = computation.owner;
  try {
    computation.fn();
  } catch (error) {
    // AR-15: abort the run → fire the onCleanups it registered before throwing.
    runCleanups(computation.cleanups);
    throw error;
  } finally {
    currentObserver = previousObserver;
    currentOwner = previousOwner;
  }
}

/**
 * Mark phase (no user code runs): mark a changed source's observers and queue any effects.
 *
 * Phase 1 handles effects only — every observer is an effect, marked `DIRTY` and queued
 * once (the `!== DIRTY` check de-duplicates within a flush). Phase 2 extends this to mark
 * transitive computed observers `CHECK` and recurse.
 *
 * @param source The source whose value just changed.
 */
function mark(source: Subscribable): void {
  for (const observer of source.observers) {
    if (observer.state !== NodeState.DIRTY) {
      observer.state = NodeState.DIRTY;
      if (observer.isEffect) {
        pendingEffects.push(observer);
      }
    }
  }
}

/**
 * Drain queued effects until the graph is quiescent, bounded by the runaway guard (AR-18).
 *
 * Re-entrant calls (an effect's run writing a signal) return immediately — the in-flight
 * loop picks up the newly queued effects. Errors thrown by effect runs are collected so
 * sibling effects still run (AR-15); after the drain the first is rethrown as-is and any
 * extras are reported via `console.error` (PA-2). A no-op while batching (`batchDepth > 0`).
 */
export function flush(): void {
  if (flushing || batchDepth > 0) return;
  flushing = true;
  const errors: unknown[] = [];
  try {
    let iterations = 0;
    while (pendingEffects.length > 0) {
      iterations += 1;
      if (iterations > MAX_PROPAGATION_ITERATIONS) {
        pendingEffects.length = 0; // release control; the event loop never hangs (AC-11)
        throw new ReactiveCycleError(MAX_PROPAGATION_ITERATIONS);
      }
      const batchOfEffects = pendingEffects.splice(0);
      for (const effect of batchOfEffects) {
        if (effect.state === NodeState.CLEAN) continue; // already run / disposed this drain
        try {
          runComputation(effect);
        } catch (error) {
          errors.push(error); // collect; keep draining siblings (AR-15)
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (errors.length > 0) {
    const [first, ...rest] = errors;
    for (const error of rest) {
      // PA-2: surplus cascade errors are real errors (ungated, unlike dev warnings).
      console.error(error);
    }
    throw first; // AR-15/PA-2: first error rethrown as-is to the set/batch caller.
  }
}

/**
 * Propagate a source change: mark observers, then flush (unless batching). Called by a
 * signal write once it has confirmed the value actually changed (AR-05).
 *
 * @param source The source whose value just changed.
 */
export function notifyChanged(source: Subscribable): void {
  mark(source);
  flush();
}

/**
 * Coalesce writes (AR-02, AR-16): run `fn` with flushing suspended, then flush once when
 * the **outermost** batch closes. Nested batches join the outer — only the `0`-transition
 * flushes — so dependents re-run once observing final values (AC-6, AC-18).
 *
 * @param fn The function whose writes are coalesced.
 * @returns `fn`'s return value.
 */
export function batch<T>(fn: () => T): T {
  batchDepth += 1;
  try {
    return fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) flush();
  }
}

/**
 * Run `fn` without subscribing the current computation to any source it reads (AR-08); the
 * tracking context is restored afterwards (try/finally).
 *
 * @param fn The function to run untracked.
 * @returns `fn`'s return value.
 */
export function untrack<T>(fn: () => T): T {
  const previousObserver = currentObserver;
  currentObserver = null;
  try {
    return fn();
  } finally {
    currentObserver = previousObserver;
  }
}
