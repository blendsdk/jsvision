/**
 * Implementation tests (edges/internals) — the pure selection model `selection.ts`.
 *
 * The spec oracles (`selection.spec.test.ts`, ST-1 … ST-7) pin the requirement behaviour; these cover
 * the boundary cases a caller can still hit: an absent-key toggle in each mode, an anchor==target
 * range, a whole-display range, tri-state over an empty display, and the non-mutation guarantee.
 *
 * The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { toggleKey, selectRange, selectAll, triState } from '../src/selection.js';
import type { Key } from '../src/selection.js';

function keys(set: ReadonlySet<Key>): Key[] {
  return [...set].sort();
}

test('an absent key: single replaces, multi accumulates', () => {
  const single = toggleKey(new Set<string>(['a']), 'b', 'single');
  expect(keys(single)).toEqual(['b']); // single drops 'a'

  const multi = toggleKey(new Set<string>(['a']), 'b', 'multi');
  expect(keys(multi)).toEqual(['a', 'b']); // multi keeps 'a'
});

test('single toggle of the already-selected key clears the selection', () => {
  const out = toggleKey(new Set<string>(['a']), 'a', 'single');
  expect(keys(out)).toEqual([]);
});

test('a range where anchor == target selects just that one row', () => {
  const out = selectRange(new Set<string>(), 'b', 'b', ['a', 'b', 'c'], 'multi');
  expect(keys(out)).toEqual(['b']);
});

test('a range spanning the whole display selects every displayed key', () => {
  const out = selectRange(new Set<string>(), 'a', 'd', ['a', 'b', 'c', 'd'], 'multi');
  expect(keys(out)).toEqual(['a', 'b', 'c', 'd']);
});

test('a multi range unions onto (does not replace) the current selection', () => {
  const out = selectRange(new Set<string>(['z']), 'a', 'b', ['a', 'b', 'c'], 'multi');
  expect(keys(out)).toEqual(['a', 'b', 'z']); // pre-existing 'z' survives
});

test('selectAll over an empty display yields an empty set', () => {
  expect(keys(selectAll([]))).toEqual([]);
});

test('triState is none for an empty display and none when a selected key is off-display', () => {
  expect(triState(new Set<string>(), [])).toBe('none');
  expect(triState(new Set(['x']), [])).toBe('none'); // 'x' is not displayed
  expect(triState(new Set(['x']), ['a', 'b'])).toBe('none'); // selection has no displayed key
});

test('the ops never mutate their input set', () => {
  const src = new Set<string>(['a']);
  toggleKey(src, 'b', 'multi');
  selectRange(src, 'a', 'a', ['a'], 'multi');
  expect(keys(src)).toEqual(['a']); // unchanged
});
