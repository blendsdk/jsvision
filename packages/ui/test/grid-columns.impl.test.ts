/**
 * Implementation tests — jsvision-ui RD-16 columns module internals and edges.
 *
 * Covers the min/max clamp fixpoint, wide-glyph (width-aware) clip/align, fractional `fr` weights,
 * zero-column / zero-row degenerate inputs, and the `auto` fallback-to-title. Complements the
 * grid-columns.spec oracles. The `.js` extension is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { stringWidth } from '../src/controls/measure.js';
import type { Column, SortState } from '../src/table/columns.js';
import { measureAutoWidths, apportionColumns, alignCell, sortRows } from '../src/table/columns.js';

interface Row {
  readonly a: string;
}
const col = (over: Partial<Column<Row>>): Column<Row> => ({ title: 'X', accessor: (r) => r.a, width: 1, ...over });

// --- min/max clamp fixpoint on fr columns (AR-175) ---

test('fr column below minWidth is pinned to minWidth; the other fr re-fills', () => {
  const columns = [col({ width: '1fr', minWidth: 10 }), col({ width: '1fr' })];
  const geom = apportionColumns(columns, [null, null], 8); // trackTotal 6, naive split [3,3]
  expect(geom.widths[0], 'clamped up to its minWidth').toBe(10);
});

test('fr column above maxWidth is pinned to maxWidth; freed cells flow to the other fr', () => {
  const columns = [col({ width: '1fr', maxWidth: 3 }), col({ width: '1fr' })];
  const geom = apportionColumns(columns, [null, null], 20); // trackTotal 18, naive split [9,9]
  expect(geom.widths[0], 'clamped down to maxWidth').toBe(3);
  expect(geom.widths[1], 'the freed cells flow to the unclamped fr').toBe(15);
});

test('minWidth > maxWidth → maxWidth wins (clamp order min then max)', () => {
  const columns = [col({ width: '1fr', minWidth: 8, maxWidth: 3 })];
  const geom = apportionColumns(columns, [null], 20);
  expect(geom.widths[0], 'maxWidth wins over an impossible minWidth').toBe(3);
});

// --- wide-glyph, width-aware clip/align (PF-104) ---

test('alignCell never splits a wide glyph on clip', () => {
  // '世'/'界' are 2 cells each; width 3 fits only the first, padded to width.
  expect(alignCell('世界', 3, 'left', stringWidth)).toBe('世 ');
  expect(alignCell('世界', 3, 'right', stringWidth)).toBe(' 世');
  expect(alignCell('AB世', 5, 'left', stringWidth), 'ABworld = 4 wide, pad 1').toBe('AB世 ');
});

// --- fractional fr ---

test('fractional fr weights apportion to exact integer widths (rounded weights)', () => {
  const columns = [col({ width: '1.5fr' }), col({ width: '0.5fr' })];
  const geom = apportionColumns(columns, [null, null], 14); // trackTotal 12, weights →[2,1]
  expect(
    geom.widths.reduce((s, w) => s + w, 0),
    'content fills the track exactly',
  ).toBe(12);
  expect(geom.totalWidth, 'content + 2 dividers === viewport').toBe(14);
});

// --- degenerate inputs ---

test('zero columns → empty geometry, totalWidth 0', () => {
  expect(apportionColumns<Row>([], [], 20)).toEqual({ widths: [], starts: [], totalWidth: 0 });
});

test('zero rows → auto column falls back to the title width (never 0)', () => {
  const columns = [col({ title: 'Name', width: 'auto' })]; // 'Name' = 4 cells
  expect(measureAutoWidths(columns, [], stringWidth)).toEqual([4]);
});

test('auto falls back to the title width when all cells are narrower', () => {
  const columns = [col({ title: 'Header', width: 'auto' })]; // 'Header' = 6
  const rows: Row[] = [{ a: 'ab' }, { a: 'x' }]; // widest cell = 2
  expect(measureAutoWidths(columns, rows, stringWidth), 'floored to the title').toEqual([6]);
});

test('auto maxWidth caps even below the title width (maxWidth wins)', () => {
  const columns = [col({ title: 'Header', width: 'auto', maxWidth: 3 })];
  const rows: Row[] = [{ a: 'wide-content' }];
  expect(measureAutoWidths(columns, rows, stringWidth)).toEqual([3]);
});

// --- sortRows edges ---

test('sortRows returns the same reference (source order) for a null sort', () => {
  const rows: Row[] = [{ a: 'b' }, { a: 'a' }];
  expect(sortRows(rows, [col({})], null)).toBe(rows);
});

test('sortRows treats an out-of-range sort.col as source order (never indexes an absent column)', () => {
  const rows: Row[] = [{ a: 'b' }, { a: 'a' }];
  const bad: SortState = { col: 5, dir: 'asc' };
  expect(sortRows(rows, [col({})], bad)).toBe(rows);
});

test('sortRows is stable: equal keys keep source order', () => {
  interface Pair {
    readonly k: number;
    readonly id: number;
  }
  const cols: Column<Pair>[] = [{ title: 'K', accessor: (r) => String(r.k), width: 3, compare: (a, b) => a.k - b.k }];
  const rows: Pair[] = [
    { k: 1, id: 0 },
    { k: 1, id: 1 },
    { k: 0, id: 2 },
    { k: 1, id: 3 },
  ];
  const out = sortRows(rows, cols, { col: 0, dir: 'asc' });
  expect(
    out.map((r) => r.id),
    'k=0 first, then k=1 in original order',
  ).toEqual([2, 0, 1, 3]);
});

test('sortRows desc negates the comparator', () => {
  interface N {
    readonly n: number;
  }
  const cols: Column<N>[] = [{ title: 'N', accessor: (r) => String(r.n), width: 3, compare: (a, b) => a.n - b.n }];
  const rows: N[] = [{ n: 1 }, { n: 3 }, { n: 2 }];
  expect(sortRows(rows, cols, { col: 0, dir: 'desc' }).map((r) => r.n)).toEqual([3, 2, 1]);
});
