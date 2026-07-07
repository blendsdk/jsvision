/**
 * Node model for the reactive graph.
 *
 * The public types here — `Signal`, `Computed`, `EqualsOption` — are what consumers hold. The rest
 * (the `Source`/`Computation`/`Owner` node interfaces and `NodeState`) are the internal graph
 * machinery, described briefly so a reader of the engine can follow it:
 * - A **source** is a value others subscribe to (a signal, or a computed's cached value).
 * - A **computation** is a tracked function that reads sources (an effect, or a computed).
 * - An **owner** holds the computations and child scopes created under it, for disposal.
 *
 * A computed is *both* a source (others read it) and a computation (it reads others), so those two
 * interfaces compose on the one concrete computed node.
 */

/**
 * A writable reactive value. Call it to read (and, inside a tracked computation, subscribe);
 * `.set`/`.update` write; `.peek()` reads without subscribing.
 */
export interface Signal<T> {
  /** Read the current value; subscribes the running computation, if any. */
  (): T;
  /** Replace the value; notifies subscribers unless the new value is equal under the equality policy. */
  set(value: T): void;
  /** Replace the value derived from its predecessor; `update(fn)` is `set(fn(peek()))`. */
  update(fn: (previous: T) => T): void;
  /** Read the current value **without** subscribing the running computation. */
  peek(): T;
}

/**
 * A read-only derived value: lazy + memoized. Call it to read (and subscribe); `.peek()` reads
 * without subscribing.
 */
export interface Computed<T> {
  /** Read the (cached) value; subscribes the running computation, if any. */
  (): T;
  /** Read the cached value **without** subscribing the running computation. */
  peek(): T;
}

/**
 * The change-equality policy for a signal or computed. A predicate decides whether a new value
 * counts as "equal" to the old one (equal ⇒ no notification); `false` disables equality so **every**
 * write notifies. Defaults to `Object.is` when omitted.
 */
export type EqualsOption<T> = false | ((a: T, b: T) => boolean);

/**
 * Internal: lifecycle state of a computation in the propagation algorithm.
 *
 * - `CLEAN`: up to date; no recompute needed.
 * - `CHECK`: a transitive source *might* have changed — resolve lazily on read/pull.
 * - `DIRTY`: a direct source changed — must recompute / re-run.
 *
 * Modelled as a constant object (not a bare enum) so it stays safe under `isolatedModules`/esbuild.
 */
export const NodeState = {
  CLEAN: 0,
  CHECK: 1,
  DIRTY: 2,
} as const;

/** One of the {@link NodeState} discriminator values. */
export type NodeState = (typeof NodeState)[keyof typeof NodeState];

/**
 * Internal: the value-agnostic face of a source — just its observer set and a lazy-pull hook. A
 * computation's `sources` are held as `Subscribable` (not `Source<unknown>`) so the graph machinery
 * stays variance-safe under `strictFunctionTypes`: a `Source<T>`'s contravariant `equals` parameter
 * would otherwise block assignment to `Source<unknown>`. The machinery only ever needs a source's
 * observers, so this narrower face is sufficient and fully typed (no casts).
 */
export interface Subscribable {
  /** Computations currently subscribed to this source (kept in sync with `Computation.sources`). */
  readonly observers: Set<Computation>;
  /**
   * Bring this source up to date before it is read (lazy pull). A no-op for a signal (always
   * current); for a computed it recomputes if a dependency changed. Letting the source update itself
   * keeps the scheduler from having to distinguish source kinds.
   */
  pull(): void;
}

/**
 * Internal: a value others can subscribe to (a signal, or a computed's cached value).
 */
export interface Source<T> extends Subscribable {
  /** The current (cached, for a computed) value. */
  value: T;
  /** Equality predicate; returns `true` when a write should notify nothing. */
  equals: (a: T, b: T) => boolean;
}

/**
 * Internal: a tracked computation (an effect, or a computed). Its `sources` set is re-collected on
 * every run, giving dynamic dependency tracking (a branch no longer taken drops its subscription).
 */
export interface Computation {
  /** The tracked function executed on each run. */
  fn: () => unknown;
  /** Sources read during the most recent run (re-collected each run). */
  readonly sources: Set<Subscribable>;
  /** Propagation state (`CLEAN`/`CHECK`/`DIRTY`). */
  state: NodeState;
  /** Owner scope this computation is disposed with, or `null` when created with no owner. */
  owner: Owner | null;
  /** `onCleanup` callbacks; fired before each re-run and once at disposal. */
  cleanups: Array<() => void>;
  /**
   * `true` once the owning scope has disposed this computation. Disposal is final: a disposed node is
   * skipped by the flush loop and never runs its body or re-subscribes again, so a write that
   * dirtied it while it was still queued cannot resurrect it.
   */
  disposed: boolean;
  /** `true` for an effect (eager leaf sink); `false` for a computed (lazy source). */
  readonly isEffect: boolean;
  /**
   * `true` while this node's body is on the compute stack. A read of a node that is already
   * evaluating is a dependency cycle and throws {@link ReactiveCycleError} rather than silently
   * returning `undefined`. Reset in `execute()`'s `finally`, so it clears even on throw.
   */
  evaluating: boolean;
  /**
   * For a **computed** (which is also a source): the computations observing it, so the mark phase can
   * propagate `CHECK` to them transitively. `null` for an effect, which is a leaf sink with no
   * observers.
   */
  observers: Set<Computation> | null;
  /**
   * For a **computed**: recompute its value, marking observers `DIRTY` only if it actually changed
   * (the short-circuit that bounds redundant re-runs of shared derivations). `null` for an effect,
   * which the scheduler runs directly.
   */
  recompute: (() => void) | null;
}

/**
 * Internal: a node in the disposal tree. Disposing an owner tears down, depth-first, every child
 * scope and every computation created under it.
 */
export interface Owner {
  /** Parent scope, or `null` at a root (`createRoot`). */
  owner: Owner | null;
  /** Computations created directly under this scope. */
  readonly owned: Computation[];
  /** Nested owner scopes (a `createRoot`, a `Show` branch, a `For` item). */
  readonly children: Owner[];
  /** `onCleanup` callbacks registered directly on this owner; fired once at disposal. */
  cleanups: Array<() => void>;
  /** `true` once disposed; further disposes are no-ops (idempotent). */
  disposed: boolean;
}
