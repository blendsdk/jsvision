/**
 * Implementation tests for the shared bar-packing helper `packRow`.
 *
 * Covers the integer-packing edge cases the chrome bars rely on: an empty row, a spacer-free
 * left-pack (the byte-identical default), a single flex fill, a multi-flex largest-remainder split
 * that must sum exactly, fixed-overflow collapse, and a non-zero start margin (the menu bar's
 * left inset + right-alignment).
 */
import { test, expect } from 'vitest';
import { packRow } from '../src/layout/pack-row.js';

test('empty segment list packs to no slots', () => {
  expect(packRow([], 20)).toEqual([]);
});

test('all-fixed packs left-to-right abutting from startX — a plain left-pack', () => {
  const slots = packRow(
    [
      { kind: 'fixed', width: 3 },
      { kind: 'fixed', width: 4 },
    ],
    20,
  );
  expect(slots).toEqual([
    { x: 0, width: 3 },
    { x: 3, width: 4 },
  ]);
});

test('a single flex segment fills the leftover space up to the right edge', () => {
  const slots = packRow(
    [
      { kind: 'fixed', width: 5 },
      { kind: 'flex', weight: 1 },
    ],
    20,
  );
  expect(slots).toEqual([
    { x: 0, width: 5 },
    { x: 5, width: 15 },
  ]);
  // The last segment ends exactly at the right edge.
  expect(slots[1].x + slots[1].width).toBe(20);
});

test('multiple flex segments split via largest-remainder and sum exactly', () => {
  const slots = packRow(
    [
      { kind: 'flex', weight: 1 },
      { kind: 'flex', weight: 1 },
      { kind: 'flex', weight: 1 },
    ],
    10,
  );
  // apportion(10, [1,1,1]) → [4,3,3]; the odd cell goes to the first item.
  expect(slots).toEqual([
    { x: 0, width: 4 },
    { x: 4, width: 3 },
    { x: 7, width: 3 },
  ]);
  const total = slots.reduce((sum, s) => sum + s.width, 0);
  expect(total).toBe(10);
});

test('weighted flex split honours the grow weights and still fills exactly', () => {
  const slots = packRow(
    [
      { kind: 'flex', weight: 2 },
      { kind: 'flex', weight: 1 },
      { kind: 'flex', weight: 1 },
    ],
    100,
  );
  expect(slots.map((s) => s.width)).toEqual([50, 25, 25]);
  expect(slots[2].x + slots[2].width).toBe(100);
});

test('fixed overflow collapses flex to 0 and keeps fixed widths past the edge', () => {
  const noFlex = packRow(
    [
      { kind: 'fixed', width: 15 },
      { kind: 'fixed', width: 10 },
    ],
    20,
  );
  expect(noFlex).toEqual([
    { x: 0, width: 15 },
    { x: 15, width: 10 }, // extends past the 20-cell edge; never clamped, never negative
  ]);

  const withFlex = packRow(
    [
      { kind: 'fixed', width: 15 },
      { kind: 'flex', weight: 1 },
      { kind: 'fixed', width: 10 },
    ],
    20,
  );
  expect(withFlex).toEqual([
    { x: 0, width: 15 },
    { x: 15, width: 0 }, // flex collapsed
    { x: 15, width: 10 },
  ]);
});

test('a non-zero startX insets the first segment (the menu bar left margin)', () => {
  expect(packRow([{ kind: 'fixed', width: 6 }], 20, 1)).toEqual([{ x: 1, width: 6 }]);
});

test('startX + a trailing spacer right-aligns the following segment to the edge', () => {
  const slots = packRow(
    [
      { kind: 'fixed', width: 6 },
      { kind: 'flex', weight: 1 },
      { kind: 'fixed', width: 6 },
    ],
    40,
    1,
  );
  expect(slots).toEqual([
    { x: 1, width: 6 },
    { x: 7, width: 27 },
    { x: 34, width: 6 },
  ]);
  // The right-aligned segment ends exactly at the bar's right edge.
  expect(slots[2].x + slots[2].width).toBe(40);
});
