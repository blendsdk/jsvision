/**
 * Specification tests (immutable oracles) — jsvision-ui RD-21 pure `color-grid` math (ST-4, ST-5, ST-15).
 *
 * Source: RD-21 AC-4/AC-5/AC-14 (plans/color-family/03-01-color-swatch.md; 07-testing-strategy.md).
 * The nav oracles are transcribed **directly from the `TColorSelector::handleEvent` wrap-around decode**
 * (`colorsel.cpp:196-217`), generalized `maxCol = n-1`, `width = columns`:
 *   • `kbLeft`:  `c>0 ? c-1 : maxCol`
 *   • `kbRight`: `c<maxCol ? c+1 : 0`
 *   • `kbUp`:    `c>width-1 ? c-width : (c==0 ? maxCol : c + maxCol-width)`
 *   • `kbDown`:  `c<maxCol-(width-1) ? c+width : (c==maxCol ? 0 : c - (maxCol-width))`
 * The `hitCell` oracle encodes the PA-10 discriminated result (`number | 'overshoot' | 'outside'`) so
 * the swatch's revert-vs-clamp split lives in this pure layer. Per the immutable-oracle + TV-fidelity
 * rules, a nav mismatch vs `colorsel.cpp` is a CODE defect (fix the code, never the oracle).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { gridDims, insideGrid, hitCell, cellX, cellRow, navLeft, navRight, navUp, navDown, isNearBlack } from '../src/color/color-grid.js';

// ── ST-15: gridDims + degenerate edges (n=0/n=1/columns≤0) ────────────────────────────────────────

test('ST-15: gridDims — 16 colors × 4 columns → 4 cols, 4 rows, width 12', () => {
  expect(gridDims(16, 4)).toStrictEqual({ cols: 4, rows: 4, width: 12 });
});

test('ST-15: gridDims — a partial final row rounds up (6 colors × 4 → 2 rows)', () => {
  expect(gridDims(6, 4)).toStrictEqual({ cols: 4, rows: 2, width: 12 });
});

test('ST-15: gridDims — one row of 8 (8 colors × 8 → 1 row, width 24)', () => {
  expect(gridDims(8, 8)).toStrictEqual({ cols: 8, rows: 1, width: 24 });
});

test('ST-15: gridDims — columns ≤ 0 coerces to 1; n = 0 → rows 0', () => {
  expect(gridDims(5, 0)).toStrictEqual({ cols: 1, rows: 5, width: 3 });
  expect(gridDims(5, -3)).toStrictEqual({ cols: 1, rows: 5, width: 3 });
  expect(gridDims(0, 4)).toStrictEqual({ cols: 4, rows: 0, width: 12 });
});

// ── cellX / cellRow ───────────────────────────────────────────────────────────────────────────────

test('ST-2: cellX = (i % cols)*3, cellRow = floor(i / cols) (4-column grid)', () => {
  expect(cellX(0, 4)).toBe(0);
  expect(cellX(3, 4)).toBe(9);
  expect(cellX(4, 4)).toBe(0); // wraps to the next row's column 0
  expect(cellRow(0, 4)).toBe(0);
  expect(cellRow(3, 4)).toBe(0);
  expect(cellRow(4, 4)).toBe(1);
  expect(cellRow(15, 4)).toBe(3);
});

// ── ST-5: hitCell (inside / partial-row overshoot / outside) ──────────────────────────────────────

test('ST-5: hitCell — a real cell = localY*cols + floor(localX/3) (16 colors × 4)', () => {
  expect(hitCell(0, 0, 16, 4)).toBe(0);
  expect(hitCell(7, 0, 16, 4)).toBe(2); // floor(7/3)=2
  expect(hitCell(11, 3, 16, 4)).toBe(15); // row 3, col 3
});

test('ST-5: hitCell — outside the grid rect → "outside" (revert; PA-10 faithful)', () => {
  expect(hitCell(12, 0, 16, 4)).toBe('outside'); // x = cols*3 = 12 is past the right edge
  expect(hitCell(-1, 0, 16, 4)).toBe('outside');
  expect(hitCell(0, 4, 16, 4)).toBe('outside'); // y = rows = 4 is past the bottom edge
  expect(hitCell(0, -1, 16, 4)).toBe('outside');
});

test('ST-5: hitCell — inside the grid rect but past the last cell of a partial row → "overshoot" (clamp; PA-10 extension)', () => {
  // 6 colors × 4 → row 1 has cells 4,5 (cols 0-5); cols 6-11 in row 1 are empty (overshoot).
  expect(hitCell(0, 1, 6, 4)).toBe(4); // real cell 4
  expect(hitCell(3, 1, 6, 4)).toBe(5); // real cell 5
  expect(hitCell(6, 1, 6, 4)).toBe('overshoot'); // idx 6 ≥ n=6, inside the rect
  expect(hitCell(9, 1, 6, 4)).toBe('overshoot'); // idx 7 ≥ n=6
});

test('ST-15: insideGrid — 0 ≤ x < cols*3 and 0 ≤ y < rows; n=0 → always false', () => {
  expect(insideGrid(0, 0, 16, 4)).toBe(true);
  expect(insideGrid(11, 3, 16, 4)).toBe(true);
  expect(insideGrid(12, 0, 16, 4)).toBe(false);
  expect(insideGrid(0, 4, 16, 4)).toBe(false);
  expect(insideGrid(0, 0, 0, 4)).toBe(false); // empty palette → no cells
});

// ── ST-4: wrap-around nav (transcribed from colorsel.cpp:196-217) ─────────────────────────────────

test('ST-4: navLeft — c>0 ? c-1 : maxCol (16 colors × 4)', () => {
  expect(navLeft(5, 16, 4)).toBe(4);
  expect(navLeft(0, 16, 4)).toBe(15); // first wraps to last
});

test('ST-4: navRight — c<maxCol ? c+1 : 0 (16 colors × 4)', () => {
  expect(navRight(5, 16, 4)).toBe(6);
  expect(navRight(15, 16, 4)).toBe(0); // last wraps to first
});

test('ST-4: navUp — c>width-1 ? c-width : (c==0 ? maxCol : c+maxCol-width) (16 colors × 4)', () => {
  expect(navUp(8, 16, 4)).toBe(4); // 8 > 3 → 8-4
  expect(navUp(0, 16, 4)).toBe(15); // c==0 → maxCol
  expect(navUp(2, 16, 4)).toBe(13); // 2+15-4
  expect(navUp(3, 16, 4)).toBe(14); // 3+15-4
});

test('ST-4: navDown — c<maxCol-(width-1) ? c+width : (c==maxCol ? 0 : c-(maxCol-width)) (16 colors × 4)', () => {
  expect(navDown(4, 16, 4)).toBe(8); // 4 < 12 → 4+4
  expect(navDown(15, 16, 4)).toBe(0); // c==maxCol → 0
  expect(navDown(13, 16, 4)).toBe(2); // 13-(15-4)
  expect(navDown(12, 16, 4)).toBe(1); // 12-(15-4)
});

test('ST-15: nav on a single color (n=1) is a no-op — no infinite wrap; n=0 returns cur', () => {
  for (const nav of [navLeft, navRight, navUp, navDown]) {
    expect(nav(0, 1, 4)).toBe(0);
    expect(nav(3, 0, 4)).toBe(3); // empty palette leaves the cursor untouched
  }
});

// ── near-black predicate (PA-2) ───────────────────────────────────────────────────────────────────

test('ST-3: isNearBlack — black / very-dark / default are near-black; bright colors are not', () => {
  expect(isNearBlack('black')).toBe(true);
  expect(isNearBlack('#000000')).toBe(true);
  expect(isNearBlack('#010101')).toBe(true);
  expect(isNearBlack('default')).toBe(true); // toRgb → null ⇒ treat as near-black
  expect(isNearBlack('white')).toBe(false);
  expect(isNearBlack('yellow')).toBe(false);
  expect(isNearBlack('green')).toBe(false);
  expect(isNearBlack('#ffffff')).toBe(false);
});
