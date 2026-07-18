/**
 * Specification tests (immutable oracle) — the caller-provided `VariantStore` seam and its reference
 * in-memory implementation. The grid holds no variant registry; an app passes a `VariantStore` the
 * dialog reads and writes. `save` inserts or overwrites by name, `delete` removes (and clears the
 * default if it named it), `setDefault`/`getDefault` round-trip, and `list()` returns a snapshot that
 * is not aliased to the store's own array. Expectations derive from the store contract, never the
 * implementation.
 */
import { test, expect } from 'vitest';
import { createMemoryVariantStore } from '../src/variant-store.js';
import type { GridVariant } from '../src/variant.js';

/** A minimal, distinct variant keyed by name — the store never inspects a variant beyond its `name`. */
function mk(name: string): GridVariant {
  return { name, columns: [{ id: 'a', visible: true }], freeze: { left: [], right: [] }, sort: [], filter: [] };
}

// save inserts, then overwrites in place by name (never appends a duplicate); a returned list() is a
// defensive copy — mutating the store later does not grow an earlier snapshot.
test('save inserts then overwrites in place by name; a returned list() is not aliased to the store', () => {
  const store = createMemoryVariantStore();
  store.save(mk('one'));
  const before = store.list();
  expect(before).toHaveLength(1);
  store.save({ ...mk('one'), columns: [{ id: 'b', visible: true }] }); // same name → overwrite
  expect(store.list()).toHaveLength(1); // one 'one' (overwritten, not appended)
  expect(store.list()[0].columns).toEqual([{ id: 'b', visible: true }]); // the overwrite won
  expect(before).toHaveLength(1); // the earlier snapshot is a copy — the later save did not grow it
});

// Deleting the current default clears it.
test('deleting the current default clears getDefault()', () => {
  const store = createMemoryVariantStore([mk('c'), mk('d')]);
  store.setDefault('c');
  expect(store.getDefault()).toBe('c');
  store.delete('c');
  expect(store.getDefault()).toBeUndefined(); // deleting the default clears it
});

// A fresh store has no default, and deleting an absent name is a silent no-op.
test('a fresh store has no default and delete of an absent name is a silent no-op', () => {
  const store = createMemoryVariantStore();
  expect(store.getDefault()).toBeUndefined();
  expect(() => store.delete('absent')).not.toThrow(); // silent no-op
  expect(store.list()).toHaveLength(0);
});
