/**
 * Reactive core (RD-01) — fine-grained, Solid-style reactivity for `@jsvision/ui`.
 *
 * The reactivity layer of the disciplined-hybrid model: a value change surgically
 * notifies exactly the computations that read it — no tree diff, no virtual DOM.
 * UI-independent (no rendering, no widget types); RD-03 binds an effect to a widget
 * redraw on top of these primitives.
 *
 * Public surface (re-exported through the package entry point `@jsvision/ui`):
 * `signal` · `computed` · `effect` · `batch` · `untrack` · `onCleanup` ·
 * `createRoot` · `Show` · `For` · `ReactiveCycleError`, plus the types `Signal<T>`,
 * `Computed<T>`, `EqualsOption<T>`.
 *
 * Layering (foundation-first): `types` → `errors`/`warnings` → `scheduler`/`owner`
 * → `signal`/`computed`/`effect` → `show`/`for` → this barrel.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution
 * (it resolves to the `.ts` source during development).
 */

// Public types (AR-01, AR-05, AR-06).
export type { Signal, Computed, EqualsOption } from './types.js';

// Reactive primitives: signals, computeds, effects, scheduling helpers, ownership.
export { signal } from './signal.js';
export type { SignalOptions } from './signal.js';
export { computed } from './computed.js';
export type { ComputedOptions } from './computed.js';
export { effect } from './effect.js';
export { batch, untrack } from './scheduler.js';
export { createRoot, onCleanup } from './owner.js';
export { ReactiveCycleError } from './errors.js';

// Phase 3 adds `Show`/`For` — exported here as they land.
