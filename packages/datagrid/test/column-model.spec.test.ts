/**
 * Specification tests (immutable oracles) — the pure, view-free column-layout model `column-model.ts`
 * (RD-07 columns & layout; plan doc plans/columns-layout/03-01, 07-testing-strategy ST-1 … ST-7).
 *
 * The model owns the SHAPE of column-layout state (visible order, freeze partition, width clamp,
 * over-pin) as pure functions — no view state, no signals — the data-plane twin of `sort.ts`.
 * Expectations derive from the requirements/spec docs, never from the implementation. The `.js`
 * import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import {
  visibleOrder,
  partition,
  reorderWithinPanel,
  clampWidth,
  overPinnedIds,
  DEFAULT_MIN_WIDTH,
} from '../src/column-model.js';

// ST-1 — the visible order drops hidden ids and preserves the remaining order.
test('ST-1: visibleOrder drops hidden ids, preserves order', () => {
  expect(visibleOrder(['a', 'b', 'c'], new Set(['b']))).toEqual(['a', 'c']);
  expect(visibleOrder(['a', 'b', 'c'], new Set())).toEqual(['a', 'b', 'c']);
  expect(visibleOrder(['a', 'b', 'c'], new Set(['a', 'b', 'c']))).toEqual([]);
});

// ST-2 — partition groups the visible ids into left/center/right; unknown freeze ids are ignored.
test('ST-2: partition groups by freeze spec and ignores unknown freeze ids', () => {
  const p = partition(['a', 'b', 'c', 'd'], { freezeLeft: ['a', 'zzz'], freezeRight: ['d'] });
  expect(p).toEqual({ left: ['a'], center: ['b', 'c'], right: ['d'] });
});

// ST-3 — the `freeze: N` shorthand pins the first N visible columns to the left panel.
test('ST-3: partition with freeze:N pins the first N to the left panel', () => {
  expect(partition(['a', 'b', 'c'], { freeze: 2 })).toEqual({
    left: ['a', 'b'],
    center: ['c'],
    right: [],
  });
});

// ST-4 — reorder MOVES a column within its own panel (a center-panel move).
test('ST-4: reorderWithinPanel moves a column within its panel', () => {
  // freeze:1 → left=[a], center=[b,c,d]. Move index 2 (c) to index 1 (both center).
  expect(reorderWithinPanel(['a', 'b', 'c', 'd'], { freeze: 1 }, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
});

// ST-5 — a reorder that would cross the freeze boundary is REJECTED (order unchanged). (AC-2 data plane)
test('ST-5: reorderWithinPanel rejects a cross-boundary move (order unchanged)', () => {
  // freeze:1 → left=[a] (index 0), center=[b,c] (index 1,2). Moving index 1 (center) to 0 (left) crosses.
  expect(reorderWithinPanel(['a', 'b', 'c'], { freeze: 1 }, 1, 0)).toEqual(['a', 'b', 'c']);
});

// ST-6 — clampWidth floors to minWidth (default DEFAULT_MIN_WIDTH) and caps to maxWidth when set.
test('ST-6: clampWidth floors to min (default 3) and caps to max', () => {
  expect(clampWidth(1, 4, 20)).toBe(4); // below min → min
  expect(clampWidth(99, 4, 20)).toBe(20); // above max → max
  expect(clampWidth(10)).toBe(10); // in range, no limits → unchanged
  expect(clampWidth(1)).toBe(DEFAULT_MIN_WIDTH); // no min → default floor
});

// ST-7 — over-pin returns the innermost frozen ids to drop until the center keeps ≥ 1 cell; [] when it fits.
test('ST-7: overPinnedIds drops innermost frozen ids until the center fits; [] when it fits', () => {
  const wide = { left: ['a', 'b'], center: ['c'], right: [] };
  // each frozen col is 10 wide, viewport 15 → 20 ≥ 14, must drop the innermost (left's last = 'b').
  expect(overPinnedIds(wide, () => 10, 15)).toEqual(['b']);

  const fits = { left: ['a'], center: ['b', 'c'], right: [] };
  expect(overPinnedIds(fits, () => 5, 20)).toEqual([]); // 5 < 19 → nothing dropped
});
