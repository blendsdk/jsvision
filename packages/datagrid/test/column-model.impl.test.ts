/**
 * Implementation tests — edges of the pure column-layout model (`column-model.ts`) beyond the
 * specification oracles in `column-model.spec.test.ts`.
 */
import { test, expect } from 'vitest';
import { visibleOrder, partition, reorderWithinPanel, clampWidth, overPinnedIds } from '../src/column-model.js';

test('visibleOrder: empty order → empty', () => {
  expect(visibleOrder([], new Set())).toEqual([]);
  expect(visibleOrder([], new Set(['a']))).toEqual([]);
});

test('partition: no freeze spec → everything is center', () => {
  expect(partition(['a', 'b'], {})).toEqual({ left: [], center: ['a', 'b'], right: [] });
});

test('partition: freeze:0 → all center; freeze beyond length → all left', () => {
  expect(partition(['a', 'b'], { freeze: 0 })).toEqual({ left: [], center: ['a', 'b'], right: [] });
  expect(partition(['a', 'b'], { freeze: 9 })).toEqual({ left: ['a', 'b'], center: [], right: [] });
});

test('partition: an id in both freezeLeft and freezeRight goes to the right (right wins)', () => {
  const p = partition(['a', 'b'], { freezeLeft: ['a', 'b'], freezeRight: ['b'] });
  expect(p).toEqual({ left: ['a'], center: [], right: ['b'] });
});

test('partition: empty visible → all empty', () => {
  expect(partition([], { freeze: 2 })).toEqual({ left: [], center: [], right: [] });
});

test('reorderWithinPanel: no-op and out-of-range moves return the order unchanged', () => {
  expect(reorderWithinPanel(['a', 'b', 'c'], {}, 1, 1)).toEqual(['a', 'b', 'c']); // same index
  expect(reorderWithinPanel(['a', 'b', 'c'], {}, -1, 0)).toEqual(['a', 'b', 'c']); // from out of range
  expect(reorderWithinPanel(['a', 'b', 'c'], {}, 0, 5)).toEqual(['a', 'b', 'c']); // to out of range
});

test('reorderWithinPanel: moves within the right panel', () => {
  // freezeRight:['c','d'] → left=[], center=[a,b], right=[c,d] at indices 2,3. Move 3→2.
  expect(reorderWithinPanel(['a', 'b', 'c', 'd'], { freezeRight: ['c', 'd'] }, 3, 2)).toEqual(['a', 'b', 'd', 'c']);
});

test('clampWidth: when min > max, the max wins', () => {
  expect(clampWidth(10, 20, 5)).toBe(5); // floor 20 then cap 5 → 5
});

test('overPinnedIds: peels the left side innermost-first until the center fits', () => {
  // left=[a,b], right=[c], each 10 wide, viewport 12 → frozen must drop under 11 (reserve ≥1 center).
  const dropped = overPinnedIds({ left: ['a', 'b'], center: ['x'], right: ['c'] }, () => 10, 12);
  // 30 ≥ 11 → drop 'b'; 20 ≥ 11 → drop 'a'; 10 < 11 → stop ('c' stays frozen, center gets 2 cells).
  expect(dropped).toEqual(['b', 'a']);
});

test('overPinnedIds: zero-width frozen columns never trigger a drop', () => {
  expect(overPinnedIds({ left: ['a', 'b'], center: ['c'], right: [] }, () => 0, 10)).toEqual([]);
});
