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
