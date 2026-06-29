/**
 * Node model for the reactive graph (RD-01, 03-01 / 03-02).
 *
 * Two cooperating internal node kinds plus the disposal-tree node:
 * - A **source** is a value others can subscribe to (a `signal`, or a `computed`'s memo).
 * - A **computation** is a tracked function that reads sources (an `effect`, or a `computed`).
 * - An **owner** is a node in the disposal tree that holds the computations and child
 *   scopes created under it.
 *
 * A `computed` is *both* a source (others read its memo) and a computation (it reads
 * others), so the two interfaces compose on the concrete computed node.
 *
 * Public types (`Signal`, `Computed`, `EqualsOption`) are re-exported through the package
 * entry point; the internal node interfaces and `NodeState` are subsystem-private.
 */

/**
 * Public signal accessor (AR-01). Call it to read (and, inside a tracked computation,
 * subscribe); `.set`/`.update` write; `.peek()` reads without subscribing.
 */
export interface Signal<T> {
  /** Read the current value; subscribes the running computation, if any. */
  (): T;
  /** Replace the value; notifies observers unless the new value is equal (AR-05). */
  set(value: T): void;
  /** Replace the value from its predecessor; `update(fn)` ≡ `set(fn(peek()))`. */
  update(fn: (previous: T) => T): void;
  /** Read the current value **without** subscribing the running computation (AR-08). */
  peek(): T;
}

/**
 * Public read-only derived accessor (AR-06): lazy + memoized. Call it to read (and
 * subscribe); `.peek()` reads without subscribing.
 */
export interface Computed<T> {
  /** Read the (memoized) value; subscribes the running computation, if any. */
  (): T;
  /** Read the memoized value **without** subscribing the running computation. */
  peek(): T;
}

/**
 * Change-equality policy for a signal or computed (AR-05). A predicate decides whether a
 * new value is "equal" to the old one (equal ⇒ no notification); `false` disables
 * equality so **every** write notifies.
 */
export type EqualsOption<T> = false | ((a: T, b: T) => boolean);

/**
 * Lifecycle state of a computation in the propagation algorithm.
 *
 * - `CLEAN`: up to date; no recompute needed.
 * - `CHECK`: a transitive source *might* have changed — resolve lazily on read/pull.
 * - `DIRTY`: a direct source changed — must recompute / re-run.
 *
 * Modelled as a constant object (not a bare string literal, per the type-safety standard;
 * and isolatedModules/esbuild-safe — unlike a cross-file `const enum`).
 */
export const NodeState = {
  CLEAN: 0,
  CHECK: 1,
  DIRTY: 2,
} as const;

/** One of the {@link NodeState} discriminator values. */
export type NodeState = (typeof NodeState)[keyof typeof NodeState];

/**
 * Internal: the value-agnostic face of a source — just its observer set. A computation's
 * `sources` are held as `Subscribable` (not `Source<unknown>`) so the graph machinery
 * (edge registration, propagation, disposal) is variance-safe under `strictFunctionTypes`:
 * a `Source<T>`'s contravariant `equals` parameter would otherwise block assignment to
 * `Source<unknown>`. The machinery never needs a source's value or `equals` — only its
 * observers — so this narrower face is sufficient and fully typed (no casts).
 */
export interface Subscribable {
  /** Computations currently subscribed to this source (bidirectional with `Computation.sources`). */
  readonly observers: Set<Computation>;
  /**
   * Bring this source up to date before it is read (lazy pull). A no-op for a signal (always
   * current); for a computed it resolves a `CHECK`/`DIRTY` memo (AR-07). Letting the source
   * dispatch its own update keeps the scheduler from having to distinguish source kinds.
   */
  pull(): void;
}

/**
 * Internal: a value others can subscribe to (a signal, or a computed's memo).
 */
export interface Source<T> extends Subscribable {
  /** The current (memoized, for a computed) value. */
  value: T;
  /** Equality predicate; returns `true` when a write should notify nothing (AR-05). */
  equals: (a: T, b: T) => boolean;
}

/**
 * Internal: a tracked computation (an effect, or a computed). Its `sources` set is
 * re-collected on every run, giving dynamic dependency tracking (an untaken branch's old
 * edge is dropped).
 */
export interface Computation {
  /** The tracked function executed on each run. */
  fn: () => unknown;
  /** Sources read during the most recent run (re-collected each run). */
  readonly sources: Set<Subscribable>;
  /** Propagation state (`CLEAN`/`CHECK`/`DIRTY`). */
  state: NodeState;
  /** Owner scope this computation is disposed with, or `null` when created with no owner (AR-14). */
  owner: Owner | null;
  /** `onCleanup` callbacks; fired before each re-run and once at disposal (AR-03). */
  cleanups: Array<() => void>;
  /** `true` for an effect (eager leaf sink); `false` for a computed (lazy source). */
  readonly isEffect: boolean;
  /**
   * For a **computed** (which is also a source): the computations observing its memo, so the
   * mark phase can propagate `CHECK` to them transitively (AR-07). `null` for an effect, which
   * is a leaf sink with no observers.
   */
  observers: Set<Computation> | null;
  /**
   * For a **computed**: recompute its memo, marking observers `DIRTY` only if the value changed
   * (the memo-equal short-circuit that bounds diamond re-runs — AC-7). `null` for an effect,
   * which the scheduler runs directly. Defined in `computed.ts` (it owns the value type `T`).
   */
  recompute: (() => void) | null;
}

/**
 * Internal: a node in the disposal tree (AR-03). Disposing an owner tears down, depth-first,
 * every child scope and every computation created under it.
 */
export interface Owner {
  /** Parent scope, or `null` at a root (`createRoot`). */
  owner: Owner | null;
  /** Computations created directly under this scope. */
  readonly owned: Computation[];
  /** Nested owner scopes (`createRoot`, a `Show` branch, a `For` item). */
  readonly children: Owner[];
  /** `onCleanup` callbacks registered directly on this owner; fired once at disposal. */
  cleanups: Array<() => void>;
  /** `true` once disposed; further disposes are no-ops (idempotent). */
  disposed: boolean;
}
