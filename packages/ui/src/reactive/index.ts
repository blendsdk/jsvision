/**
 * Reactive core — fine-grained, Solid-style reactivity for `@jsvision/ui`.
 *
 * A value change surgically re-runs exactly the effects and computeds that read it — no tree diff,
 * no virtual DOM. This layer is UI-independent (no rendering, no widget types); the view layer binds
 * effects to widget redraws on top of these primitives, but you can use them standalone for any
 * reactive state.
 *
 * The public surface (all re-exported through `@jsvision/ui`):
 * - `signal` — writable reactive value
 * - `computed` — lazy, memoized derived value
 * - `effect` — reactive side effect
 * - `batch` / `untrack` — coalesce writes / read without subscribing
 * - `createRoot` / `onCleanup` / `runWithOwner` / `getOwner` — scope & lifetime management
 * - `Show` / `For` — reactive conditional & keyed-list combinators
 * - `ReactiveCycleError` — thrown on a non-converging update loop
 * - the types `Signal<T>`, `Computed<T>`, `EqualsOption<T>`, and the opaque `Owner`
 */

export type { Signal, Computed, EqualsOption } from './types.js';

// Reactive primitives: signals, computeds, effects, scheduling helpers, ownership.
export { signal } from './signal.js';
export type { SignalOptions } from './signal.js';
export { computed } from './computed.js';
export type { ComputedOptions } from './computed.js';
export { effect } from './effect.js';
export { batch, untrack } from './scheduler.js';
export { createRoot, onCleanup, runWithOwner } from './owner.js';
export { getOwner } from './scheduler.js';
// `Owner` is an opaque token: pass it back to runWithOwner/getOwner; its fields are internal.
export type { Owner } from './types.js';
export { ReactiveCycleError } from './errors.js';

// Structural combinators.
export { Show } from './show.js';
export { For } from './for.js';
