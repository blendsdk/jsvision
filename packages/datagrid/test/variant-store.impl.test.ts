/**
 * Implementation tests — the reference in-memory VariantStore's edges: the seed array is defensively
 * copied (mutating the caller's array afterward does not leak in), overwrite replaces in place
 * (insertion order preserved), and setDefault of an absent name is stored verbatim (the reference impl
 * does not validate that the name exists — a store may set a default it is about to save).
 */
import { test, expect } from 'vitest';
import { createMemoryVariantStore } from '../src/variant-store.js';
import type { GridVariant } from '../src/variant.js';

function mk(name: string): GridVariant {
  return { name, columns: [{ id: 'a', visible: true }], freeze: { left: [], right: [] }, sort: [], filter: [] };
}

// The seed array is defensively copied — mutating the caller's array after construction does not leak in.
test('createMemoryVariantStore defensively copies the seed array', () => {
  const seed = [mk('one')];
  const store = createMemoryVariantStore(seed);
  seed.push(mk('two')); // mutate the caller's array after construction
  expect(store.list().map((v) => v.name)).toEqual(['one']); // the store did not observe the later push
});

// Overwrite replaces in place — the order of names is preserved, the replaced slot is not moved to the end.
test('save overwrite preserves insertion order (replace in place)', () => {
  const store = createMemoryVariantStore([mk('a'), mk('b'), mk('c')]);
  store.save({ ...mk('b'), columns: [{ id: 'z', visible: false }] }); // overwrite the middle one
  expect(store.list().map((v) => v.name)).toEqual(['a', 'b', 'c']); // 'b' stayed in place
  expect(store.list()[1].columns).toEqual([{ id: 'z', visible: false }]); // with the new content
});

// setDefault records a name even if no such variant exists yet; getDefault returns it verbatim.
test('setDefault of an absent name is stored (no existence validation)', () => {
  const store = createMemoryVariantStore();
  store.setDefault('not-saved-yet');
  expect(store.getDefault()).toBe('not-saved-yet');
});
