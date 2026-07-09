/**
 * Implementation tests — the pure `track.ts` value↔position math internals & edges.
 *
 * Covers the degenerate range (`max <= min`), a zero span (`length <= thumbSize`), a proportional
 * (`thumbSize > 1`) `ScrollBar`-style thumb, non-integer values, and the round-trip stability of
 * `valueToOffset`∘`offsetToValue`. The `.js` extension is required by NodeNext resolution.
 */
import { test, expect } from 'vitest';

import { clampValue, valueToOffset, offsetToValue, stepValue } from '../src/controls/track.js';

test('a degenerate range (max <= min) pins the thumb at offset 0 and maps back to min', () => {
  expect(valueToOffset({ min: 5, max: 5, length: 10 }, 5)).toBe(0);
  expect(valueToOffset({ min: 10, max: 0, length: 10 }, 7)).toBe(0); // inverted range treated as degenerate
  expect(offsetToValue({ min: 5, max: 5, length: 10 }, 4)).toBe(5);
});

test('a zero span (length <= thumbSize) pins the thumb at 0 / maps back to min', () => {
  expect(valueToOffset({ min: 0, max: 100, length: 1 }, 50)).toBe(0); // length 1, thumb 1 ⇒ span 0
  expect(valueToOffset({ min: 0, max: 100, length: 3, thumbSize: 3 }, 50)).toBe(0);
  expect(offsetToValue({ min: 0, max: 100, length: 1 }, 0)).toBe(0);
});

test('a proportional thumb (thumbSize > 1) shrinks the span accordingly', () => {
  // length 10, thumb 4 ⇒ span 6; value 100/[0,100] ⇒ offset 6 (the thumb ends at cell 9).
  expect(valueToOffset({ min: 0, max: 100, length: 10, thumbSize: 4 }, 100)).toBe(6);
  expect(valueToOffset({ min: 0, max: 100, length: 10, thumbSize: 4 }, 0)).toBe(0);
});

test('a non-integer value maps to an integer offset (floored with the half-up bias)', () => {
  const off = valueToOffset({ min: 0, max: 100, length: 11 }, 33.3);
  expect(Number.isInteger(off)).toBe(true);
  expect(off).toBe(3); // floor((33.3*10 + 50)/100) = floor(3.83) = 3
});

test('valueToOffset ∘ offsetToValue is stable across every cell', () => {
  const spec = { min: 0, max: 255, length: 16 } as const;
  for (let off = 0; off <= 15; off += 1) {
    const v = offsetToValue(spec, off);
    // Re-projecting the value the offset produced lands back on the same cell.
    expect(valueToOffset(spec, v)).toBe(off);
  }
});

test('clampValue and stepValue never leave the range', () => {
  expect(clampValue({ min: -10, max: 10 }, -50)).toBe(-10);
  expect(stepValue({ min: 0, max: 5 }, 3, +10)).toBe(5);
  expect(stepValue({ min: 0, max: 5 }, 3, -10)).toBe(0);
});
