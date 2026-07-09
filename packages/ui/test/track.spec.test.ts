/**
 * Specification test (immutable oracle) — the pure value↔position track math shared by `Slider` and
 * `ScrollBar` (ST-1…ST-4).
 *
 * These oracles pin the integer-cell mapping both controls depend on: a value in `[min, max]` maps to
 * a 0-based cell offset along a groove of `length` cells (thumb size 1 by default), and back. The
 * rounding is half-up via a `(range >> 1)` bias so the midpoint value lands on the centre cell. A
 * failing case here means the helper is wrong, never the oracle.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import { clampValue, valueToOffset, offsetToValue, stepValue } from '../src/controls/track.js';

test('ST-1: valueToOffset maps the midpoint value to the centre cell', () => {
  // length 11 ⇒ offsets 0..10; value 50 of [0,100] is the midpoint ⇒ cell 5.
  expect(valueToOffset({ min: 0, max: 100, length: 11 }, 50)).toBe(5);
});

test('ST-2: offsetToValue is 0 at the first cell, max at the last, and monotone between', () => {
  const spec = { min: 0, max: 100, length: 11 } as const;
  expect(offsetToValue(spec, 0)).toBe(0);
  expect(offsetToValue(spec, 10)).toBe(100);
  // Monotone non-decreasing across the whole groove.
  let prev = -Infinity;
  for (let off = 0; off <= 10; off += 1) {
    const v = offsetToValue(spec, off);
    expect(v).toBeGreaterThanOrEqual(prev);
    prev = v;
  }
});

test('ST-3: clampValue pins a value into [min, max]', () => {
  expect(clampValue({ min: 0, max: 255 }, -5)).toBe(0);
  expect(clampValue({ min: 0, max: 255 }, 300)).toBe(255);
  expect(clampValue({ min: 0, max: 255 }, 128)).toBe(128);
});

test('ST-4: stepValue clamps at the range ends (no overflow)', () => {
  expect(stepValue({ min: 0, max: 10 }, 9, +1)).toBe(10);
  expect(stepValue({ min: 0, max: 10 }, 10, +1)).toBe(10);
  expect(stepValue({ min: 0, max: 10 }, 0, -1)).toBe(0);
});
