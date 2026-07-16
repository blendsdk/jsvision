/**
 * Package-internal seam mapping each field handle to a closure that marks it touched.
 *
 * The public {@link Field} surface exposes `touched()` as a read-only getter with no setter, so
 * `bindField` needs a private channel to flip touched without widening the handle shape. The map is
 * keyed by the handle object itself: keying by identity (`object`) rather than by the handle's
 * `Signal` sidesteps `Signal` type invariance, so both the store (registering a `Field<unknown>`)
 * and `bindField` (looking up a `Field<T>`) reach the same entry with no cast or `any`. The closure
 * writes the exact touched signal that `field.touched()` reads and that `reset()`/`submit()` drive,
 * so touched has a single source of truth.
 *
 * Deliberately NOT re-exported from the package barrel — this is wiring between `createForm` and
 * `bindField`, not public API.
 */
export const touchedSinks = new WeakMap<object, () => void>();
