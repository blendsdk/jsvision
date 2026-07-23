/**
 * Implementation tests for the frame-bench helpers.
 *
 * Covers pure statistics, non-mutation, measurement shape, and the execution
 * environments where wall-clock budgets are reliable. Importing the helper
 * never starts its command-line benchmark.
 */
import { test, expect } from 'vitest';
import { median, p95, measureComposeDiff, perfBudgetMode } from '../bench/frame-bench.mjs';

test('median: odd-length input returns the middle value', () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([5, 1, 3, 2, 4])).toBe(3);
});

test('median: even-length input returns the mean of the two middle values', () => {
  expect(median([4, 1, 3, 2])).toBe(2.5); // sorted [1,2,3,4] → (2+3)/2
  expect(median([10, 20])).toBe(15);
});

test('median: unsorted input is handled and the input is not mutated', () => {
  const input = [9, 1, 5, 3, 7];
  expect(median(input)).toBe(5);
  expect(input).toStrictEqual([9, 1, 5, 3, 7]);
});

test('p95: nearest-rank picks the value at ceil(0.95·n)', () => {
  // n=20 → ceil(19) = 19th element (index 18) of [1..20] = 19.
  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  expect(p95(twenty)).toBe(19);
  // n=100 → ceil(95) = 95th element of [1..100] = 95.
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  expect(p95(hundred)).toBe(95);
});

test('p95: a single sample returns that sample (rank clamped to ≥1)', () => {
  expect(p95([42])).toBe(42);
});

test('measureComposeDiff: returns a positive, finite median over warmed runs', () => {
  const ms = measureComposeDiff(40, 12, 10);
  expect(Number.isFinite(ms)).toBeTruthy();
  expect(ms > 0).toBeTruthy();
});

test('perfBudgetMode: asserts only outside CI, Turbo, and explicit skips', () => {
  expect(perfBudgetMode({})).toBe('assert');
  expect(perfBudgetMode({ CI: 'true' })).toBe('log');
  expect(perfBudgetMode({ TUI_SKIP_PERF: '1' })).toBe('log');
  expect(perfBudgetMode({ TURBO_HASH: 'abc123' })).toBe('log');
  expect(perfBudgetMode({ TURBO_IS_TUI: 'true' })).toBe('assert');
  expect(perfBudgetMode({ CI: '', TUI_SKIP_PERF: '', TURBO_HASH: '' })).toBe('assert');
});
