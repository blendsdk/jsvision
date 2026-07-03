/**
 * Specification tests — jsvision-ui RD-16 columns module (ST-4, ST-5, ST-9, ST-10, ST-11).
 *
 * Immutable oracles derived from plans/table/03-02-columns.md + 07-testing-strategy.md (AR-153,
 * AR-158, AR-173, AR-179) — NEVER from the implementation (there is none when these are authored).
 * Unit-level over the pure column math: `measureAutoWidths` / `apportionColumns` / `alignCell` /
 * `sortRows`. If a case fails after implementation, the implementation is wrong.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { stringWidth } from '../src/controls/measure.js';
import type { Column, SortState } from '../src/table/columns.js';
import { measureAutoWidths, apportionColumns, alignCell, sortRows } from '../src/table/columns.js';

interface Row {
  readonly a: string;
  readonly wide: string;
}

// ST-4 — a fixed / fr / auto mix, viewport 30, the `auto` column's widest cell is 8 wide.
test('ST-4: fixed=5, auto=widest(8), fr fills the remainder; Σ + dividers integer-correct ≤ viewport', () => {
  const columns: Column<Row>[] = [
    { title: 'A', accessor: (r) => r.a, width: 5 },
    { title: 'B', accessor: (r) => r.a, width: '1fr' },
    { title: 'W', accessor: (r) => r.wide, width: 'auto' },
  ];
  const rows: Row[] = [
    { a: 'x', wide: 'longtext' }, // 'longtext' = 8 cells wide
    { a: 'y', wide: 'hi' },
  ];
  const autoWidths = measureAutoWidths(columns, rows, stringWidth);
  expect(autoWidths, 'only the auto column is measured; number/fr columns are null').toEqual([null, null, 8]);

  const geom = apportionColumns(columns, autoWidths, 30);
  expect(geom.widths[0], 'fixed column keeps its declared width').toBe(5);
  expect(geom.widths[2], 'auto column = widest cell (8)').toBe(8);
  // fr fills the remainder: viewport 30 − 3 dividers − 5 − 8 = 14
  expect(geom.widths[1], 'fr fills the remaining track exactly').toBe(14);
  // Σ(widths) + one divider per column is integer-correct and ≤ viewport
  const numCols = columns.length;
  const sum = geom.widths.reduce((s, w) => s + w, 0);
  expect(geom.totalWidth, 'totalWidth = Σ(widths + 1 divider)').toBe(sum + numCols);
  expect(geom.totalWidth, 'fits within the viewport when an fr column is present').toBeLessThanOrEqual(30);
  expect(geom.starts, 'starts are the running Σ(width + divider)').toEqual([0, 6, 21]);
});

// ST-5 — alignment within a fixed cell width (AC-4).
test('ST-5: alignCell pads right/left/center to exactly `width` cells', () => {
  expect(alignCell('12', 5, 'right', stringWidth), 'right pads left').toBe('   12');
  expect(alignCell('1', 5, 'center', stringWidth), 'center splits the remainder (extra to the right)').toBe('  1  ');
  expect(alignCell('12', 5, 'left', stringWidth), 'left pads right').toBe('12   ');
});

// ST-9 — typed numeric sort vs. locale string default (AC-6, AR-158).
test('ST-9: a numeric compare sorts numerically (not lexically); string columns sort locale-aware', () => {
  interface N {
    readonly n: number;
  }
  const numCols: Column<N>[] = [{ title: 'N', accessor: (r) => String(r.n), width: 4, compare: (a, b) => a.n - b.n }];
  const nums: N[] = [{ n: 9 }, { n: 10 }, { n: 2 }];
  const ascAsc: SortState = { col: 0, dir: 'asc' };
  expect(
    sortRows(nums, numCols, ascAsc).map((r) => r.n),
    'numeric asc: [2,9,10] not lexical [10,2,9]',
  ).toEqual([2, 9, 10]);

  interface S {
    readonly s: string;
  }
  const strCols: Column<S>[] = [{ title: 'S', accessor: (r) => r.s, width: 8 }];
  const strs: S[] = [{ s: 'banana' }, { s: 'apple' }, { s: 'cherry' }];
  expect(
    sortRows(strs, strCols, ascAsc).map((r) => r.s),
    'locale-aware default string sort',
  ).toEqual(['apple', 'banana', 'cherry']);
});

// ST-10 — all fixed/auto columns overflowing the viewport → H-scroll content (AC-7).
test('ST-10: fixed/auto columns totalling 40 in a 20-wide viewport keep their widths; totalWidth > viewport', () => {
  const columns: Column<Row>[] = [
    { title: 'A', accessor: (r) => r.a, width: 10 },
    { title: 'B', accessor: (r) => r.a, width: 15 },
    { title: 'C', accessor: (r) => r.a, width: 15 },
  ];
  const geom = apportionColumns(columns, [null, null, null], 20);
  expect(geom.widths, 'fixed columns are never shrunk below their declared width').toEqual([10, 15, 15]);
  expect(geom.totalWidth, 'content + dividers overflow the viewport (drives H-scroll)').toBe(40 + 3);
  expect(geom.totalWidth).toBeGreaterThan(20);
});

// ST-11 — all-fr columns fill the viewport exactly; no H-scroll (AC-7, AR-153).
test('ST-11: all-fr columns → totalWidth === viewport; maxIndent 0 (no H-scroll)', () => {
  const columns: Column<Row>[] = [
    { title: 'A', accessor: (r) => r.a, width: '1fr' },
    { title: 'B', accessor: (r) => r.a, width: '1fr' },
    { title: 'C', accessor: (r) => r.a, width: '2fr' },
  ];
  const viewport = 20;
  const geom = apportionColumns(columns, [null, null, null], viewport);
  expect(geom.totalWidth, 'fr columns fill the viewport exactly (content + dividers)').toBe(viewport);
  expect(Math.max(0, geom.totalWidth - viewport), 'no H-scroll: maxIndent === 0').toBe(0);
});
