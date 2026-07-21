<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Reactivity

Signals, computeds, effects, and reactive control flow.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## batch

Coalesce multiple writes into a single update.

```ts
batch<T>(fn: () => T): T
```

## computed

Create a lazy, memoized derived value.

```ts
computed<T>(fn: () => T, options?: ComputedOptions<T>): Computed<T>
```

## Computed

A read-only derived value: lazy + memoized.

```ts
interface Computed<T> {
  peek(): T;   // Read the cached value **without** subscribing the running computation.
}
```

## ComputedOptions

Options for computed.

```ts
interface ComputedOptions<T> {
  equals?: EqualsOption<T>;   // How the computed decides whether a recompute changed the value: a predicate returning `true` when the new value counts as equal (equal ⇒ observers are not notified), or `false` to notify on every recompute. Defaults to `Object.is`.
}
```

## createRoot

Open a root reactive scope and run `fn` inside it.

```ts
createRoot<T>(fn: (dispose: () => void) => T): T
```

## effect

Register a reactive side effect and run it once immediately.

```ts
effect(fn: () => void): void
```

## EqualsOption

The change-equality policy for a signal or computed.

```ts
type EqualsOption<T> = false | ((a: T, b: T) => boolean)
```

## For

Map a reactive list of items to a reconciled, keyed list of nodes.

```ts
For<T, N>(each: () => readonly T[], key: (item: T, index: number) => unknown, render: (item: T, index: () => number) => N): () => N[]
```

## getOwner

Get the current reactive owner scope, or `null` if no scope is active.

```ts
getOwner(): Owner | null
```

## onCleanup

Register a teardown callback that runs when the surrounding reactive lifetime ends.

```ts
onCleanup(cb: () => void): void
```

## Owner

Internal: a node in the disposal tree.

```ts
interface Owner {
  owner: Owner | null;   // Parent scope, or `null` at a root (`createRoot`).
  owned: Computation[];   // Computations created directly under this scope.
  children: Owner[];   // Nested owner scopes (a `createRoot`, a `Show` branch, a `For` item).
  cleanups: Array<() => void>;   // `onCleanup` callbacks registered directly on this owner; fired once at disposal.
  disposed: boolean;   // `true` once disposed; further disposes are no-ops (idempotent).
}
```

## ReactiveCycleError

Thrown when reactive propagation fails to settle within its fixed iteration limit — almost always because an effect writes a signal it also depends on, creating an update loop that never converges.

```ts
new ReactiveCycleError(iterationLimit: number, detail?: string)   // extends TuiError
// methods & signals:
iterationLimit: number
```

## runWithOwner

Run `fn` with `owner` as the active scope, then restore the previous scope.

```ts
runWithOwner<T>(owner: Owner | null, fn: () => T): T
```

## Show

Choose between two branches based on a reactive condition.

```ts
Show<N>(when: () => boolean, then: () => N, else_?: () => N): () => N | undefined
```

## signal

Create a writable reactive value.

```ts
signal<T>(initial: T, options?: SignalOptions<T>): Signal<T>
```

## Signal

A writable reactive value.

```ts
interface Signal<T> {
  set(value: T): void;   // Replace the value; notifies subscribers unless the new value is equal under the equality policy.
  update(fn: (previous: T) => T): void;   // Replace the value derived from its predecessor; `update(fn)` is `set(fn(peek()))`.
  peek(): T;   // Read the current value **without** subscribing the running computation.
}
```

## SignalOptions

Options for signal.

```ts
interface SignalOptions<T> {
  equals?: EqualsOption<T>;   // How the signal decides whether a write changed the value: a predicate returning `true` when the new value counts as equal to the old (equal ⇒ nothing is notified), or `false` to treat every write as a change (always notify). Defaults to `Object.is`.
}
```

## untrack

Run `fn` without subscribing the current computation to anything it reads.

```ts
untrack<T>(fn: () => T): T
```
