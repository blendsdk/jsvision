/**
 * The caller-provided persistence seam for layout variants. The grid holds **no** variant registry; an
 * app passes a {@link VariantStore} that the personalization dialog reads and writes, and a reference
 * in-memory implementation ({@link createMemoryVariantStore}) ships for showcases and tests. Back the
 * store with a file or database in a real app by implementing the same five methods.
 */
import type { GridVariant } from './variant.js';

/**
 * The app-provided store the personalization dialog reads and writes variants through. A synchronous
 * snapshot contract: `list()`/`getDefault()` return the current in-memory state, and
 * `save`/`delete`/`setDefault` mutate it (the dialog re-reads `list()` after each). An app backing the
 * store with a file or database hydrates it before opening the dialog.
 */
export interface VariantStore {
  /** All saved variants, in app/insertion order. A snapshot the dialog renders; not aliased to any internal array. */
  list(): readonly GridVariant[];
  /** Insert a variant, or overwrite the existing one with the same `name` (in place, order preserved). */
  save(variant: GridVariant): void;
  /** Remove the variant with this name (a no-op if absent). If it was the default, the default is cleared. */
  delete(name: string): void;
  /** Mark the named variant the default (the store persists the name; it need not already exist). */
  setDefault(name: string): void;
  /** The default variant's name, or `undefined` when none is set. */
  getDefault(): string | undefined;
}

/**
 * A reference in-memory {@link VariantStore} — an array of variants plus an optional default name. Real
 * persistence is the app's job; this one is enough for a showcase or a test. `save` overwrites by name
 * (order preserved on replace, appended for a new name), `delete` of the current default clears the
 * default, and `list()` returns a fresh copy so a caller cannot mutate the store's array in place.
 *
 * @param initial Variants to seed the store with (defensively copied); no default is set initially.
 * @returns A live in-memory store.
 * @example
 * ```ts
 * const store = createMemoryVariantStore([compact, wide]);
 * store.setDefault('compact');
 * store.getDefault();      // 'compact'
 * store.delete('compact'); // removes it AND clears the default
 * store.getDefault();      // undefined
 * ```
 */
export function createMemoryVariantStore(initial?: readonly GridVariant[]): VariantStore {
  const variants: GridVariant[] = initial ? [...initial] : [];
  let defaultName: string | undefined;

  return {
    list() {
      return [...variants]; // defensive copy — the store's array is never aliased out
    },
    save(variant) {
      const idx = variants.findIndex((v) => v.name === variant.name);
      if (idx >= 0)
        variants[idx] = variant; // overwrite in place, order preserved
      else variants.push(variant); // a new name is appended
    },
    delete(name) {
      const idx = variants.findIndex((v) => v.name === name);
      if (idx < 0) return; // absent → silent no-op
      variants.splice(idx, 1);
      if (defaultName === name) defaultName = undefined; // deleting the default clears it
    },
    setDefault(name) {
      defaultName = name;
    },
    getDefault() {
      return defaultName;
    },
  };
}
