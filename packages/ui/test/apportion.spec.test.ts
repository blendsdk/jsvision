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

// ---------------------------------------------------------------------------
// Minimum-size support for the flex track (split-panes feature).
//
// A flex item may carry an optional `min` cell floor it is never solved below.
// `solveTrack` runs today's apportion line unchanged when no item carries a
// min (the no-min fast path), and delegates to the pin-to-fixpoint solver only
// when a min is present. Every expectation below was hand-computed from that
// algorithm and the existing largest-remainder arithmetic — not read off the
// implementation. Ids are qualified `ST-N (split-panes)` because this file
// carries other, plain-named cases; the number space is per-feature.
// ---------------------------------------------------------------------------

test('ST-1 (split-panes): no item carries a min → byte-identical to today (regression oracle)', () => {
  const items: TrackItem[] = [
    { kind: 'fixed', size: 5 },
    { kind: 'flex', weight: 1 },
    { kind: 'flex', weight: 1 },
  ];
  // The existing solveTrack JSDoc golden — the fast path must not perturb it.
  expect(solveTrack(20, items)).toEqual([5, 8, 7]);
});

test('ST-2 (split-panes): a binding minimum pins its pane; the rest splits the remainder', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 15 },
    { kind: 'flex', weight: 1 },
  ];
  // Naive apportion would give [10, 10]; the min pins the first pane at 15.
  expect(solveTrack(20, items)).toEqual([15, 5]); // sums to exactly 20
});

test('ST-3 (split-panes): unsatisfiable minimums squeeze proportionally, never overflow', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 8 },
    { kind: 'flex', weight: 1, min: 8 },
  ];
  // Σmin (16) > free (10): squeeze via apportion(10, [8, 8]) → [5, 5], NOT [8, 8]
  // (which would overflow the 10-cell track and create wrong click targets).
  expect(solveTrack(10, items)).toEqual([5, 5]); // sums to exactly 10
});

test('ST-4 (split-panes): apportion is the identity when weights already sum to the total', () => {
  // The property AR-6 leans on for exact 1-cell drag fidelity: at steady state
  // a 1-cell pointer move moves the divider exactly 1 cell — never 0, never 2.
  expect(apportion(79, [37, 42])).toEqual([37, 42]);
});

test('ST-5 (split-panes): two minimums bind at once; the remainder goes to the unpinned item', () => {
  const items: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 12 },
    { kind: 'flex', weight: 1, min: 12 },
    { kind: 'flex', weight: 8 },
  ];
  // Naive apportion gives [3, 3, 24]; both mins pin, the free remainder (6) is
  // the unpinned item's alone.
  expect(solveTrack(30, items)).toEqual([12, 12, 6]); // sums to exactly 30
});

test('ST-6 (split-panes): a single minimum larger than the whole track squeezes to the track', () => {
  const items: TrackItem[] = [{ kind: 'flex', weight: 1, min: 10 }];
  expect(solveTrack(5, items)).toEqual([5]); // sums to exactly 5, no overflow
});

test('ST-7 (split-panes): min:0 and min:undefined are equivalent and both take the fast path', () => {
  const withZero: TrackItem[] = [
    { kind: 'flex', weight: 1, min: 0 },
    { kind: 'flex', weight: 1 },
  ];
  const withNone: TrackItem[] = [
    { kind: 'flex', weight: 1 },
    { kind: 'flex', weight: 1 },
  ];
  expect(solveTrack(20, withZero)).toEqual([10, 10]);
  expect(solveTrack(20, withNone)).toEqual([10, 10]);
});
