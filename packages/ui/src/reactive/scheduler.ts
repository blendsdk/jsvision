/**
 * The reactive scheduler — the internal engine behind signals, computeds, and effects.
 *
 * It tracks which computation is currently running (so reads can subscribe it), records
 * dependency edges, and runs the propagation algorithm that decides what re-runs after a write. It
 * also implements the public `batch`/`untrack`/`getOwner` helpers.
 *
 * Propagation is glitch-free and lazy: a **mark phase** (running no user code) flags a changed
 * source's direct observers as needing an update and its transitive computed observers as
 * "maybe", queuing any reached effects; a **flush phase** then drains those effects, pulling each
 * computed up to date on demand, so an effect only ever observes a fully consistent graph. A
 * computed recomputes at most once per change and short-circuits when its value is unchanged, so a
 * value feeding several consumers never causes duplicate re-runs.
 */
import { NodeState } from './types.js';
import type { Computation, Owner, Subscribable } from './types.js';
import { runCleanups } from './cleanup.js';
import { ReactiveCycleError } from './errors.js';

/** Iteration ceiling before propagation is declared non-convergent and throws {@link ReactiveCycleError}. */
const MAX_PROPAGATION_ITERATIONS = 1000;

/** The computation whose body is currently running; signal reads subscribe it. */
let currentObserver: Computation | null = null;
/** The scope new computations/child scopes attach to (see owner.ts). */
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

/**
 * Get the current reactive owner scope, or `null` if no scope is active. Pass the returned scope to
 * {@link runWithOwner} to attach new reactive work to it later.
 *
 * @returns The active {@link Owner} scope, or `null` outside any scope.
 * @example
 * import { createRoot, getOwner, runWithOwner, effect } from '@jsvision/ui';
 *
 * const scope = createRoot((_dispose) => getOwner()); // grab the scope while inside it
 * runWithOwner(scope, () => {
 *   effect(() => {}); // created under, and disposed with, `scope`
 * });
 */
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
 * Subscribe the running computation to `source` (records the dependency both ways). A no-op when
 * nothing is tracking — outside any computation, or under `untrack`/`.peek()`.
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
 * On a throw, the aborted run's freshly registered cleanups fire and the error is rethrown to the
 * caller (the flush loop, which drains the rest of the cascade). The tracking context is always
 * restored (try/finally), whether the run returns or throws.
 *
 * @param node The computation to run.
 * @returns The value returned by `node.fn`.
 */
export function execute(node: Computation): unknown {
  // Disposal is final: a disposed node never runs its body or re-collects dependencies.
  if (node.disposed) return undefined;

  // Fire the previous run's cleanups before re-running, then clear them.
  runCleanups(node.cleanups);

  // Drop old subscriptions so this run re-collects its dependencies from scratch — this is what
  // makes tracking dynamic (a branch no longer read stops re-triggering the computation).
  for (const source of node.sources) {
    source.observers.delete(node);
  }
  node.sources.clear();
  node.state = NodeState.CLEAN;

  const previousObserver = currentObserver;
  const previousOwner = currentOwner;
  currentObserver = node;
  currentOwner = node.owner;
  // Mark COMPUTEDS (not effects) as on the compute stack, so a computed that re-reads itself throws a
  // cycle error instead of returning a stale/undefined value. Effects are leaf sinks that may
  // legitimately write a signal they also read; that convergence is the runaway guard's job.
  if (!node.isEffect) node.evaluating = true;
  try {
    return node.fn();
  } catch (error) {
    // Aborted run → fire the cleanups it registered before throwing.
    runCleanups(node.cleanups);
    // A throwing COMPUTED must not be left marked clean (cleared above), or later reads would return
    // its stale/uninitialized value forever. Mark it dirty so every read re-evaluates and re-throws.
    // Effects are handled by the flush loop (which collects the error), so this is scoped to computeds.
    if (!node.isEffect) node.state = NodeState.DIRTY;
    throw error;
  } finally {
    if (!node.isEffect) node.evaluating = false;
    currentObserver = previousObserver;
    currentOwner = previousOwner;
  }
}

/**
 * Mark phase (no user code runs): raise a computation's state and propagate.
 *
 * A direct observer of a changed source is marked `DIRTY`; a computed propagates `CHECK` to *its*
 * observers (transitive "maybe changed") the first time it leaves `CLEAN`. Reached effects are
 * queued exactly once (only on the `CLEAN`→non-clean transition). State only ever rises
 * (`CLEAN` < `CHECK` < `DIRTY`), so re-marking an already-marked node does no redundant work.
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
 * Mark a computed's observers `DIRTY` because its value just changed (called by a computed's
 * recompute during a pull). No flush here — the in-flight flush/pull picks the work up.
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
 * Every source is pulled (no early exit on the first changed one): this is what makes the scheme
 * glitch-free. Once all the node's computed sources are settled, running the node reads only
 * consistent values, so no computed recomputes — and re-marks the still-running node — mid-run. An
 * early break would leave a changed source to recompute lazily during the run and spuriously
 * re-queue the node (a diamond dependency would then run its effect twice). Computeds are pure, so
 * pulling them cannot trigger a flush; the loop terminates on the dependency graph.
 *
 * @param node The `CHECK` node to resolve.
 */
function resolveCheck(node: Computation): void {
  for (const source of node.sources) {
    source.pull(); // no-op for a signal; resolves a computed (may mark this node DIRTY)
  }
}

/**
 * Bring a node up to date on demand (lazy pull). A `CHECK` node resolves its computed sources first
 * ({@link resolveCheck}); if one changed, this node escalates to `DIRTY`. A `DIRTY` node then runs
 * (an effect) or recomputes (a computed). A `CHECK` node whose sources were all unchanged simply
 * settles back to `CLEAN` without re-running.
 *
 * @param node The node to resolve.
 */
export function updateIfNecessary(node: Computation): void {
  if (node.disposed) return; // disposal is final: never resolve/run a disposed node
  // Reading a node that is currently evaluating means it (transitively) depends on itself —
  // a compute cycle. Throw the typed error rather than returning a silent `undefined`.
  if (node.evaluating) {
    throw new ReactiveCycleError(
      MAX_PROPAGATION_ITERATIONS,
      'A computed dependency cycle was detected (a computed transitively reads its own value).',
    );
  }
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
    // must survive so the flush loop re-runs it — and eventually trips the runaway guard.
  } else {
    // CHECK resolved with no changed source (or already CLEAN): settle to CLEAN.
    node.state = NodeState.CLEAN;
  }
}

/**
 * Drain queued effects until the graph settles, bounded by the runaway guard.
 *
 * Re-entrant calls (an effect writing a signal during its own run) return immediately — the
 * in-flight loop picks up the newly queued effects. Errors thrown by effect runs are collected so
 * sibling effects still run; after the drain the first error is rethrown as-is and any extras are
 * reported via `console.error`. A no-op while batching.
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
        pendingEffects.length = 0; // release control so the app never hangs on a runaway cascade
        throw new ReactiveCycleError(MAX_PROPAGATION_ITERATIONS);
      }
      const batchOfEffects = pendingEffects.splice(0);
      for (const effect of batchOfEffects) {
        // Skip a disposed effect or one already run this drain — the loop must not resurrect a
        // computation that was disposed while still queued for a re-run.
        if (effect.disposed || effect.state === NodeState.CLEAN) continue;
        try {
          updateIfNecessary(effect); // pulls its computeds, then runs if actually dirty
        } catch (error) {
          errors.push(error); // collect; keep draining siblings
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (errors.length > 0) {
    const [first, ...rest] = errors;
    for (const error of rest) {
      console.error(error);
    }
    throw first; // the first error is rethrown as-is to the set/batch caller
  }
}

/**
 * Propagate a source change: mark direct observers `DIRTY` (starting the mark phase), then flush
 * (unless batching). Called by a signal write once it has confirmed the value actually changed.
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
 * Coalesce multiple writes into a single update. Run `fn` with propagation suspended; dependents
 * re-run just once, after `fn` returns, observing the final values of every signal written inside.
 * Nested batches join the outer one — only the outermost close triggers the flush.
 *
 * @param fn The function whose writes are coalesced.
 * @returns Whatever `fn` returns.
 * @example
 * import { signal, effect, batch } from '@jsvision/ui';
 *
 * const first = signal('Ada');
 * const last = signal('Lovelace');
 * effect(() => console.log(first(), last()));
 *
 * batch(() => {
 *   first.set('Grace');
 *   last.set('Hopper');
 * }); // effect re-runs ONCE → "Grace Hopper" (not twice)
 */
export function batch<T>(fn: () => T): T {
  batchDepth += 1;
  let bodyThrew = false;
  try {
    return fn();
  } catch (error) {
    bodyThrew = true;
    throw error;
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) {
      if (bodyThrew) {
        // The body's exception is already in flight; a closing-flush exception must not mask it, so
        // report the flush error to the console instead of throwing over the original.
        try {
          flush();
        } catch (flushError) {
          console.error(flushError);
        }
      } else {
        flush();
      }
    }
  }
}

/**
 * Run `fn` without subscribing the current computation to anything it reads. Use it inside an effect
 * or computed to read a signal's current value without making that signal a dependency, so a later
 * change to it will not trigger a re-run. The tracking context is restored afterwards.
 *
 * @param fn The function to run untracked.
 * @returns Whatever `fn` returns.
 * @example
 * import { signal, effect, untrack } from '@jsvision/ui';
 *
 * const value = signal(0);
 * const label = signal('count');
 * effect(() => {
 *   // Re-runs when `value` changes, but NOT when `label` changes (read untracked).
 *   console.log(untrack(() => label()), '=', value());
 * });
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
