/**
 * The reactive scheduler (RD-01, 03-01) — the tracking context and the glitch-free,
 * synchronous propagation algorithm. This is the subsystem's hard core (complexity L).
 *
 * It owns the module-level tracking context (single-threaded JS makes module state safe),
 * dependency-edge registration, the two-phase mark/flush propagation, `batch`/`untrack`,
 * the runaway guard (AR-18), and exception draining (AR-15, PA-2).
 *
 * Propagation is the standard two-phase, glitch-free, lazy scheme (AR-07): a **mark phase**
 * (no user code) marks a changed source's direct observers `DIRTY` and its transitive computed
 * observers `CHECK`, queuing reached effects; a **flush phase** drains the effects, each
 * **pulling** its `CHECK`/`DIRTY` computeds up to date on demand so it only ever observes a
 * fully consistent graph. A computed recomputes at most once per cascade and short-circuits
 * when its memo is unchanged, bounding diamond re-runs (AC-7).
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
 * Run a computation's `fn` once under tracking: fire its previous cleanups, drop its old
 * dependency edges (so it re-collects them — dynamic tracking), then execute `fn`. Returns
 * `fn`'s result (used by `computed`; ignored for an effect).
 *
 * On a throw, the aborted run's freshly registered cleanups fire (AR-15) and the error is
 * rethrown to the caller (the flush loop, which drains the rest of the cascade). The
 * tracking context is always restored (try/finally), normal or throwing.
 *
 * @param node The computation to run.
 * @returns The value returned by `node.fn`.
 */
export function execute(node: Computation): unknown {
  // Fire the previous run's cleanups before re-running (AC-9), then clear them.
  runCleanups(node.cleanups);

  // Drop old edges so this run re-collects its dependencies from scratch.
  for (const source of node.sources) {
    source.observers.delete(node);
  }
  node.sources.clear();
  node.state = NodeState.CLEAN;

  const previousObserver = currentObserver;
  const previousOwner = currentOwner;
  currentObserver = node;
  currentOwner = node.owner;
  try {
    return node.fn();
  } catch (error) {
    // AR-15: abort the run → fire the onCleanups it registered before throwing.
    runCleanups(node.cleanups);
    throw error;
  } finally {
    currentObserver = previousObserver;
    currentOwner = previousOwner;
  }
}

/**
 * Mark phase (no user code runs): raise a computation's state and propagate.
 *
 * A direct observer of a changed source is marked `DIRTY`; a computed propagates `CHECK` to
 * *its* observers (transitive maybe-dirty) the first time it leaves `CLEAN`. Reached effects
 * are queued exactly once (only on the `CLEAN`→non-clean transition). State only ever rises
 * (`CLEAN` < `CHECK` < `DIRTY`), so escalating an already-marked node does no redundant work.
 *
 * @param node The computation to mark.
 * @param incoming The state to raise it to (`CHECK` or `DIRTY`).
 */
function markStale(node: Computation, incoming: NodeState): void {
  if (node.state >= incoming) return;
  const wasClean = node.state === NodeState.CLEAN;
  node.state = incoming;
  if (node.isEffect) {
    if (wasClean) pendingEffects.push(node); // queue once; later escalation won't re-queue
  } else if (wasClean && node.observers !== null) {
    for (const observer of node.observers) {
      markStale(observer, NodeState.CHECK);
    }
  }
}

/**
 * Mark a computed's observers `DIRTY` because its memo just changed (called by a computed's
 * `recompute` during a pull). No flush — the in-flight flush/pull picks the work up.
 *
 * @param observers The changed computed's observer set.
 */
export function markObserversStale(observers: Set<Computation>): void {
  for (const observer of observers) {
    markStale(observer, NodeState.DIRTY);
  }
}

/**
 * Resolve a `CHECK` (maybe-dirty) node by pulling **all** of its computed sources up to date;
 * any that recompute to a changed value escalate this node to `DIRTY`.
 *
 * Every source is pulled (no early exit on the first dirty one): this is what makes the scheme
 * glitch-free. Once all the node's computed sources are `CLEAN`, running the node reads only
 * settled values, so no computed recomputes — and re-marks the still-running node — mid-run. An
 * early break would leave a changed source to recompute lazily during the run and spuriously
 * re-queue the node (a diamond would run its effect twice — AC-7). Computeds are pure (no signal
 * writes), so pulling them cannot trigger a flush; the loop terminates on the dependency DAG.
 *
 * @param node The `CHECK` node to resolve.
 */
function resolveCheck(node: Computation): void {
  for (const source of node.sources) {
    source.pull(); // no-op for a signal; resolves a computed (may mark this node DIRTY)
  }
}

/**
 * Bring a node up to date on demand (lazy pull, AR-07). A `CHECK` node resolves its computed
 * sources first ({@link resolveCheck}); if one changed, this node escalates to `DIRTY`. A
 * `DIRTY` node then runs (an effect) or recomputes its memo (a computed). A `CHECK` node whose
 * sources were all unchanged simply demotes to `CLEAN` (the memo-equal short-circuit).
 *
 * @param node The node to resolve.
 */
export function updateIfNecessary(node: Computation): void {
  if (node.state === NodeState.CHECK) {
    resolveCheck(node);
  }
  if (node.state === NodeState.DIRTY) {
    if (node.isEffect) {
      execute(node);
    } else if (node.recompute !== null) {
      node.recompute();
    }
    // `execute`/`recompute` set the node CLEAN at the *start* of the run; we deliberately do
    // not force CLEAN again here. A self-writing effect re-marks itself DIRTY mid-run, and that
    // must survive so the flush loop re-runs it into the runaway guard (AC-11).
  } else {
    // CHECK resolved with no changed source (or already CLEAN): settle to CLEAN.
    node.state = NodeState.CLEAN;
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
          updateIfNecessary(effect); // pulls its computeds, then runs if actually dirty
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
 * Propagate a source change: mark direct observers `DIRTY` (kicking off the mark phase), then
 * flush (unless batching). Called by a signal write once it has confirmed the value actually
 * changed (AR-05).
 *
 * @param source The source whose value just changed.
 */
export function notifyChanged(source: Subscribable): void {
  for (const observer of source.observers) {
    markStale(observer, NodeState.DIRTY);
  }
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
