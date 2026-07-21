/**
 * Ownership & disposal — how the reactive core stays leak-free.
 *
 * An owner scope holds the effects, computeds, and child scopes created inside it. Disposing the
 * scope tears them all down (depth-first) and fires their cleanups, so you never have to manually
 * unsubscribe. Everything reactive should live inside a scope: {@link createRoot} opens one, and a
 * mounted view provides one for its own lifetime.
 */
import type { Computation, Owner } from './types.js';
import { runCleanups } from './cleanup.js';
import { devWarn } from './warnings.js';
import { getObserver, getOwner, setOwner } from './scheduler.js';

/** @returns A fresh, undisposed owner whose parent is the given owner (or `null` at a root). */
function createOwner(parent: Owner | null): Owner {
  return { owner: parent, owned: [], children: [], cleanups: [], disposed: false };
}

/**
 * Attach a freshly created computation (effect or computed) to the current owner scope so it is
 * disposed with that scope. With no current owner the computation is left unowned — fully functional
 * but never auto-disposed — and a one-time dev warning flags the leak risk.
 *
 * @param computation The computation to attach.
 */
export function attachComputation(computation: Computation): void {
  const owner = getOwner();
  if (owner !== null) {
    computation.owner = owner;
    owner.owned.push(computation);
    return;
  }
  computation.owner = null;
  devWarn(
    'a computation was created outside any createRoot() scope; it will never be ' +
      'auto-disposed (potential leak). Wrap it in createRoot((dispose) => …) to manage its lifetime.',
  );
}

/**
 * Register a child owner scope under the current owner (`createRoot`, or a combinator's
 * per-branch/per-item scope). Unowned child scopes are allowed (same no-owner policy as
 * computations) and are simply not linked into any parent.
 *
 * @returns The new child owner.
 */
export function createChildScope(): Owner {
  const parent = getOwner();
  const scope = createOwner(parent);
  if (parent !== null) parent.children.push(scope);
  return scope;
}

/**
 * Open a root reactive scope and run `fn` inside it. Every effect, computed, and nested scope
 * created during `fn` (or later, by callbacks that run in this scope) belongs to this scope, and
 * `dispose()` tears them all down at once. This is the top-level entry point for any reactive work
 * that owns its own lifetime.
 *
 * @param fn Receives the scope's `dispose` callback; its return value becomes `createRoot`'s.
 * @returns Whatever `fn` returns.
 * @example
 * import { createRoot, signal, effect } from '@jsvision/ui';
 *
 * const stop = createRoot((dispose) => {
 *   const n = signal(0);
 *   effect(() => console.log('n =', n()));
 *   n.set(1); // effect re-runs
 *   return dispose;
 * });
 * stop(); // disposes the scope: the effect and its subscriptions are gone
 */
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const scope = createChildScope();
  const previousOwner = getOwner();
  setOwner(scope);
  try {
    return fn(() => dispose(scope));
  } finally {
    setOwner(previousOwner);
  }
}

/**
 * Run `fn` with `owner` as the active scope, then restore the previous scope. Re-entrant and
 * nestable. Unlike {@link createRoot}, this opens **no** new scope — it re-parents creation onto an
 * *existing* owner you already hold, so any effect/computed/nested-`createRoot` created inside `fn`
 * attaches to `owner` and is disposed with it.
 *
 * This is the tool for attaching new reactive work to a lifetime you don't currently sit inside —
 * e.g. building a child's effects under its parent's scope so the child is torn down with the
 * parent, even though the child was constructed outside any scope.
 *
 * It sets the owner only, not a tracking context: reads inside `fn` do **not** subscribe anything;
 * an `effect` created inside still tracks normally when it runs. With `owner === null`, created
 * computations are unowned and dev-warn.
 *
 * @param owner The scope to make active for the duration of `fn` (or `null` for unowned).
 * @param fn The function to run.
 * @returns Whatever `fn` returns.
 * @example
 * import { createRoot, runWithOwner, effect, getOwner, signal } from '@jsvision/ui';
 *
 * function render(text: string): void {
 *   console.log(text);
 * }
 *
 * const scope = createRoot((_dispose) => getOwner()); // capture a scope to reuse later
 * const label = signal('hi');
 * // ...elsewhere, attach a new effect to that captured scope:
 * runWithOwner(scope, () => {
 *   effect(() => render(label())); // runs now, and is disposed when `scope` is disposed
 * });
 */
export function runWithOwner<T>(owner: Owner | null, fn: () => T): T {
  const previousOwner = getOwner();
  setOwner(owner);
  try {
    return fn();
  } finally {
    setOwner(previousOwner);
  }
}

/**
 * Register a teardown callback that runs when the surrounding reactive lifetime ends. Called inside
 * an effect/computed body, it fires before each re-run and once at disposal (use it to release what
 * that run acquired — a timer, a subscription). Called directly inside a scope, it fires once when
 * the scope is disposed. Called outside any computation *and* any scope it can never run, so it is a
 * no-op with a dev warning.
 *
 * @param cb The teardown callback.
 * @example
 * import { createRoot, signal, effect, onCleanup } from '@jsvision/ui';
 *
 * function tick(): void {
 *   console.log('tick');
 * }
 *
 * createRoot((dispose) => {
 *   const ms = signal(1000);
 *   effect(() => {
 *     const id = setInterval(tick, ms());
 *     onCleanup(() => clearInterval(id)); // clears before each re-run and at dispose()
 *   });
 *   dispose(); // fires the pending cleanup → clearInterval
 * });
 */
export function onCleanup(cb: () => void): void {
  const observer = getObserver();
  if (observer !== null) {
    observer.cleanups.push(cb);
    return;
  }
  const owner = getOwner();
  if (owner !== null) {
    owner.cleanups.push(cb);
    return;
  }
  devWarn('onCleanup() was called outside any computation or owner scope; it will never run.');
}

/**
 * Dispose an owner scope, idempotently. Depth-first: dispose child scopes, then release each owned
 * computation's dependency subscriptions and fire its cleanups, then fire the owner's own cleanups.
 * After disposal a later signal write reaches none of the disposed computations, and each
 * `onCleanup` has run exactly once.
 *
 * @param owner The owner to dispose. Disposing an already-disposed owner is a safe no-op.
 */
export function dispose(owner: Owner): void {
  if (owner.disposed) return;
  owner.disposed = true; // set first: a cleanup that re-triggers dispose sees a no-op

  // Depth-first: child scopes first. Snapshot because each child removes itself below.
  for (const child of owner.children.slice()) {
    dispose(child);
  }

  // Release each owned computation's edges, then fire its onCleanups.
  for (const computation of owner.owned) {
    // Mark disposed FIRST: a computation left queued for re-run by a write in the same batch/flush
    // must be skipped by the flush loop rather than re-run and re-subscribed after teardown.
    computation.disposed = true;
    for (const source of computation.sources) {
      source.observers.delete(computation);
    }
    computation.sources.clear();
    runCleanups(computation.cleanups);
  }

  // The owner's own cleanups, then detach from the tree.
  runCleanups(owner.cleanups);
  owner.owned.length = 0;
  owner.children.length = 0;

  const parent = owner.owner;
  if (parent !== null) {
    const index = parent.children.indexOf(owner);
    if (index !== -1) parent.children.splice(index, 1);
  }
}
