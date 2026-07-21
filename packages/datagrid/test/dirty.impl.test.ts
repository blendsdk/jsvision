/**
 * Implementation tests — dirty-registry internals: reactive `add`/`delete` drive an effect re-run
 * (the fresh-`Set` reference on every mutation is what makes reactive readers — the marker overpaint
 * and the rollups — re-run), the NUL-joined `cellKey` keeps distinct cells from colliding, and the
 * row/grid dirtiness rollups compute correctly over the pending set.
 *
 * The container's public `isRowDirty`/`isGridDirty` are spec-tested with the container itself; here
 * we verify the registry-level logic they build on (a `rowKey`-prefix match and a non-empty set).
 */
import { test, expect } from 'vitest';
import { createRoot, effect } from '@jsvision/ui';
import { createDirtyRegistry, cellKey } from '../src/editing.js';

/** The NUL byte the cell key joins on — cannot occur in a realistic row key or column id. */
const NUL = String.fromCharCode(0);

/** Whether any pending cell belongs to `rowKey` — the row-rollup primitive (`rowKey` + NUL prefix). */
function isRowDirty(keys: ReadonlySet<string>, rowKey: string | number): boolean {
  const prefix = cellKey(rowKey, ''); // `${rowKey}${NUL}` — the whole-row prefix
  for (const k of keys) if (k.startsWith(prefix)) return true;
  return false;
}

// Reactive readers re-run on add and delete; an idempotent mutation publishes no fresh ref, so it
// does not re-run them.
test('the registry drives reactive readers on add and delete, and only on a real change', () => {
  const dirty = createDirtyRegistry();
  const ck = cellKey(1, 'name');
  const seen: number[] = [];
  createRoot((dispose) => {
    effect(() => {
      seen.push(dirty.keys().size); // read → subscribe to the registry signal
    });
    expect(seen).toEqual([0]); // initial synchronous run
    dirty.add(ck);
    expect(seen).toEqual([0, 1]); // re-ran on add
    dirty.add(ck); // already present — no fresh ref, no re-run
    expect(seen).toEqual([0, 1]);
    dirty.delete(ck);
    expect(seen).toEqual([0, 1, 0]); // re-ran on delete
    dirty.delete(ck); // absent — no re-run
    expect(seen).toEqual([0, 1, 0]);
    dispose();
  });
});

// After disposal the effect no longer re-runs — the registry holds no live subscription.
test('a disposed reader stops re-running on later mutations', () => {
  const dirty = createDirtyRegistry();
  const seen: number[] = [];
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    effect(() => {
      seen.push(dirty.keys().size);
    });
  });
  expect(seen).toEqual([0]);
  dispose();
  dirty.add(cellKey(1, 'name'));
  expect(seen).toEqual([0]); // no re-run after disposal
});

// The NUL separator keeps distinct (rowKey, columnId) pairs from colliding even when their string
// concatenations would otherwise be equal.
test('cellKey joins on a NUL byte so distinct cells never collide', () => {
  expect(cellKey(1, 'name')).toBe(`1${NUL}name`);
  expect(cellKey('1', 'name')).toBe(cellKey(1, 'name')); // numeric/string row keys normalize alike
  // Without a separator both would be "12name"; the NUL byte keeps them distinct.
  expect(cellKey(1, '2name')).not.toBe(cellKey(12, 'name'));
});

// isGridDirty ≡ the pending set is non-empty; isRowDirty ≡ some key carries the row's NUL prefix.
test('the row/grid rollups read the pending set correctly', () => {
  const dirty = createDirtyRegistry();
  expect(dirty.keys().size > 0).toBe(false); // grid clean
  dirty.add(cellKey(1, 'name'));
  dirty.add(cellKey(1, 'email'));
  dirty.add(cellKey(12, 'name')); // a row whose key has row 1's key as a string prefix
  expect(dirty.keys().size > 0).toBe(true); // grid dirty
  expect(isRowDirty(dirty.keys(), 1)).toBe(true); // row 1 has pending cells
  expect(isRowDirty(dirty.keys(), 12)).toBe(true); // row 12 has a pending cell
  expect(isRowDirty(dirty.keys(), 3)).toBe(false); // row 3 has none
  // Row 1's prefix ("1\0") must NOT match row 12's cell ("12\0name") across the NUL boundary.
  dirty.delete(cellKey(1, 'name'));
  dirty.delete(cellKey(1, 'email'));
  expect(isRowDirty(dirty.keys(), 1)).toBe(false); // only the row-12 cell remains → row 1 is clean
});
