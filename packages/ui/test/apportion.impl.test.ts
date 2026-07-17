/**
 * Implementation test — edge cases and degenerate inputs for the layout
 * apportionment core (ADR-008). Complements the spec oracle.
 */
import { test, expect } from 'vitest';
import { apportion, solveTrack, type TrackItem } from '../src/layout/index.js';

test('zero or negative total yields all zeros', () => {
  expect(apportion(0, [1, 1])).toEqual([0, 0]);
  expect(apportion(-5, [1, 1])).toEqual([0, 0]);
});

test('empty inputs return empty arrays', () => {
  expect(apportion(10, [])).toEqual([]);
  expect(solveTrack(10, [])).toEqual([]);
});

test('no positive weight distributes nothing', () => {
  expect(apportion(10, [0, 0])).toEqual([0, 0]);
  expect(apportion(10, [-1, -2])).toEqual([0, 0]);
});

test('a single flex child takes everything', () => {
  expect(apportion(7, [5])).toEqual([7]);
});

test('solveTrack without flex does not stretch fixed items', () => {
  const items: TrackItem[] = [
    { kind: 'fixed', size: 10 },
    { kind: 'fixed', size: 20 },
  ];
  // Leftover space is left for justify/align to place later, not absorbed here.
  expect(solveTrack(80, items)).toEqual([10, 20]);
});

test('solveTrack clamps flex to zero when fixed content overflows', () => {
  const items: TrackItem[] = [
    { kind: 'fixed', size: 10 },
    { kind: 'flex', weight: 1 },
  ];
  // free = 5 - 10 < 0 → flex gets 0; fixed keeps its size (overflow handled later).
  expect(solveTrack(5, items)).toEqual([10, 0]);
});

// --- Minimum-size support (apportionMin, reached through solveTrack) ----------

test('min: three floors bind at once; the remainder goes to the unpinned item', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 15 },
    { kind: 'flex', weight: 1, min: 15 },
    { kind: 'flex', weight: 1, min: 15 },
    { kind: 'flex', weight: 1 },
  ];
  // Naive apportion gives [13,13,12,12]; the first three pin at 15, the free 5 is the last pane's.
  const sizes = solveTrack(50, items);
  expect(sizes).toEqual([15, 15, 15, 5]);
  expect(sizes.reduce((a, b) => a + b, 0)).toBe(50);
});

test('min: the fixpoint defers to apportion for tie-breaking (leftover to the earliest)', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 1 },
    { kind: 'flex', weight: 1, min: 1 },
    { kind: 'flex', weight: 1, min: 1 },
  ];
  // Nothing binds (all ≥ 1), so the min path must reproduce apportion(11,[1,1,1]) = [4,4,3].
  expect(solveTrack(11, items)).toEqual([4, 4, 3]);
});

test('min: a zero-weight item takes its floor; the residue stays unfilled', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 0, min: 5 },
    { kind: 'flex', weight: 0 },
  ];
  // No positive weight to absorb the remainder — the min-carrying item gets 5, the rest is
  // left unfilled, consistent with apportion's all-zero-weight behaviour.
  const sizes = solveTrack(20, items);
  expect(sizes).toEqual([5, 0]);
  expect(sizes.reduce((a, b) => a + b, 0)).toBe(5); // 15 cells deliberately unfilled
});

test('min interacts correctly with gap: sizes + gaps still fill the track exactly', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 15 },
    { kind: 'flex', weight: 1 },
  ];
  const sizes = solveTrack(21, items, 1);
  expect(sizes).toEqual([15, 5]);
  expect(sizes.reduce((a, b) => a + b, 0) + 1 * (items.length - 1)).toBe(21);
});

test('min alongside fixed items: fixed is inviolable, only flex squeezes to honour the floor', () => {
  const items: TrackItem[] = [
    { kind: 'fixed', size: 10 },
    { kind: 'flex', weight: 1, min: 15 },
    { kind: 'flex', weight: 1 },
  ];
  // free = 20; the min pins the middle pane at 15, leaving 5 for the last; the fixed 10 is untouched.
  const sizes = solveTrack(30, items);
  expect(sizes).toEqual([10, 15, 5]);
  expect(sizes.reduce((a, b) => a + b, 0)).toBe(30);
});

test('min: every min configuration fills the track exactly across a range of widths', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 6 },
    { kind: 'flex', weight: 2, min: 4 },
    { kind: 'flex', weight: 1 },
  ];
  for (let total = 1; total <= 200; total++) {
    const sizes = solveTrack(total, items);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(total); // fills exactly at every width
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0); // never negative
    if (total >= 6 + 4) {
      // Once the floors fit, they are honoured (they only sink in the infeasible squeeze).
      expect(sizes[0]).toBeGreaterThanOrEqual(6);
      expect(sizes[1]).toBeGreaterThanOrEqual(4);
    }
  }
});
