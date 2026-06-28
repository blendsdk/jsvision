/**
 * Specification test (immutable oracle) — ADR-008, cell-native layout.
 *
 * The decisive claim the ADR commits to: a row of flex (`fr`) children fills its
 * container **exactly** — every cell accounted for, no 1-cell gap or overlap at
 * flex boundaries (the float-rounding failure mode of Yoga/Ink). These
 * expectations derive from that requirement, not from the implementation.
 */
import { test, expect } from 'vitest';
import { apportion, solveTrack, type TrackItem } from '../src/layout/index.js';

test('equal fr children fill exactly; leftover goes to the earliest (no gap)', () => {
  // 80 cells across 3 equal columns = 26.67 each → 27,27,26 (sums to 80, not 78).
  expect(apportion(80, [1, 1, 1])).toEqual([27, 27, 26]);
});

test('weighted fr split proportionally and exactly', () => {
  expect(apportion(80, [2, 1, 1])).toEqual([40, 20, 20]);
});

test('tight widths still fill exactly', () => {
  expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
});

test('a flex row fills the container to the edge for every width 1..400', () => {
  for (let total = 1; total <= 400; total++) {
    const sizes = apportion(total, [3, 1, 1, 2]);
    const sum = sizes.reduce((a, b) => a + b, 0);
    expect(sum).toBe(total); // no gap, no overflow — fills exactly
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0); // no negative width
  }
});

test('solveTrack: fixed + flex + gap fills the track exactly', () => {
  const items: TrackItem[] = [
    { kind: 'fixed', size: 10 },
    { kind: 'flex', weight: 1 },
    { kind: 'flex', weight: 1 },
  ];
  const gap = 2;
  const sizes = solveTrack(80, items, gap);
  expect(sizes).toEqual([10, 33, 33]);
  const used = sizes.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  expect(used).toBe(80); // content + gaps == container, exactly
});
