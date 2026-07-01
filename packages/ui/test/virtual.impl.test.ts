/**
 * Implementation tests — RD-11 virtual-scroll helpers (`list/virtual.ts`).
 *
 * Pure functions decoded from TV `TListViewer::focusItem`/`focusItemNum` (`tlstview.cpp:159/175`):
 * clamp an index into range, and keep the focused item visible in a fixed-height window. `.js` per
 * NodeNext.
 */
import { test, expect } from 'vitest';
import { clampIndex, keepVisible } from '../src/list/virtual.js';

test('clampIndex clamps into [0, range-1] and empty ⇒ 0', () => {
  expect(clampIndex(-5, 10)).toBe(0);
  expect(clampIndex(3, 10)).toBe(3);
  expect(clampIndex(99, 10)).toBe(9);
  expect(clampIndex(5, 0)).toBe(0); // empty list
});

test('keepVisible scrolls up when focus is above the window (topItem = focused)', () => {
  expect(keepVisible(2, 5, 4, 100)).toBe(2);
});

test('keepVisible scrolls down when focus is at/below the window bottom (focused - rows + 1)', () => {
  // window rows 0..3 (top 0); focus 5 ⇒ top = 5 - 4 + 1 = 2.
  expect(keepVisible(5, 0, 4, 100)).toBe(2);
});

test('keepVisible leaves topItem unchanged when the focus is already visible', () => {
  expect(keepVisible(3, 2, 4, 100)).toBe(2); // rows 2..5 include 3
});

test('keepVisible clamps topItem so the window never scrolls past the end', () => {
  // range 6, rows 4 ⇒ maxTop 2; focus 5 would give top 2 (fits).
  expect(keepVisible(5, 0, 4, 6)).toBe(2);
  // A stale large topItem is clamped back to maxTop.
  expect(keepVisible(0, 99, 4, 6)).toBe(0);
});

test('keepVisible on a zero-height window returns 0', () => {
  expect(keepVisible(5, 3, 0, 100)).toBe(0);
});
