/**
 * Implementation tests (edges/internals) — jsvision-ui RD-21 `color-grid` (written AFTER impl).
 *
 * Exercises the `navUp`/`navDown` edge-wrap branches on a non-square (partial-row) grid, the `hitCell`
 * partial-row + outside discrimination, the `isNearBlack` luminance threshold, and `gridDims` for
 * degenerate `columns`/`n`. The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import {
  gridDims,
  insideGrid,
  hitCell,
  cellX,
  cellRow,
  navUp,
  navDown,
  navLeft,
  navRight,
  isNearBlack,
} from '../src/color/color-grid.js';

// ── navUp / navDown edge-wrap branches on a 6-color × 4-col grid (maxCol=5, width=4) ───────────────

test('navUp edge-wrap: all three branches on a partial-row grid', () => {
  expect(navUp(0, 6, 4), 'c==0 → maxCol').toBe(5);
  expect(navUp(1, 6, 4), 'c+maxCol-width = 1+5-4').toBe(2);
  expect(navUp(3, 6, 4), '3+5-4').toBe(4);
  expect(navUp(4, 6, 4), '4>width-1 → 4-4').toBe(0);
  expect(navUp(5, 6, 4), '5-4').toBe(1);
});

test('navDown edge-wrap: all three branches on a partial-row grid', () => {
  expect(navDown(0, 6, 4), '0 < 5-3 → 0+4').toBe(4);
  expect(navDown(1, 6, 4), '1 < 2 → 1+4').toBe(5);
  expect(navDown(2, 6, 4), '2-(5-4)').toBe(1);
  expect(navDown(4, 6, 4), '4-(5-4)').toBe(3);
  expect(navDown(5, 6, 4), 'c==maxCol → 0').toBe(0);
});

test('navLeft/navRight ignore columns and wrap at the ends', () => {
  expect(navLeft(0, 6, 4)).toBe(5);
  expect(navRight(5, 6, 4)).toBe(0);
  expect(navLeft(3, 6, 999)).toBe(2); // columns irrelevant for ±1
  expect(navRight(3, 6, 999)).toBe(4);
});

// ── hitCell partial-row + outside discrimination ───────────────────────────────────────────────────

test('hitCell: the last real cell of a full grid vs the first overshoot column', () => {
  // 6 colors × 4: cell 5 at row 1 cols 3-5; cols 6-11 in row 1 overshoot.
  expect(hitCell(5, 1, 6, 4), 'col 5 → floor(5/3)=1 → cell 5').toBe(5);
  expect(hitCell(6, 1, 6, 4), 'col 6 → idx 6 ≥ n → overshoot').toBe('overshoot');
  expect(hitCell(11, 1, 6, 4), 'far right of the partial row → overshoot').toBe('overshoot');
});

test('hitCell: exact grid-rect boundaries are outside', () => {
  // 16 × 4 → width 12, rows 4.
  expect(hitCell(11, 3, 16, 4), 'last in-bounds cell').toBe(15);
  expect(hitCell(12, 3, 16, 4), 'x == width → outside').toBe('outside');
  expect(hitCell(11, 4, 16, 4), 'y == rows → outside').toBe('outside');
});

test('insideGrid and hitCell agree on emptiness (n=0)', () => {
  expect(insideGrid(0, 0, 0, 4)).toBe(false);
  expect(hitCell(0, 0, 0, 4)).toBe('outside');
});

// ── isNearBlack luminance threshold ────────────────────────────────────────────────────────────────

test('isNearBlack: near the threshold (~24/255)', () => {
  expect(isNearBlack('#101010'), 'luminance 16 < 24').toBe(true);
  expect(isNearBlack('#303030'), 'luminance 48 ≥ 24').toBe(false);
  expect(isNearBlack('#00007f'), 'dark blue is near-black by luminance').toBe(true);
  expect(isNearBlack('#00ff00'), 'pure green is bright').toBe(false);
});

// ── gridDims + cellX/cellRow degenerate inputs ────────────────────────────────────────────────────

test('gridDims: fractional/negative columns coerce; a square-ish 7×3 grid', () => {
  expect(gridDims(7, 3)).toStrictEqual({ cols: 3, rows: 3, width: 9 });
  expect(gridDims(7, 2.7)).toStrictEqual({ cols: 2, rows: 4, width: 6 }); // floor(2.7)=2
  expect(gridDims(0, 0)).toStrictEqual({ cols: 1, rows: 0, width: 3 });
});

test('cellX/cellRow wrap across rows', () => {
  expect(cellX(9, 4)).toBe(3); // 9 % 4 = 1 → col 1 → x 3
  expect(cellRow(9, 4)).toBe(2); // floor(9/4)
});
