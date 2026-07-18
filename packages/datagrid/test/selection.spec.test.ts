/**
 * Specification tests (immutable oracles) — the pure, view-free selection model `selection.ts`
 * (RD-08; plan doc plans/rows-selection/03-01, 07-testing-strategy ST-1 … ST-7).
 *
 * The selection ops are pure transforms over a `ReadonlySet<Key>` and a display-order key list: they
 * never mutate their input and always return a NEW set, so the container can `selectedKeys.set(next)`
 * and drive reactive repaint. `single` mode holds at most one key; `multi` accumulates. A range is
 * taken in display order and is order-independent (anchor before or after the target selects the same
 * rows). A stale anchor (a key absent from the current display) degrades to selecting just the target.
 *
 * Expectations derive from the requirements/spec docs, never from the implementation. The `.js` import
 * specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { toggleKey, selectRange, selectAll, triState } from '../src/selection.js';
import type { Key } from '../src/selection.js';

/** Sorted array view of a set, for order-independent membership assertions. */
function keys(set: ReadonlySet<Key>): Key[] {
  return [...set].sort();
}

// ST-1 — multi toggle: an absent key is added, a present key is removed.
test('ST-1: multi toggle adds an absent key, then removes it on the second toggle', () => {
  const added = toggleKey(new Set<string>(), 'a', 'multi');
  expect(keys(added)).toEqual(['a']); // added

  const removed = toggleKey(added, 'a', 'multi');
  expect(keys(removed)).toEqual([]); // removed
});

// ST-2 — single toggle of an absent key REPLACES the set with just that key (≤1 key).
test('ST-2: single toggle replaces the selection with just the new key', () => {
  const out = toggleKey(new Set<string>(['a']), 'b', 'single');
  expect(keys(out)).toEqual(['b']); // single replaces, never accumulates
});

// ST-3 — a multi range is the contiguous run between anchor and target, in display order.
test('ST-3: selectRange selects the contiguous display-order run (anchor before target)', () => {
  const out = selectRange(new Set<string>(), 'a', 'c', ['a', 'b', 'c', 'd'], 'multi');
  expect(keys(out)).toEqual(['a', 'b', 'c']);
});

// ST-4 — the range is order-independent: anchor AFTER the target selects the same rows.
test('ST-4: selectRange is order-independent (anchor after target selects the same run)', () => {
  const out = selectRange(new Set<string>(), 'c', 'a', ['a', 'b', 'c', 'd'], 'multi');
  expect(keys(out)).toEqual(['a', 'b', 'c']);
});

// ST-5 — selectAll selects every displayed key; clear is `new Set()` at the call site.
test('ST-5: selectAll selects every displayed key; a cleared set is empty', () => {
  const all = selectAll(['a', 'b', 'c']);
  expect(keys(all)).toEqual(['a', 'b', 'c']);

  const cleared = new Set<string>();
  expect(keys(cleared)).toEqual([]);
});

// ST-6 — the header tri-state over the displayed rows: none / some / all.
test('ST-6: triState reports none / some / all over the displayed rows', () => {
  const display = ['a', 'b', 'c'];
  expect(triState(new Set(['a', 'b']), display)).toBe('some');
  expect(triState(new Set(['a', 'b', 'c']), display)).toBe('all');
  expect(triState(new Set<string>(), display)).toBe('none');
});

// ST-7 — single-mode range collapses to the target; a stale anchor degrades to just the target.
test('ST-7: single range collapses to the target; a stale anchor degrades to the target', () => {
  const single = selectRange(new Set<string>(), 'a', 'c', ['a', 'b', 'c', 'd'], 'single');
  expect(keys(single)).toEqual(['c']); // single can't hold a range → just the target

  const stale = selectRange(new Set<string>(), 'x', 'b', ['a', 'b'], 'multi');
  expect(keys(stale)).toEqual(['b']); // anchor 'x' is not displayed → select just the target
});
